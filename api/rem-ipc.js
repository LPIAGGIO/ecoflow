// Serverless function: proxy a la API REM BCRA — inflación general proyectada
// Fuente: https://github.com/facundoallia/rem-bcra-api

export default async function handler(req, res) {
  try {
    const response = await fetch("https://bcra-rem-api.facujallia.workers.dev/api/ipc_general");

    if (!response.ok) {
      return res.status(response.status).json({
        error: "API REM (ipc_general) respondió " + response.status,
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Fallo al consultar API REM ipc_general: " + error.message,
    });
  }
}
