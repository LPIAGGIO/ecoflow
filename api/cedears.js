// Serverless: proxy a data912 para CEDEARs.
// Mismo shape que /api/acciones — frontend lo trata igual.

const SOURCE = "https://data912.com/live/arg_cedears";

export default async function handler(req, res) {
  try {
    const r = await fetch(SOURCE);
    if (!r.ok) {
      return res.status(502).json({ error: `data912 returned ${r.status}` });
    }
    const data = await r.json();

    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
