/**
 * /api/primary-md — Proxy a Primary API REST para market data en tiempo real.
 *
 * Diseño:
 *   - Lee credenciales de env vars (PRIMARY_USERNAME, PRIMARY_PASSWORD).
 *   - Cachea el token en memoria del lambda (TTL 23 hs, expira a las 24).
 *   - Acepta query `?symbols=DLR/MAY26,DLR/JUN26,...` (URL-encoded).
 *   - Hace 1 request por símbolo a /rest/marketdata/get en paralelo.
 *   - Devuelve un objeto map de ticker normalizado → datos de mercado.
 *
 * Formato de respuesta (siempre 200, errores adentro):
 *   {
 *     ok: true,
 *     fetchedAt: "2026-05-06T18:13:47.123Z",
 *     prices: {
 *       "DLRMAY26": {
 *         last:       1403.5,           // LA, último operado (puede ser null)
 *         bid:        1404.0,           // BI, mejor compra (puede ser null)
 *         offer:      1406.0,           // OF, mejor venta (puede ser null)
 *         settlement: 1411.0,           // SE, precio de ajuste (puede ser null)
 *         midpoint:   1405.0,           // (bid+offer)/2 si ambos están
 *         price:      1403.5,           // precio "elegido" — last si fresco, sino mid
 *         priceSource:"last" | "mid" | "settlement",
 *         lastDate:   1778088336702,    // timestamp del last
 *         freshness:  "fresh" | "stale" | "none",
 *       },
 *       ...
 *     }
 *   }
 *
 * Si un símbolo individual falla, queda con `error` en su entry. El response
 * global sigue siendo 200 para no romper el frontend con un fallo parcial.
 */

const PRIMARY_BASE = process.env.PRIMARY_BASE_URL || "https://api.remarkets.primary.com.ar";
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23h, refrescamos antes que expire

// Cache global del token en memoria del lambda. Persiste entre invocaciones
// mientras el container de Vercel siga vivo (~5-15 min idle hasta que se
// destruye). Eso es OK — peor caso refrescamos token con cada invocación
// fría, lo que sigue siendo aceptable.
let cachedToken = null;
let cachedTokenAt = 0;

/**
 * Obtiene un token válido. Si tenemos uno cacheado y no expiró, lo devuelve.
 * Si no, hace login contra Primary y cachea el nuevo.
 */
async function getToken() {
  const now = Date.now();
  if (cachedToken && (now - cachedTokenAt) < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const username = process.env.PRIMARY_USERNAME;
  const password = process.env.PRIMARY_PASSWORD;
  if (!username || !password) {
    throw new Error("PRIMARY_USERNAME / PRIMARY_PASSWORD no configurados en env");
  }

  const resp = await fetch(`${PRIMARY_BASE}/auth/getToken`, {
    method: "POST",
    headers: {
      "X-Username": username,
      "X-Password": password,
    },
  });

  if (!resp.ok) {
    throw new Error(`Auth fallo: HTTP ${resp.status}`);
  }

  const token = resp.headers.get("X-Auth-Token");
  if (!token) {
    throw new Error("Auth OK pero no vino X-Auth-Token en headers");
  }

  cachedToken = token;
  cachedTokenAt = now;
  return token;
}

/**
 * Hace un request a /rest/marketdata/get para un símbolo Primary
 * (formato "DLR/MAY26"). Devuelve el JSON parseado o null si falla.
 *
 * @param {string} symbol  Símbolo en formato Primary (con "/")
 * @param {string} token
 */
async function fetchSymbolMarketData(symbol, token) {
  // entries=BI,OF,LA,SE → todo lo que necesitamos para calcular el precio
  // de mercado más representativo. depth=1 = top of book.
  const url = `${PRIMARY_BASE}/rest/marketdata/get?marketId=ROFX` +
              `&symbol=${encodeURIComponent(symbol)}` +
              `&entries=BI,OF,LA,SE&depth=1`;

  const resp = await fetch(url, {
    headers: { "X-Auth-Token": token },
  });

  if (!resp.ok) {
    return { error: `HTTP ${resp.status}` };
  }

  const data = await resp.json();
  if (data?.status !== "OK" || !data?.marketData) {
    return { error: data?.description || "respuesta sin marketData" };
  }

  const md = data.marketData;
  // Cada entry puede venir como objeto plano (LA/SE) o como array (BI/OF
  // por ser book de profundidad). Normalizamos.
  const last       = md.LA?.price ?? null;
  const settlement = md.SE?.price ?? null;
  const lastDate   = md.LA?.date ?? null;
  // BI/OF vienen como array — agarramos el top of book
  const bid   = Array.isArray(md.BI) ? (md.BI[0]?.price ?? null) : (md.BI?.price ?? null);
  const offer = Array.isArray(md.OF) ? (md.OF[0]?.price ?? null) : (md.OF?.price ?? null);

  // Midpoint (si tenemos BI y OF)
  const midpoint = (bid != null && offer != null) ? (bid + offer) / 2 : null;

  // Estrategia de "precio elegido" (híbrida):
  //   1. Si hay LAST y es fresco (< 1h), usar LAST.
  //   2. Si hay MIDPOINT, usar midpoint.
  //   3. Si hay SETTLEMENT, usar settlement.
  //   4. Sino null.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const lastIsFresh = (last != null && lastDate != null) &&
                       (Date.now() - lastDate) < ONE_HOUR_MS;

  let price = null;
  let priceSource = null;
  let freshness = "none";

  if (lastIsFresh) {
    price = last;
    priceSource = "last";
    freshness = "fresh";
  } else if (midpoint != null) {
    price = midpoint;
    priceSource = "mid";
    freshness = last != null ? "stale" : "fresh";
  } else if (last != null) {
    price = last;
    priceSource = "last";
    freshness = "stale";
  } else if (settlement != null) {
    price = settlement;
    priceSource = "settlement";
    freshness = "stale";
  }

  return {
    last, bid, offer, settlement, midpoint,
    price, priceSource, lastDate, freshness,
  };
}

/**
 * Convierte ticker app → símbolo Primary y vice versa.
 *   App:     "DLRMAY26"
 *   Primary: "DLR/MAY26"
 *
 * Solo aplica para futuros DLR. Si no matchea el patrón, devuelve null.
 */
function appToPrimary(appTicker) {
  const m = (appTicker || "").toUpperCase().trim().match(/^(DLR)([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}/${m[2]}${m[3]}`;
}

function primaryToApp(primarySymbol) {
  const m = (primarySymbol || "").toUpperCase().match(/^(DLR)\/([A-Z]{3})(\d{2})$/);
  if (!m) return primarySymbol; // fallback
  return `${m[1]}${m[2]}${m[3]}`;
}


// ─── Vercel handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    // Parseamos symbols: aceptamos formato app ("DLRMAY26") o Primary
    // ("DLR/MAY26"); el endpoint convierte internamente.
    const raw = (req.query?.symbols || "").trim();
    if (!raw) {
      res.status(400).json({ ok: false, error: "missing_symbols" });
      return;
    }

    const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);

    // Mapeo a formato Primary. Si un ticker no es DLR válido, lo skipeamos
    // (futuros de otros activos no soportados aún en este endpoint).
    const symbolMap = {}; // primarySymbol → appTicker
    for (const t of requested) {
      const cleaned = t.toUpperCase();
      const isPrimaryFormat = cleaned.includes("/");
      const primary = isPrimaryFormat ? cleaned : appToPrimary(cleaned);
      const app = isPrimaryFormat ? primaryToApp(cleaned) : cleaned;
      if (primary) symbolMap[primary] = app;
    }

    const primarySymbols = Object.keys(symbolMap);
    if (primarySymbols.length === 0) {
      res.status(400).json({ ok: false, error: "no_valid_symbols" });
      return;
    }

    // Token + fetches en paralelo
    const token = await getToken();
    const results = await Promise.all(
      primarySymbols.map((s) =>
        fetchSymbolMarketData(s, token).catch((e) => ({ error: e.message }))
      )
    );

    // Armar el output con keys en formato app
    const prices = {};
    for (let i = 0; i < primarySymbols.length; i++) {
      const ps = primarySymbols[i];
      const appKey = symbolMap[ps];
      prices[appKey] = results[i];
    }

    // Cache control: 5 segundos. Esto evita que dos clientes que pollean
    // simultáneamente disparen el doble de requests a Primary. El
    // frontend pollea cada 10 seg en horario, así que CDN cache de 5s
    // no degrada frescura efectiva pero ahorra llamadas si hay varios
    // browsers abiertos.
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");

    res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      prices,
    });
  } catch (err) {
    // Si el token falló por credenciales mal o downtime, devolvemos 502.
    // El frontend muestra el error genérico y mantiene el último cache.
    console.error("primary-md error:", err);
    res.status(502).json({
      ok: false,
      error: "primary_api_error",
      detail: err.message,
    });
  }
}
