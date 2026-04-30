// Serverless function: proxy a data912.com — letras del Tesoro (Lecaps + Duales)
// Endpoint: /live/arg_notes (Gov Notes)

export default async function handler(req, res) {
  try {
    const response = await fetch("https://data912.com/live/arg_notes", {
      headers: { "User-Agent": "EcoFlow/0.1" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "data912 (arg_notes) respondió " + response.status,
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Fallo al consultar data912 letras: " + error.message,
    });
  }
}
