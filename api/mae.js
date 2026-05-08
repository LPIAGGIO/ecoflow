// Serverless: proxy unificado a MAE Market Data API.
//
// Consolida los endpoints de MAE en un único entrypoint para no llenar
// el cupo de funciones serverless del Vercel Hobby plan.
//
// Usage:
//   GET /api/mae?type=cauciones                       → /cotizaciones/cauciones
//   GET /api/mae?type=rentafija                       → /cotizaciones/rentafija
//   GET /api/mae?type=forex                           → /cotizaciones/forex
//   GET /api/mae?type=repo                            → /cotizaciones/repo
//   GET /api/mae?type=boletin&fecha=YYYY-MM-DD        → /boletin/ReporteResumenFinal?fecha=
//
// AUTH: usa MAE_API_KEY de env vars. Nunca se expone al cliente.
//
// User-Agent: usamos uno de browser real porque MAE bloquea User-Agents
// "bot-like" o de cloud providers (devolvió 403 con el default de fetch).

const MAE_BASE = "https://api.mae.com.ar/MarketData/v1";

const PATHS = {
  cauciones:  "/mercado/cotizaciones/cauciones",
  rentafija:  "/mercado/cotizaciones/rentafija",
  forex:      "/mercado/cotizaciones/forex",
  repo:       "/mercado/cotizaciones/repo",
  boletin:    "/mercado/boletin/ReporteResumenFinal",
};

export default async function handler(req, res) {
  const t0 = Date.now();
  const { type, fecha } = req.query || {};

  if (!type || !PATHS[type]) {
    return res.status(400).json({
      error: "Falta o inválido el query param 'type'.",
      allowed: Object.keys(PATHS),
    });
  }

  if (type === "boletin" && !fecha) {
    return res.status(400).json({
      error: "Para type=boletin es obligatorio el query param 'fecha=YYYY-MM-DD'.",
    });
  }

  if (type === "boletin" && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({
      error: "fecha debe tener formato YYYY-MM-DD.",
    });
  }

  const apiKey = process.env.MAE_API_KEY;
  if (!apiKey) {
    console.error("[mae] MAE_API_KEY no configurada en env vars");
    return res.status(500).json({
      error: "API key no configurada en el server.",
    });
  }

  let url = `${MAE_BASE}${PATHS[type]}`;
  if (type === "boletin") {
    url += `?fecha=${encodeURIComponent(fecha)}`;
  }

  try {
    const r = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      },
    });

    const duration = Date.now() - t0;
    const contentType = r.headers.get("content-type") || "";

    if (!r.ok) {
      let bodySnippet = "";
      try {
        bodySnippet = (await r.text()).slice(0, 200);
      } catch {}
      console.warn(
        `[mae] type=${type} fecha=${fecha || "-"} status=${r.status} ` +
        `duration=${duration}ms body="${bodySnippet}"`
      );
      return res.status(r.status).json({
        error: `MAE devolvió ${r.status}`,
        type,
        fecha: fecha || null,
        body_snippet: bodySnippet || null,
      });
    }

    let body;
    if (contentType.includes("application/json")) {
      body = await r.json();
    } else {
      body = await r.text();
    }

    const paginationHeader = r.headers.get("x-pagination");
    let meta = null;
    if (paginationHeader) {
      try {
        meta = JSON.parse(paginationHeader);
      } catch {
        meta = paginationHeader;
      }
    }

    console.info(
      `[mae] type=${type} fecha=${fecha || "-"} status=200 ` +
      `duration=${duration}ms records=${Array.isArray(body) ? body.length : "n/a"}`
    );

    const isHistorical =
      type === "boletin" &&
      fecha &&
      fecha < new Date().toISOString().slice(0, 10);
    const sMaxAge = isHistorical ? 3600 : 60;
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`
    );

    if (meta && typeof body === "object" && body !== null && !Array.isArray(body)) {
      return res.status(200).json({ ...body, _meta: meta });
    }
    if (meta && Array.isArray(body)) {
      return res.status(200).json({ _meta: meta, data: body });
    }
    return res.status(200).json(body);
  } catch (err) {
    const duration = Date.now() - t0;
    console.error(`[mae] type=${type} fecha=${fecha || "-"} ERROR duration=${duration}ms`, err);
    return res.status(500).json({
      error: err.message || "Error desconocido",
      type,
    });
  }
}
