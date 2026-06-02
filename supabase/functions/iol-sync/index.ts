// supabase/functions/iol-sync/index.ts
//
// Worker de sincronización IOL. Disparado por un cron cada ~10 min.
//
// ─── VERSIÓN ACTUAL: KEEP-ALIVE + CONTABILIDAD DE CUPO ─────────────────────
// Para cada cuenta IOL activa, refresca el token usando el refresh_token
// guardado. Los tokens de IOL expiran a los 20 min, así que sin este worker
// la conexión muere y el usuario tiene que re-vincular constantemente.
//
// Cada llamada a IOL se contabiliza contra el cupo mensual del usuario:
//   - increment_api_call_count(user, broker, is_extra) suma en api_quotas.
//   - api_call_log registra endpoint, status, duración y categoría.
//
// ─── GATE DE CUPO ─────────────────────────────────────────────────────────
// IOL da 25.000 calls gratis/mes; cada extra cuesta $500 ARS. Antes de pegar
// se chequea api_quotas: si calls_made >= calls_limit y la cuenta NO tiene
// bot_extra_calls_allowed=true, se SALTEA la call (la sesión se deja morir).
// Si el flag está prendido, la call procede y se marca como extra (paga).
// Bajo la carga actual (solo keepalive, ~4.300/mes) el gate no se dispara;
// es el fusible para cuando se agreguen calls de data-sync/ejecución del bot.
//
// ─── PRÓXIMA VERSIÓN: DATA SYNC ───────────────────────────────────────────
// Con el access_token fresco va a traer /portafolio/argentina + /estadocuenta
// y reconciliar posiciones y cash. Cada fetch nuevo TIENE que pasar por el
// mismo gate y llamar a logApiCall + countCall (ver bloque TODO más abajo).
//
// ─── SEGURIDAD ────────────────────────────────────────────────────────────
// Procesa datos de TODOS los usuarios — requiere header X-Sync-Secret que
// coincida con la env var SYNC_SECRET. Solo el cron lo dispara.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const IOL_BASE = "https://api.invertironline.com";

Deno.serve(async (req: Request) => {
  // ─── Verificación del secreto ───────────────────────────────────────────
  const provided = req.headers.get("X-Sync-Secret");
  const expected = Deno.env.get("SYNC_SECRET");
  if (!expected) {
    return json({ error: "server_misconfigured", detail: "SYNC_SECRET no seteado" }, 500);
  }
  if (provided !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ─── Traer las cuentas IOL a procesar ───────────────────────────────────
  const { data: links, error: linksErr } = await sb
    .from("linked_brokers")
    .select("id, user_id, refresh_token, refresh_expires_at, status, bot_extra_calls_allowed")
    .eq("broker", "iol")
    .not("refresh_token", "is", null)
    .in("status", ["active", "error"]);

  if (linksErr) {
    return json({ error: "db_query_failed", detail: linksErr.message }, 500);
  }

  const results = {
    processed: 0,
    refreshed: 0,
    expired: 0,
    failed: 0,
    skipped_quota: 0,
    details: [] as any[],
  };

  for (const link of links || []) {
    results.processed++;
    const r = await processLink(sb, link);
    (results as any)[r.outcome]++;
    results.details.push({ id: link.id, outcome: r.outcome, note: r.note });
  }

  return json({ ok: true, ...results });
});


// ─── Procesar una cuenta: refrescar el token (keep-alive) ─────────────────

async function processLink(
  sb: SupabaseClient,
  link: any
): Promise<{ outcome: "refreshed" | "expired" | "failed" | "skipped_quota"; note?: string }> {
  // ¿El refresh_token ya expiró? No hay nada que hacer — marcamos expired.
  if (link.refresh_expires_at && new Date(link.refresh_expires_at) < new Date()) {
    await sb
      .from("linked_brokers")
      .update({
        status: "expired",
        status_message: "Sesión IOL expirada — re-vinculá tu cuenta",
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    return { outcome: "expired", note: "refresh_token vencido" };
  }

  // ─── Gate de cupo ─────────────────────────────────────────────────────
  // Leemos el consumo del mes ANTES de pegar. Si está en el límite y la
  // cuenta no autorizó calls pagas, salteamos (la sesión se deja morir).
  const quota = await fetchQuota(sb, link.user_id, "iol");
  const overQuota = quota != null && quota.calls_made >= quota.calls_limit;
  if (overQuota && !link.bot_extra_calls_allowed) {
    await sb
      .from("linked_brokers")
      .update({
        last_sync_status: "quota_exceeded",
        status_message:
          "Cupo de API IOL agotado este mes — sincronización pausada. Activá calls extra (pagas) para continuar.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    return {
      outcome: "skipped_quota",
      note: `${quota?.calls_made}/${quota?.calls_limit}`,
    };
  }
  // Si llegó acá estando sobre el cupo, es porque el flag está prendido →
  // la call es paga.
  const isExtra = overQuota;

  // ─── Refresh /token (cronometrado + logueado) ───────────────────────────
  const startedAt = Date.now();
  let tokenRes: Response;
  try {
    tokenRes = await fetch(`${IOL_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: link.refresh_token,
        grant_type: "refresh_token",
      }),
    });
  } catch (e: any) {
    logApiCall(sb, link.user_id, "POST /token", "keepalive", 0, Date.now() - startedAt);
    countCall(sb, link.user_id, isExtra);
    await sb
      .from("linked_brokers")
      .update({
        status: "error",
        status_message: `Error de red en el sync: ${String(e?.message || e).slice(0, 180)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    return { outcome: "failed", note: String(e?.message || e).slice(0, 120) };
  }

  // Registrar la call en el cupo y en el log (best-effort, no bloqueante).
  logApiCall(sb, link.user_id, "POST /token", "keepalive", tokenRes.status, Date.now() - startedAt);
  countCall(sb, link.user_id, isExtra);

  if (!tokenRes.ok) {
    // HTTP 400 de IOL en un refresh = refresh_token inválido/revocado.
    const isExpired = tokenRes.status === 400;
    await sb
      .from("linked_brokers")
      .update({
        status: isExpired ? "expired" : "error",
        status_message: isExpired
          ? "Sesión IOL rechazada — re-vinculá tu cuenta"
          : `Refresh fallido (HTTP ${tokenRes.status})`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    return {
      outcome: isExpired ? "expired" : "failed",
      note: `HTTP ${tokenRes.status}`,
    };
  }

  const tokens = await tokenRes.json();

  // ─────────────────────────────────────────────────────────────────────
  // TODO (próxima versión — DATA SYNC):
  //   Con el access_token fresco (tokens.access_token), acá va:
  //     1. GET /api/v2/portafolio/argentina  → reconciliar positions IOL
  //     2. GET /api/v2/estadocuenta          → sincronizar el cash IOL
  //   Cada fetch DEBE: respetar el gate de arriba, y llamar a
  //   logApiCall(sb, user_id, endpoint, "sync", status, dur) + countCall(...).
  // ─────────────────────────────────────────────────────────────────────

  await sb
    .from("linked_brokers")
    .update({
      status: "active",
      status_message: null,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_expires_at: parseHttpDate(tokens[".expires"]),
      refresh_expires_at: parseHttpDate(tokens[".refreshexpires"]),
      last_sync_at: new Date().toISOString(),
      last_sync_status: isExtra ? "keepalive_ok_extra" : "keepalive_ok",
      updated_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  return { outcome: "refreshed" };
}


// ─── Helpers ──────────────────────────────────────────────────────────────

// Lee el consumo del mes en curso. Devuelve null si todavía no hay fila
// (ninguna call este mes) → se trata como 0 consumido.
async function fetchQuota(
  sb: SupabaseClient,
  userId: string,
  broker: string
): Promise<{ calls_made: number; calls_limit: number } | null> {
  const { data, error } = await sb
    .from("api_quotas")
    .select("calls_made, calls_limit")
    .eq("user_id", userId)
    .eq("broker", broker)
    .eq("period_start", currentPeriodStart())
    .maybeSingle();
  if (error || !data) return null;
  return {
    calls_made: data.calls_made ?? 0,
    calls_limit: data.calls_limit ?? 25000,
  };
}

function countCall(sb: SupabaseClient, userId: string, isExtra: boolean) {
  sb.rpc("increment_api_call_count", {
    p_user_id: userId,
    p_broker: "iol",
    p_is_extra: isExtra,
  }).then(
    () => {},
    () => {}
  );
}

function logApiCall(
  sb: SupabaseClient,
  userId: string,
  endpoint: string,
  category: string,
  status: number,
  durationMs: number
) {
  sb.from("api_call_log")
    .insert({
      user_id: userId,
      broker: "iol",
      endpoint,
      category,
      status,
      duration_ms: durationMs,
    })
    .then(
      () => {},
      () => {}
    );
}

// Primer día del mes en curso (UTC), en formato YYYY-MM-DD. Coincide con
// date_trunc('month', current_date) que usa increment_api_call_count.
function currentPeriodStart(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function parseHttpDate(s?: string): string | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
