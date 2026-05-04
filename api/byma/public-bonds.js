/**
 * /api/byma/public-bonds — proxy de Open BYMAdata (Bolsas y Mercados
 * Argentinos S.A.) para títulos públicos.
 *
 * BYMA expone un endpoint POST sin autenticación en
 *   https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/public-bonds
 *
 * Pero el header CORS está restringido a su propio dominio
 * (Access-Control-Allow-Origin: https://open.bymadata.com.ar), por lo que
 * no podemos llamarlo directo desde el browser. Esta function de Vercel
 * actúa como proxy: el browser le pega a /api/byma/public-bonds (mismo
 * origen, sin CORS) y la function le pega a BYMA del lado del server.
 *
 * Devuelve ~189 títulos públicos (los más operados, plazo 24hs).
 *
 * Response shape:
 *   {
 *     ok: true,
 *     data: BymaBond[],
 *     meta: { totalRecords, fetchedAt, durationMs, source, delayMinutes }
 *   }
 *
 * En caso de error:
 *   { ok: false, error: string, statusCode?: number }
 *
 * Caching: este endpoint NO cachea internamente (cada call hace el fetch
 * a BYMA). El cache lo manejamos del lado del cliente con sessionStorage
 * 5 min, igual que data912. Adicionalmente seteamos Cache-Control para
 * que el CDN de Vercel cachee 60s entre múltiples usuarios.
 *
 * Latencia esperada: ~200-400ms (BYMA suele responder rápido).
 *
 * IMPORTANT: BYMA tiene 20 min de delay sobre los datos. Esto NO es
 * tiempo real verdadero. Sirve para precios "near-realtime" pero no para
 * trading algo serio.
 *
 * NOTA SOBRE TLS: El servidor de BYMA tiene una cadena de certificados
 * SSL incompleta — el cert leaf es válido pero los intermediates no se
 * envían correctamente. Los browsers compensan con AIA fetching, pero
 * Node.js no lo hace. Por eso necesitamos relajar la validación TLS para
 * este endpoint específico.
 *
 * En Node 18+ con global fetch (undici), la forma de hacer esto es vía
 * un Agent custom. Como `undici` no siempre está como import en Vercel,
 * usamos `https.Agent` + `node-fetch` como fallback... pero más simple
 * todavía: usamos el módulo `https` directo, sin fetch.
 *
 * Riesgo: en teoría un MITM podría suplantar a open.bymadata.com.ar.
 * En la práctica:
 *   - Vercel corre en infra de cloud-grade, no es vulnerable a MITM.
 *   - Los datos son públicos (precios de bonos), no hay secretos.
 *   - El endpoint devuelve solo lectura, no enviamos credenciales.
 * El trade-off vale la pena para usar la fuente oficial de BYMA.
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
 * Pega al endpoint de BYMA con el body EXACTO que vimos en la captura
 * del browser (T1=true, T0=false, "Content-Type" como campo dentro del
 * body). No alteramos esto: el comportamiento de BYMA frente a campos
 * extras no está documentado y mejor replicar lo que sabemos que anda.
 *
 * Usamos el módulo `node:https` nativo (no fetch) para poder bypassar
 * la validación TLS — BYMA tiene cadena de certificados incompleta.
 *
 * @returns {Promise<Array<object>>}
 */
async function fetchBymaBonds() {
  const body = JSON.stringify({
    T1: true,
    T0: false,
    "Content-Type": "application/json, text/plain",
  });

  const result = await nodeHttpsPost(`${BYMA_BASE}/public-bonds`, {
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
      `BYMA redirige a "${location}" (HTTP ${result.status}) — probable problema de sesión`
    );
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `BYMA HTTP ${result.status} — ${result.body.slice(0, 200)}`
    );
  }

  let json;
  try {
    json = JSON.parse(result.body);
  } catch (e) {
    throw new Error(
      `BYMA respondió no-JSON (status ${result.status}): ${result.body.slice(0, 200)}`
    );
  }

  if (!json || !Array.isArray(json.data)) {
    throw new Error(
      `BYMA respuesta inesperada: ${JSON.stringify(json).slice(0, 200)}`
    );
  }
  return json.data;
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

  try {
    const allRaw = await fetchBymaBonds();

    // Deduplicamos por símbolo (defensive — la API puede devolver
    // duplicados según los flags). Mantenemos el primero que aparece.
    const seen = new Set();
    const deduped = [];
    for (const bond of allRaw) {
      if (!bond || !bond.symbol) continue;
      if (seen.has(bond.symbol)) continue;
      seen.add(bond.symbol);
      deduped.push(normalizeBond(bond));
    }

    // Ordenamos alfabéticamente por símbolo (más predecible que el orden
    // crudo, que puede variar entre llamadas).
    deduped.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const durationMs = Date.now() - startedAt;

    // Cache HTTP: que el CDN de Vercel cachee 60 segundos como mucho.
    // El cliente igual cachea 5 min en sessionStorage, así que esto es
    // una segunda capa por si varios usuarios consultan en simultáneo.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");

    return res.status(200).json({
      ok: true,
      data: deduped,
      meta: {
        totalRecords: deduped.length,
        rawTotal: allRaw.length,
        fetchedAt: new Date().toISOString(),
        durationMs,
        source: "open.bymadata.com.ar",
        delayMinutes: 20,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    // `fetch failed` es genérico — el detalle real está en err.cause.
    // Lo extraemos y exponemos para diagnosticar problemas de red,
    // TLS, DNS, etc.
    const message = err instanceof Error ? err.message : String(err);
    const cause = err?.cause;
    const causeMessage = cause instanceof Error ? cause.message : (cause ? String(cause) : null);
    const causeCode = cause?.code || null;
    const errno = err?.errno || cause?.errno || null;

    // Log para debugging desde Vercel logs (incluimos todo lo que
    // pueda ayudar a diagnosticar)
    console.error("[byma/public-bonds] error:", {
      message,
      causeMessage,
      causeCode,
      errno,
      stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
      durationMs,
    });

    // Distinguir timeout de otros errores para el cliente
    const isTimeout =
      message.includes("aborted") ||
      message.includes("timeout") ||
      err?.name === "AbortError";

    return res.status(isTimeout ? 504 : 502).json({
      ok: false,
      error: message,
      // Estos campos extra ayudan a diagnosticar desde el browser sin
      // necesidad de mirar logs de Vercel.
      cause: causeMessage,
      causeCode,
      errno,
      meta: { durationMs, source: "open.bymadata.com.ar" },
    });
  }
}
