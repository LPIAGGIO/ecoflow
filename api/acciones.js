// Serverless: proxy a data912 para acciones argentinas (panel general).
//
// Devuelve un array de objetos con la siguiente forma:
//   {
//     symbol: "GGAL",
//     px_bid: 1234.5,
//     px_ask: 1235.0,
//     c: 1234.5,            // último precio operado (close-like)
//     pct_change: 0.49,     // % vs cierre anterior
//     v: 12345,             // volumen
//     ...
//   }
//
// Lo cachea 15 segundos en CDN para reducir hits a data912.
// Al frontend no le importa la fuente — consume con el mismo shape que
// /api/bonos y /api/letras.

const SOURCE = "https://data912.com/live/arg_stocks";

export default async function handler(req, res) {
  try {
    const r = await fetch(SOURCE);
    if (!r.ok) {
      return res.status(502).json({ error: `data912 returned ${r.status}` });
    }
    const data = await r.json();

    // Cache de 15s en CDN, stale-while-revalidate 60s
    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
