/**
 * /api/_debug-env — endpoint TEMPORAL de diagnóstico.
 *
 * Solo lista qué env vars ve la función en runtime. NO devuelve valores
 * (solo si están definidas o no), así que es seguro de exponer.
 *
 * BORRAR DESPUÉS DE USAR.
 */
export default async function handler(req, res) {
  const allKeys = Object.keys(process.env || {}).sort();
  const supabaseRelated = allKeys.filter(k =>
    k.includes("SUPA") || k.includes("CRON") || k.includes("MAE") || k.includes("VITE")
  );

  return res.status(200).json({
    nodeVersion: process.version,
    vercelRegion: process.env.VERCEL_REGION || null,
    vercelEnv: process.env.VERCEL_ENV || null,

    // Las que nos importan
    hasSupabaseUrl:        Boolean(process.env.SUPABASE_URL),
    hasSupabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasCronSecret:         Boolean(process.env.CRON_SECRET),
    hasMaeKey:             Boolean(process.env.MAE_API_KEY),

    // Tamaños (no valores) por si están truncadas
    supabaseUrlLength:        (process.env.SUPABASE_URL        || "").length,
    supabaseServiceKeyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").length,
    cronSecretLength:         (process.env.CRON_SECRET         || "").length,

    // Listado de TODAS las vars que matchean nuestros prefijos
    relevantKeys: supabaseRelated,

    // Total de env vars (ayuda a saber si hay un universo razonable)
    totalEnvVars: allKeys.length,
  });
}
