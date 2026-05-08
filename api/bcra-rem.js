// Serverless: proxy unificado a la API REM BCRA (facundoallia/rem-bcra-api).
//
// Consolida ipc + tipo_cambio en un único endpoint.
//
// Usage:
//   GET /api/bcra-rem?type=ipc            → /api/ipc_general
//   GET /api/bcra-rem?type=tipo_cambio    → /api/tipo_cambio
//
// El REM se actualiza mensualmente, así que usamos cache largo (1h CDN).

const BASE = "https://bcra-rem-api.facujallia.workers.dev/api";

const SOURCES = {
  ipc: `${BASE}/ipc_general`,
  tipo_cambio: `${BASE}/tipo_cambio`,
};

export default async function handler(req, res) {
  const { type } = req.query || {};
  if (!type || !SOURCES[type]) {
    return res.status(400).json({
      error: "Falta o inválido el query param 'type'.",
      allowed: Object.keys(SOURCES),
    });
  }

  try {
    const response = await fetch(SOURCES[type]);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API REM (${type}) respondió ${response.status}`,
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: `Fallo al consultar API REM ${type}: ${error.message}`,
    });
  }
}
