// Serverless function: proxy a dolarapi.com
// En desarrollo Vite usa el proxy en vite.config.js
// En producción Vercel ejecuta esta función cuando se llama a /api/dolares

export default async function handler(req, res) {
  try {
    const response = await fetch("https://dolarapi.com/v1/dolares", {
      headers: { "User-Agent": "Midas/0.1" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "dolarapi.com respondió " + response.status,
      });
    }

    const data = await response.json();

    // Cache headers: 30 segundos en CDN, sirve cached mientras revalida
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Fallo al consultar dolarapi: " + error.message,
    });
  }
}
