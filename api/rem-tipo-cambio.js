// Serverless function: proxy a la API REM BCRA — tipo de cambio proyectado
// Fuente: https://github.com/facundoallia/rem-bcra-api

export default async function handler(req, res) {
  try {
    const response = await fetch("https://bcra-rem-api.facujallia.workers.dev/api/tipo_cambio");

    if (!response.ok) {
      return res.status(response.status).json({
        error: "API REM (tipo_cambio) respondió " + response.status,
      });
    }

    const data = await response.json();
    // Cache 1 hora — el REM se actualiza mensualmente, no hay urgencia
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Fallo al consultar API REM tipo_cambio: " + error.message,
    });
  }
}
