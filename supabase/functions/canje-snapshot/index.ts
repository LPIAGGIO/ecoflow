// canje-snapshot — snapshot diario del canje MEP-CCL a la tabla canje_history.
//
// Fuente: data912 /live/arg_bonds, que expone las especies $, D (MEP) y C
// (CCL) de los soberanos con puntas bid/offer. El canje = precioD / precioC - 1
// (la pata en pesos se cancela). Guarda mep_d (precio especie D), ccl_c (precio
// especie C) y canje_pct para AL30 y GD30.
//
// Disparado por pg_cron post-cierre (18:00 ART / 21:00 UTC, lun-vie). Alimenta
// la banda de percentil historico del monitor de canje (leaf Desarbitrajes MEP).
//
// Sin secretos hardcodeados: todo sale de Deno.env (repo publico). El upsert usa
// la service role key (bypassa RLS; canje_history es read-only para anon).

const PAIRS = [
  { label: "AL30", ars: "AL30", mep: "AL30D", ccl: "AL30C" },
  { label: "GD30", ars: "GD30", mep: "GD30D", ccl: "GD30C" },
];

// Fecha de hoy en horario AR (UTC-3). El cron corre 21:00 UTC = 18:00 ART.
function arDate(): string {
  const ar = new Date(Date.now() - 3 * 3600 * 1000);
  return ar.toISOString().slice(0, 10);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "missing env" }, 500);
  }

  try {
    const r = await fetch("https://data912.com/live/arg_bonds");
    if (!r.ok) return json({ ok: false, error: `data912 ${r.status}` }, 502);
    const rows = await r.json();

    const bySym: Record<string, { px_bid?: number; px_ask?: number; c?: number }> = {};
    for (const x of rows || []) bySym[x.symbol] = x;

    // Precio = mid de las puntas si las hay; si no, ultimo operado.
    const px = (s: string): number | null => {
      const x = bySym[s];
      if (!x) return null;
      const bid = Number(x.px_bid), ask = Number(x.px_ask);
      if (bid > 0 && ask > 0) return (bid + ask) / 2;
      const c = Number(x.c);
      return c > 0 ? c : null;
    };

    const td = arDate();
    const records: Array<Record<string, unknown>> = [];
    for (const p of PAIRS) {
      const m = px(p.mep), c = px(p.ccl);
      if (m && c) {
        records.push({
          trade_date: td,
          ticker: p.label,
          mep_d: m,
          ccl_c: c,
          canje_pct: Number(((m / c - 1) * 100).toFixed(4)),
          source: "data912_snapshot",
        });
      }
    }

    if (!records.length) {
      return json({ ok: false, error: "no pairs computed (mercado cerrado o data912 sin C/D)" }, 200);
    }

    const up = await fetch(`${SUPABASE_URL}/rest/v1/canje_history`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(records),
    });

    if (!up.ok) {
      const body = await up.text();
      return json({ ok: false, error: `upsert ${up.status}`, body }, 502);
    }

    return json({ ok: true, trade_date: td, upserted: records.map((x) => ({ ticker: x.ticker, canje_pct: x.canje_pct })) });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
