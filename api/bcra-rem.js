// Serverless: datos del REM (Relevamiento de Expectativas de Mercado) del BCRA.
//
// FUENTE: tabla `rem_forecasts` de Supabase, cargada con los valores OFICIALES
// del BCRA (Excel "Cuadros de resultados", mediana por mes). Antes esto
// proxyeaba un scraper de terceros (facujallia worker) que venía atrasado un
// mes respecto del REM oficial → el "caro/barato vs REM" salía mal calibrado.
//
// Si la tabla está vacía (o falla Supabase), cae al scraper viejo como red de
// seguridad para no romper la pantalla.
//
// Usage:
//   GET /api/bcra-rem?type=ipc            → IPC var % mensual (mediana)
//   GET /api/bcra-rem?type=tipo_cambio    → TC nominal $/USD (mediana)
//
// Shape de respuesta (compatible con los consumidores existentes):
//   { titulo, hoja, fuente, datos: [{ "período": "2026-06-30", mediana: 1422 }] }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const SCRAPER_BASE = "https://bcra-rem-api.facujallia.workers.dev/api";
const SCRAPER = {
  ipc: `${SCRAPER_BASE}/ipc_general`,
  tipo_cambio: `${SCRAPER_BASE}/tipo_cambio`,
};
const TITULO = { ipc: "Precios minoristas (IPC nivel general)", tipo_cambio: "Tipo de cambio nominal" };

async function fromSupabase(type) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/rem_forecasts?variable=eq.${type}&select=period_date,mediana,survey&order=period_date.asc`;
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (SUPABASE_ANON_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return {
    titulo: TITULO[type],
    hoja: "Cuadros de resultados",
    fuente: `REM-BCRA (oficial${rows[0]?.survey ? `, ${rows[0].survey}` : ""})`,
    datos: rows.map((r) => ({ "período": r.period_date, mediana: Number(r.mediana) })),
  };
}

async function fromScraper(type) {
  const r = await fetch(SCRAPER[type]);
  if (!r.ok) throw new Error(`scraper REM (${type}) HTTP ${r.status}`);
  const data = await r.json();
  data.fuente = "scraper (fallback)";
  return data;
}

export default async function handler(req, res) {
  const { type } = req.query || {};
  if (!type || !SCRAPER[type]) {
    return res.status(400).json({ error: "Falta o inválido el query param 'type'.", allowed: Object.keys(SCRAPER) });
  }
  try {
    let data = null;
    try { data = await fromSupabase(type); } catch (e) { console.warn("rem supabase fail:", e.message); }
    if (!data) data = await fromScraper(type); // red de seguridad
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: `Fallo al consultar REM ${type}: ${error.message}` });
  }
}
