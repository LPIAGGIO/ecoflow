// Serverless function: proxy a A3 Mercados — cotizaciones de Cauciones.
// Endpoint A3: /mercado/cotizaciones/cauciones
//
// Devuelve un array con las cauciones operadas en la rueda actual,
// con plazo, tasa promedio ponderada, volumen, etc.
// Usado por: módulo Futuros vs Caución para el KPI "Caución 1d".
//
// Cache: 60s en CDN + 120s stale-while-revalidate. Las tasas de caución
// se mueven intra-rueda pero no segundo a segundo, así que 1 minuto es
// un buen tradeoff entre frescura y carga sobre A3.

import { proxyA3 } from "./_a3.js";

export default async function handler(req, res) {
  return proxyA3(res, "mercado/cotizaciones/cauciones");
}
