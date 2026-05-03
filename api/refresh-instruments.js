/**
 * /api/refresh-instruments — refresh del catálogo de tickers desde data912.
 *
 * Tiene DOS modos:
 *
 *   1) AUTENTICADO (header `Authorization: Bearer ${CRON_SECRET}`)
 *      → ejecuta refresh siempre, sin importar cuándo fue el último.
 *      → este es el que usa Vercel Cron.
 *
 *   2) NO AUTENTICADO (sin header, llamado desde el browser del user)
 *      → solo ejecuta si pasaron > 12hs del último refresh exitoso.
 *      → esto evita abuso (1000 reqs no fuerzan 1000 refreshes).
 *      → este es el "lazy on-demand" desde el front.
 *
 * En ambos casos la respuesta es JSON:
 *   { ok, skipped?, reason?, recordsUpdated, perType, ranAt, durationMs }
 *
 * Env vars requeridas:
 *   SUPABASE_URL                  (igual que VITE_SUPABASE_URL pero sin prefijo)
 *   SUPABASE_SERVICE_ROLE_KEY     (Settings → API → service_role secret)
 *   CRON_SECRET                   (cualquier string aleatorio largo)
 */

import { createClient } from "@supabase/supabase-js";

const REFRESH_THRESHOLD_HOURS = 12;
const DATA912_TIMEOUT_MS = 15_000;

const ENDPOINT_MAP = [
  { path: "arg_stocks",  type: "stock"    },
  { path: "arg_cedears", type: "cedear"   },
  { path: "arg_bonds",   type: "bond_usd" },
  { path: "arg_corp",    type: "on"       },
];

/* ─────────────── helpers ─────────────── */

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan env vars SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
      "Configurar en Vercel → Settings → Environment Variables."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchData912(path) {
  const url = `https://data912.com/live/${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DATA912_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        // data912 a veces bloquea User-Agents identificados como bot
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arr = await resp.json();
    if (!Array.isArray(arr)) throw new Error("Respuesta no es array");
    return arr;
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error(`${path}: ${e.message}`);
  }
}

function normalizeTicker(item) {
  // data912 usa `symbol` para el ticker. Algunos endpoints lo traen en
  // mayúsculas, otros mixed-case. Forzamos uppercase y sacamos espacios.
  const raw = item?.symbol;
  if (!raw || typeof raw !== "string") return null;
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return null;
  return ticker;
}

/* ─────────────── Metadata enrichment para bond_usd ───────────────
 *
 * data912 devuelve solo el symbol (ej. "AL30") sin descripción ni
 * vencimiento. Para que el dropdown del front muestre "AL30 — Bonar
 * 2030 · vto 09/jul/30" en vez de solo "AL30", enriquecemos manualmente
 * los bonos soberanos más conocidos. Lo guardamos en metadata + description.
 *
 * Si data912 trae un ticker que NO está en este lookup, queda con
 * description: null y en el front se muestra solo el ticker.
 */
const BOND_USD_METADATA = {
  // Bonares ley local (AL...)
  AL29:  { description: "Bonar 2029",  maturityDate: "2029-07-09" },
  AL30:  { description: "Bonar 2030",  maturityDate: "2030-07-09" },
  AL35:  { description: "Bonar 2035",  maturityDate: "2035-07-09" },
  AE38:  { description: "Bonar 2038",  maturityDate: "2038-01-09" },
  AL41:  { description: "Bonar 2041",  maturityDate: "2041-07-09" },

  // Globales ley NY (GD...)
  GD29:  { description: "Global 2029", maturityDate: "2029-07-09" },
  GD30:  { description: "Global 2030", maturityDate: "2030-07-09" },
  GD35:  { description: "Global 2035", maturityDate: "2035-07-09" },
  GD38:  { description: "Global 2038", maturityDate: "2038-01-09" },
  GD41:  { description: "Global 2041", maturityDate: "2041-07-09" },
  GD46:  { description: "Global 2046", maturityDate: "2046-07-09" },

  // Bonos provinciales / históricos comunes
  AY24:  { description: "Bonar 2024",                   maturityDate: "2024-05-07" },
  AO20:  { description: "Bonar 2020",                   maturityDate: "2020-10-08" },
  PARY:  { description: "Par USD ley NY",               maturityDate: "2038-12-31" },
  DICY:  { description: "Discount USD ley NY",          maturityDate: "2033-12-31" },
  PARA:  { description: "Par USD ley local",            maturityDate: "2038-12-31" },
  DICA:  { description: "Discount USD ley local",       maturityDate: "2033-12-31" },
};

/**
 * Analiza un ticker de bono USD para detectar si tiene sufijo de plaza.
 *
 * Patrón típico:
 *   - AL30  → puro      → operación en ARS
 *   - AL30C → sufijo C  → operación en USD-CCL ("Cable")
 *   - AL30D → sufijo D  → operación en USD-MEP
 *
 * @returns {{ base: string, plaza: 'ars' | 'mep' | 'ccl' }}
 *   base:  el ticker sin sufijo (para heredar metadata del puro)
 *   plaza: la moneda en que se opera ese ticker
 */
function analyzeBondUsdTicker(ticker) {
  if (ticker.length < 2) return { base: ticker, plaza: "ars" };
  const lastChar = ticker[ticker.length - 1];

  // Solo consideramos sufijo si el ticker base (sin último char) es un
  // bono conocido o cumple el patrón 2 letras + 2-3 dígitos.
  if (lastChar === "C" || lastChar === "D") {
    const base = ticker.slice(0, -1);
    const isKnownBase =
      Boolean(BOND_USD_METADATA[base]) || /^[A-Z]{2}\d{2,3}$/.test(base);
    if (isKnownBase) {
      return { base, plaza: lastChar === "C" ? "ccl" : "mep" };
    }
  }

  // No tiene sufijo de plaza reconocible → ticker puro, opera en ARS
  return { base: ticker, plaza: "ars" };
}

/* ─────────────── handler ─────────────── */

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const startedAt = Date.now();
  const authHeader = req.headers.authorization || "";
  const expected = process.env.CRON_SECRET;
  const isAuthenticated = Boolean(expected) && authHeader === `Bearer ${expected}`;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }

  /* — Modo lazy: si NO está autenticado, chequear si vale la pena correr — */
  if (!isAuthenticated) {
    const { data: lastLog, error: logErr } = await supabase
      .from("instruments_refresh_log")
      .select("ran_at, status")
      .eq("status", "ok")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logErr) {
      return res.status(500).json({ ok: false, error: `Log lookup falló: ${logErr.message}` });
    }

    if (lastLog?.ran_at) {
      const hoursSince = (Date.now() - new Date(lastLog.ran_at).getTime()) / 3_600_000;
      if (hoursSince < REFRESH_THRESHOLD_HOURS) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "fresh",
          lastRefreshedAt: lastLog.ran_at,
          hoursSince: Math.round(hoursSince * 10) / 10,
          thresholdHours: REFRESH_THRESHOLD_HOURS,
        });
      }
    }
  }

  /* — Refresh real: 4 endpoints en paralelo — */
  const settled = await Promise.allSettled(
    ENDPOINT_MAP.map(async ({ path, type }) => {
      const items = await fetchData912(path);
      return { type, items };
    })
  );

  const allRows = [];
  const perType = {};
  const failedTypes = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < settled.length; i++) {
    const { type } = ENDPOINT_MAP[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      const seen = new Set();
      for (const item of result.value.items) {
        const ticker = normalizeTicker(item);
        if (!ticker || seen.has(ticker)) continue;
        seen.add(ticker);

        // Metadata enrichment según tipo
        let description = null;
        let metadata = {};

        if (type === "bond_usd") {
          // Analizamos el sufijo para detectar plaza (ars/mep/ccl) y heredar
          // metadata (description, maturityDate) del ticker base si existe.
          const { base, plaza } = analyzeBondUsdTicker(ticker);
          const baseMeta = BOND_USD_METADATA[base];

          metadata = { plaza };

          if (baseMeta) {
            metadata.maturityDate = baseMeta.maturityDate;
            // La descripción la heredamos del puro y agregamos el sufijo de
            // plaza al texto para que sea distinguible visualmente:
            //   AL30  → "Bonar 2030"
            //   AL30D → "Bonar 2030 · MEP"
            //   AL30C → "Bonar 2030 · CCL"
            if (plaza === "ars") {
              description = baseMeta.description;
            } else if (plaza === "mep") {
              description = `${baseMeta.description} · MEP`;
            } else if (plaza === "ccl") {
              description = `${baseMeta.description} · CCL`;
            }
          }
        }

        allRows.push({
          ticker,
          instrument_type: type,
          description,
          metadata,
          last_refreshed_at: nowIso,
        });
      }
      perType[type] = seen.size;
    } else {
      failedTypes.push({ type, error: String(result.reason?.message || result.reason) });
      perType[type] = 0;
    }
  }

  /* — Upsert masivo — */
  let upsertError = null;
  let upsertErrorDetail = null;
  if (allRows.length > 0) {
    const { error } = await supabase
      .from("instruments")
      .upsert(allRows, { onConflict: "instrument_type,ticker" });
    if (error) {
      upsertError = error.message;
      // Capturamos el objeto error completo de Supabase para diagnóstico:
      // a veces el message es genérico pero hint/details/code traen pistas.
      upsertErrorDetail = {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      };
    }
  }

  /* — Determinar status final — */
  let status;
  let errorMessage = null;
  if (upsertError) {
    status = "error";
    errorMessage = `Upsert: ${upsertError}`;
  } else if (failedTypes.length === ENDPOINT_MAP.length) {
    status = "error";
    errorMessage = `Todos los endpoints fallaron: ${failedTypes.map(f => f.type).join(", ")}`;
  } else if (failedTypes.length > 0) {
    status = "partial";
    errorMessage = `Fallaron: ${failedTypes.map(f => `${f.type} (${f.error})`).join("; ")}`;
  } else {
    status = "ok";
  }

  /* — Loguear corrida — */
  await supabase.from("instruments_refresh_log").insert({
    source: "data912",
    records_updated: allRows.length,
    status,
    error_message: errorMessage,
    ran_at: nowIso,
  });

  const httpCode = status === "error" ? 500 : 200;
  return res.status(httpCode).json({
    ok: status !== "error",
    status,
    recordsUpdated: allRows.length,
    perType,
    failedTypes,
    upsertErrorDetail,  // null si no falló el upsert; objeto con code/hint/details si falló
    ranAt: nowIso,
    durationMs: Date.now() - startedAt,
  });
}
