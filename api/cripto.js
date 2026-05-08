// Serverless: proxy unificado a criptoya.com para stablecoins.
//
// Consolida usdc + usdt en un único endpoint para no llenar el cupo
// de funciones serverless del Vercel Hobby plan.
//
// Usage:
//   GET /api/cripto?type=usdt   → criptoya.com/api/usdt/ars/1
//   GET /api/cripto?type=usdc   → criptoya.com/api/usdc/ars/1
//
// Devuelve el body tal cual lo devuelve criptoya (sin transformar).

const SOURCES = {
  usdt: "https://criptoya.com/api/usdt/ars/1",
  usdc: "https://criptoya.com/api/usdc/ars/1",
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
    const response = await fetch(SOURCES[type], {
      headers: { "User-Agent": "EcoFlow/0.1" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `criptoya.com (${type}) respondió ${response.status}`,
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: `Fallo al consultar criptoya ${type}: ${error.message}`,
    });
  }
}
