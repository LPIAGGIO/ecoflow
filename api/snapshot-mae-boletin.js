// Serverless: captura el boletín final de MAE del último día hábil
// publicado y lo persiste en mae_boletin_history.

import { createClient } from "@supabase/supabase-js";

const MAE_BASE = "https://api.mae.com.ar/MarketData/v1";
const MAE_API_KEY = process.env.MAE_API_KEY;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function lastBusinessDayAR() {
  const now = new Date();
  const arStr = now.toLocaleString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
  });
  const [datePart] = arStr.split(", ");
  const d = new Date(`${datePart}T00:00:00`);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().split("T")[0];
}

function extractTicker(tickerFull) {
  if (!tickerFull) return null;
  const slashIdx = tickerFull.indexOf("/");
  return slashIdx > 0 ? tickerFull.slice(0, slashIdx) : tickerFull;
}

export default async function handler(req, res) {
  const t0 = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!MAE_API_KEY) {
    return res.status(500).json({ error: "MAE_API_KEY no configurada" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en env.",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const targetDate = req.query?.fecha || lastBusinessDayAR();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return res.status(400).json({
      error: "fecha debe tener formato YYYY-MM-DD",
      received: targetDate,
    });
  }

  const summary = {
    target_date: targetDate,
    segments_total: 0,
    titulos_total: 0,
    captured: 0,
    skipped: 0,
    errors: 0,
    duration_ms: 0,
    details_errors: [],
  };

  try {
    const url = `${MAE_BASE}/mercado/boletin/ReporteResumenFinal?fecha=${targetDate}`;
    const r = await fetch(url, {
      headers: {
        "x-api-key": MAE_API_KEY,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      },
    });

    if (!r.ok) {
      let bodySnippet = "";
      try {
        bodySnippet = (await r.text()).slice(0, 300);
      } catch {}
      summary.errors = 1;
      summary.duration_ms = Date.now() - t0;
      summary.details_errors.push({ http_status: r.status, body: bodySnippet });
      console.error(
        `[snapshot-mae-boletin] MAE devolvió ${r.status} para fecha=${targetDate} body="${bodySnippet}"`
      );
      return res.status(502).json({
        ok: false,
        error: `MAE devolvió ${r.status}`,
        body_snippet: bodySnippet,
        summary,
      });
    }

    const json = await r.json();

    if (!json?.segmento || json.segmento.length === 0) {
      summary.duration_ms = Date.now() - t0;
      console.info(`[snapshot-mae-boletin] fecha=${targetDate}: boletín vacío`);
      return res.status(200).json({
        ok: true,
        summary,
        message: "Boletín vacío para esa fecha",
      });
    }

    summary.segments_total = json.segmento.length;

    const rowsToUpsert = [];

    for (const segmento of json.segmento) {
      const segCodigo = segmento.segmentoCodigo || null;
      const titulos = segmento.titulos || [];
      summary.titulos_total += titulos.length;

      for (const t of titulos) {
        const tickerFull = (t.ticker || "").trim();
        if (!tickerFull) {
          summary.skipped++;
          continue;
        }

        const ticker = extractTicker(tickerFull);
        if (!ticker) {
          summary.skipped++;
          continue;
        }

        rowsToUpsert.push({
          ticker,
          ticker_full: tickerFull,
          fecha: targetDate,
          plazo: t.plazo || "",
          cupon: t.cupon || null,
          moneda_codigo: t.monedaCodigo || "$",
          segmento_codigo: segCodigo,
          cantidad: t.cantidad ?? null,
          monto: t.monto ?? null,
          precio_promedio_ponderado: t.precioPromedioPonderado ?? null,
          precio_cierre_ayer: t.precioCierreAyer ?? null,
          precio_cierre_hoy: t.precioCierreHoy ?? null,
          precio_ultimo: t.precioUltimo ?? null,
          variacion: t.variacion ?? null,
          precio_minimo: t.precioMinimo ?? null,
          precio_maximo: t.precioMaximo ?? null,
          raw_payload: t,
        });
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
      const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("mae_boletin_history")
        .upsert(batch, { onConflict: "ticker_full,fecha" });

      if (error) {
        summary.errors += batch.length;
        summary.details_errors.push({
          batch_start: i,
          batch_size: batch.length,
          error: error.message,
        });
        console.error(`[snapshot-mae-boletin] Error upsert batch ${i}:`, error);
      } else {
        summary.captured += batch.length;
      }
    }

    summary.duration_ms = Date.now() - t0;
    console.info(
      `[snapshot-mae-boletin] OK fecha=${targetDate} ` +
      `captured=${summary.captured} segments=${summary.segments_total} ` +
      `duration=${summary.duration_ms}ms`
    );

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    summary.errors = 1;
    summary.duration_ms = Date.now() - t0;
    summary.details_errors.push({ error: err.message });
    console.error(`[snapshot-mae-boletin] Excepción:`, err);
    return res.status(500).json({
      ok: false,
      error: err.message,
      summary,
    });
  }
}
