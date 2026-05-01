/**
 * Helper compartido para llamadas a A3 Mercados (api.mae.com.ar).
 *
 * Centraliza:
 *   - Base URL de la API
 *   - Inyección del header x-api-key desde env var MAE_API_KEY
 *   - Manejo de timeouts (la API puede ser lenta fuera de horario)
 *   - Normalización de errores
 *
 * El nombre del archivo empieza con guion bajo (_a3.js) por convención
 * Vercel: archivos en /api/ que NO empiezan con _ se exponen como
 * endpoints HTTP. Los que empiezan con _ son módulos privados que
 * solo pueden importar otros archivos de /api/.
 *
 * Uso:
 *   import { fetchA3 } from "./_a3.js";
 *   const data = await fetchA3("mercado/cotizaciones/cauciones");
 */

const A3_BASE_URL = "https://api.mae.com.ar/MarketData/v1";
const A3_TIMEOUT_MS = 12_000;  // A3 puede tardar fuera de horario hábil

/**
 * Hace un GET autenticado a A3 Mercados.
 *
 * @param {string} path  Ruta relativa sin slash inicial (ej. "mercado/cotizaciones/cauciones").
 *                       Puede incluir query params: "mercado/boletin/ReporteResumenFinal?fecha=2026-04-30"
 * @returns {Promise<{ ok: true, status: number, data: any } | { ok: false, status: number, error: string }>}
 */
export async function fetchA3(path) {
  const apiKey = process.env.MAE_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "MAE_API_KEY no configurada en el entorno. Revisar Vercel env vars.",
    };
  }

  const url = `${A3_BASE_URL}/${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), A3_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
        "User-Agent": "EcoFlow/0.1",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Capturamos el body por si A3 manda detalle del error
      let bodyText = "";
      try { bodyText = await response.text(); } catch {}
      return {
        ok: false,
        status: response.status,
        error: `A3 respondió ${response.status}${bodyText ? ` · ${bodyText.slice(0, 200)}` : ""}`,
      };
    }

    const data = await response.json();
    return { ok: true, status: 200, data };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return { ok: false, status: 504, error: "Timeout consultando A3 (12s)" };
    }
    return { ok: false, status: 500, error: `Fallo de red: ${error.message}` };
  }
}

/**
 * Wrapper estándar para handlers de Vercel.
 * Devuelve la respuesta de A3 con cache headers apropiados, o un error.
 *
 * @param {object} res          Response de Vercel
 * @param {string} path         Path relativo a A3
 * @param {object} [options]
 * @param {number} [options.cacheSeconds=60]      Tiempo de cache en CDN
 * @param {number} [options.staleSeconds=120]     Tiempo de stale-while-revalidate
 */
export async function proxyA3(res, path, options = {}) {
  const { cacheSeconds = 60, staleSeconds = 120 } = options;

  const result = await fetchA3(path);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${staleSeconds}`
  );
  return res.status(200).json(result.data);
}
