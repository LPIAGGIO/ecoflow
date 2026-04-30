// Serverless function: proxy a data912.com (precios de bonos AR)
// data912 tiene CORS abierto pero usamos proxy para tener cache CDN y consistencia

export default async function handler(req, res) {
  try {
    const response = await fetch("https://data912.com/live/arg_bonds", {
      headers: { "User-Agent": "EcoFlow/0.1" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "data912 respondió " + response.status,
      });
    }

    const data = await response.json();

    // Cache 60s en CDN, sirve cached mientras revalida (data912 tiene delay de ~2h igual)
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Fallo al consultar data912: " + error.message,
    });
  }
}
