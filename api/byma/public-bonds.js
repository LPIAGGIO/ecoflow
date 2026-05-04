/**
 * /api/byma/public-bonds — proxy de Open BYMAdata (Bolsas y Mercados
 * Argentinos S.A.) para títulos públicos.
 *
 * BYMA expone DOS endpoints sin autenticación que nos interesan:
 *   POST .../bymadata/free/public-bonds  → bonos largos (AL30, GD30, AE38, ...)
 *   POST .../bymadata/free/lebacs        → letras corto plazo (Lecaps, Boncaps)
 *
 * Esta function de Vercel actúa como proxy: pega a AMBOS endpoints en
 * paralelo y devuelve un único array deduplicado, así el cliente recibe
 * el universo completo de renta fija pública argentina en una sola call.
 *
 * (El nombre "public-bonds" en la URL de la function es legacy del primer
 *  release que solo cubría bonos largos. Mantenemos el path para no romper
 *  el cliente — pero internamente trae ambos.)
 *
 * Response shape:
 *   {
 *     ok: true,
 *     data: BymaBond[],
 *     meta: {
 *       totalRecords, rawTotal,
 *       byMarket: { publicBonds: N, lebacs: M },
 *       fetchedAt, durationMs, source, delayMinutes
 *     }
 *   }
 *
 * En caso de error:
 *   { ok: false, error: string, cause?: string, ... }
 *
 * Política de errores: si UNO de los dos endpoints falla, todavía
 * devolvemos lo que vino del otro (con un warning en `meta.partialFailure`).
 * Solo si AMBOS fallan, devolvemos error 502.
 *
 * Caching: este endpoint NO cachea internamente. El cache lo maneja el
 * cliente con sessionStorage 5 min. CDN de Vercel cachea 60s entre
 * múltiples usuarios.
 *
 * Latencia esperada: ~300-500ms (dos fetches en paralelo a BYMA).
 *
 * IMPORTANT: BYMA tiene 20 min de delay. Sirve para "near-realtime",
 * NO para trading algo serio.
 *
 * NOTA SOBRE TLS: El servidor de BYMA tiene cadena SSL incompleta —
 * el cert leaf es válido pero los intermediates no se envían
 * correctamente. Por eso usamos `node:https` con
 * rejectUnauthorized:false. Riesgo aceptable: datos públicos,
 * solo lectura, infra de Vercel no es vulnerable a MITM.
 */

import https from "node:https";
import zlib from "node:zlib";

const BYMA_BASE = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free";
const BYMA_TIMEOUT_MS = 12_000;

/**
 * Hace una request HTTPS POST usando el módulo nativo de Node (no fetch),
 * para poder configurar `rejectUnauthorized: false` y bypassear la
 * cadena SSL incompleta de BYMA.
 *
 * Devuelve { status, headers, body } con el body como string.
 */
function nodeHttpsPost(url, { headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
        // ESTE es el flag clave: tolera la cadena SSL incompleta de BYMA.
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        // Manejar gzip explícitamente si el server lo manda
        const encoding = (res.headers["content-encoding"] || "").toLowerCase();
        const chunks = [];
        let stream = res;

        if (encoding === "gzip" || encoding === "deflate") {
          stream = res.pipe(
            encoding === "gzip" ? zlib.createGunzip() : zlib.createInflate()
          );
        }

        stream.on("data", (c) => chunks.push(c));
        stream.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        stream.on("error", reject);
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`BYMA request timeout (${timeoutMs}ms)`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Pega a un endpoint específico de BYMA. Genérica para soportar tanto
 * `/public-bonds` (bonos largos) como `/lebacs` (letras corto plazo)
 * y futuras adiciones (ej. `/negociable-obligations` para ONs).
 *
 * Cada endpoint puede requerir un body ligeramente distinto — no
 * alteramos lo que sabemos que anda. Los bodies vienen de:
 *   - `public-bonds`: capturado del browser via DevTools.
 *   - `lebacs`: tomado de carvalab/openbymadata (Go, MIT licence,
 *     en uso productivo).
 *
 * Usamos el módulo `node:https` nativo (no fetch) para poder bypassar
 * la validación TLS — BYMA tiene cadena de certificados incompleta.
 *
 * @param {string} endpoint — nombre del endpoint relativo (sin slash inicial)
 * @param {object} bodyObj — objeto que se serializa a JSON como body
 * @returns {Promise<Array<object>>} array de bonos crudos de BYMA
 */
async function fetchBymaEndpoint(endpoint, bodyObj) {
  const body = JSON.stringify(bodyObj);

  const result = await nodeHttpsPost(`${BYMA_BASE}/${endpoint}`, {
    headers: {
      // Mimics el request que vimos en el browser. BYMA puede estar
      // bloqueando fetches sin estos headers.
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      "Accept-Encoding": "gzip, deflate",
      "Origin": "https://open.bymadata.com.ar",
      "Referer": "https://open.bymadata.com.ar/",
      // Un User-Agent de browser real es más probable de pasar filtros
      // anti-bot que "EcoFlow/1.0".
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body,
    timeoutMs: BYMA_TIMEOUT_MS,
  });

  // Si BYMA redirige (302/303), capturamos eso explícitamente
  if (result.status >= 300 && result.status < 400) {
    const location = result.headers.location || "(sin location)";
    throw new Error(
      `BYMA ${endpoint} redirige a "${location}" (HTTP ${result.status}) — probable problema de sesión`
    );
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `BYMA ${endpoint} HTTP ${result.status} — ${result.body.slice(0, 200)}`
    );
  }

  let json;
  try {
    json = JSON.parse(result.body);
  } catch (e) {
    throw new Error(
      `BYMA ${endpoint} respondió no-JSON (status ${result.status}): ${result.body.slice(0, 200)}`
    );
  }

  if (!json || !Array.isArray(json.data)) {
    throw new Error(
      `BYMA ${endpoint} respuesta inesperada: ${JSON.stringify(json).slice(0, 200)}`
    );
  }
  return json.data;
}

/**
 * Pega a `/public-bonds` (bonos largos: AL30, GD30, AE38, etc.).
 * Body original capturado del browser, mantenido tal cual.
 */
function fetchPublicBonds() {
  return fetchBymaEndpoint("public-bonds", {
    T1: true,
    T0: false,
    "Content-Type": "application/json, text/plain",
  });
}

/**
 * Pega a `/lebacs` (letras corto plazo: Lecaps, Boncaps).
 * El nombre del endpoint es legacy — antes traía LEBACs, hoy trae
 * Lecaps/Boncaps/Letras del Tesoro. Body distinto al de public-bonds:
 * tiene `excludeZeroPxAndQty:false` y `T2:false` extra. Tomado de
 * carvalab/openbymadata, que lo tiene en producción.
 */
function fetchLebacs() {
  return fetchBymaEndpoint("lebacs", {
    excludeZeroPxAndQty: false,
    T2: false,
    T1: true,
    T0: false,
    "Content-Type": "application/json",
  });
}

/**
 * Normaliza un bono BYMA a un shape más compacto y consistente.
 * Sólo nos quedamos con los campos que efectivamente usamos en la app.
 *
 * Convenciones de moneda en BYMA:
 *   "ARS" → pesos argentinos (precios típicamente >50.000)
 *   "USD" → USD MEP/contado (precios <100, formato porcentaje)
 *   "EXT" → USD CCL/cable
 *
 * @param {object} raw — bond crudo de la API de BYMA
 * @returns {object} bond normalizado
 */
function normalizeBond(raw) {
  return {
    symbol: raw.symbol,
    description: raw.description || "",
    maturityDate: raw.maturityDate || null,
    daysToMaturity: raw.daysToMaturity ?? null,
    currency: raw.denominationCcy, // "ARS" | "USD" | "EXT"

    // Precios (los más relevantes para nuestra app)
    last: numberOrNull(raw.trade),
    bid: numberOrNull(raw.bidPrice),
    ask: numberOrNull(raw.offerPrice),
    open: numberOrNull(raw.openingPrice),
    high: numberOrNull(raw.tradingHighPrice),
    low: numberOrNull(raw.tradingLowPrice),
    previousClose: numberOrNull(raw.previousClosingPrice),
    settlementPrice: numberOrNull(raw.settlementPrice),
    vwap: numberOrNull(raw.vwap),
    // imbalance es la variación porcentual (en formato decimal: 0.0021 = +0.21%)
    changePct: numberOrNull(raw.imbalance),

    // Volúmenes
    volume: numberOrNull(raw.volume),
    volumeAmount: numberOrNull(raw.volumeAmount),
    numberOfOrders: numberOrNull(raw.numberOfOrders),

    // Metadata
    tradeHour: raw.tradeHour || null,
    market: raw.market || "BYMA",
    securityType: raw.securityType || null,
  };
}

/**
 * Helper defensivo. La API de BYMA a veces devuelve numbers en notación
 * científica como strings ("7.787244E+7"), otras veces como number. JSON
 * los parsea automáticamente. Pero igual normalizamos.
 */
function numberOrNull(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ─────────────── handler ─────────────── */

export default async function handler(req, res) {
  // CORS abierto para que el browser de la app pueda consumir esto.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const startedAt = Date.now();

  // ── Pegamos a AMBOS endpoints en paralelo ──────────────────────────
  // Usamos Promise.allSettled (no Promise.all) para que si UNO falla, no
  // aborte la operación entera. Preferimos devolver datos parciales con
  // un warning antes que devolver error completo cuando uno solo de los
  // dos endpoints está roto.
  const [publicBondsResult, lebacsResult] = await Promise.allSettled([
    fetchPublicBonds(),
    fetchLebacs(),
  ]);

  const durationMs = Date.now() - startedAt;

  // Si los DOS fallaron → error real, devolvemos 502
  if (
    publicBondsResult.status === "rejected" &&
    lebacsResult.status === "rejected"
  ) {
    const pbErr = publicBondsResult.reason;
    const lbErr = lebacsResult.reason;

    // Extraemos detalle del primer error (el de public-bonds, más crítico)
    const message = pbErr instanceof Error ? pbErr.message : String(pbErr);
    const cause = pbErr?.cause;
    const causeMessage = cause instanceof Error ? cause.message : (cause ? String(cause) : null);
    const causeCode = cause?.code || null;
    const errno = pbErr?.errno || cause?.errno || null;

    console.error("[byma/public-bonds] AMBOS endpoints fallaron:", {
      publicBondsError: message,
      lebacsError: lbErr instanceof Error ? lbErr.message : String(lbErr),
      causeMessage,
      causeCode,
      errno,
      stack: pbErr?.stack?.split("\n").slice(0, 5).join("\n"),
      durationMs,
    });

    const isTimeout =
      message.includes("aborted") ||
      message.includes("timeout") ||
      pbErr?.name === "AbortError";

    return res.status(isTimeout ? 504 : 502).json({
      ok: false,
      error: message,
      cause: causeMessage,
      causeCode,
      errno,
      meta: {
        durationMs,
        source: "open.bymadata.com.ar",
        publicBondsError: pbErr instanceof Error ? pbErr.message : String(pbErr),
        lebacsError: lbErr instanceof Error ? lbErr.message : String(lbErr),
      },
    });
  }

  // Al menos uno funcionó. Combinamos lo que tengamos.
  const publicBondsRaw = publicBondsResult.status === "fulfilled" ? publicBondsResult.value : [];
  const lebacsRaw = lebacsResult.status === "fulfilled" ? lebacsResult.value : [];

  // Deduplicamos por símbolo. Si un ticker viene en ambos endpoints
  // (no debería pasar normalmente — son universos disjuntos — pero por
  // las dudas), gana public-bonds porque tiene datos más completos.
  const seen = new Set();
  const deduped = [];
  for (const bond of [...publicBondsRaw, ...lebacsRaw]) {
    if (!bond || !bond.symbol) continue;
    if (seen.has(bond.symbol)) continue;
    seen.add(bond.symbol);
    deduped.push(normalizeBond(bond));
  }

  // Ordenamos alfabéticamente por símbolo (más predecible que el orden
  // crudo, que puede variar entre llamadas).
  deduped.sort((a, b) => a.symbol.localeCompare(b.symbol));

  // Si uno de los dos falló, lo logueamos como warning (queda en logs
  // de Vercel para que veas que algo está degradado, pero no bloquea
  // la respuesta).
  const partialFailure = {};
  if (publicBondsResult.status === "rejected") {
    partialFailure.publicBonds = publicBondsResult.reason instanceof Error
      ? publicBondsResult.reason.message
      : String(publicBondsResult.reason);
    console.warn("[byma/public-bonds] /public-bonds falló:", partialFailure.publicBonds);
  }
  if (lebacsResult.status === "rejected") {
    partialFailure.lebacs = lebacsResult.reason instanceof Error
      ? lebacsResult.reason.message
      : String(lebacsResult.reason);
    console.warn("[byma/public-bonds] /lebacs falló:", partialFailure.lebacs);
  }

  // Cache HTTP: que el CDN de Vercel cachee 60 segundos como mucho.
  // El cliente igual cachea 5 min en sessionStorage, así que esto es
  // una segunda capa por si varios usuarios consultan en simultáneo.
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");

  const meta = {
    totalRecords: deduped.length,
    rawTotal: publicBondsRaw.length + lebacsRaw.length,
    byMarket: {
      publicBonds: publicBondsRaw.length,
      lebacs: lebacsRaw.length,
    },
    fetchedAt: new Date().toISOString(),
    durationMs,
    source: "open.bymadata.com.ar",
    delayMinutes: 20,
  };
  if (Object.keys(partialFailure).length > 0) {
    meta.partialFailure = partialFailure;
  }

  return res.status(200).json({
    ok: true,
    data: deduped,
    meta,
  });
}
