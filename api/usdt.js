// Serverless function: proxy a criptoya.com USDT
export default async function handler(req, res) {
  try {
    const response = await fetch("https://criptoya.com/api/usdt/ars/1", {
      headers: { "User-Agent": "EcoFlow/0.1" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "criptoya.com respondió " + response.status,
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Fallo al consultar criptoya USDT: " + error.message,
    });
  }
}
