/**
 * scripts/refresh-a3.js
 *
 * Refresca el snapshot de datos de A3 Mercados (api.mae.com.ar).
 *
 * Por qué existe este script:
 * --------------------------
 * A3 Mercados restringe el acceso a la API a IPs argentinas. Las
 * funciones serverless de Vercel salen con IPs de US/EU/BR y reciben
 * 403 de A3 ("Blocked by security filter"). En lugar de pagar un VPS
 * con IP argentina, este script corre desde la máquina del developer
 * (que sí tiene IP argentina autorizada), descarga los endpoints, y
 * los guarda como JSON estático en public/data/a3-snapshot.json.
 *
 * El frontend lee ese snapshot vía /api/a3-cauciones (que ahora lee
 * el JSON estático en lugar de proxear a A3). Forma de uso:
 *
 *   1. Configurar la API key (una sola vez):
 *      - Crear .env.local en la raíz del proyecto con:
 *        MAE_API_KEY=tu_key_aqui
 *
 *   2. Refrescar el snapshot (cuando se quiera actualizar los datos):
 *      node scripts/refresh-a3.js
 *
 *   3. Commitear y pushear:
 *      git add public/data/a3-snapshot.json
 *      git commit -m "chore: refresh A3 snapshot"
 *      git push
 *
 * El snapshot tiene timestamp y el frontend muestra "actualizado hace X"
 * para que el usuario sepa qué tan fresco es el dato.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Config ─────────────────────────────────────────────
const A3_BASE_URL = "https://api.mae.com.ar/MarketData/v1";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "public", "data", "a3-snapshot.json");
const ENV_FILE_PATH = path.join(PROJECT_ROOT, ".env.local");
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Endpoints a refrescar. Cada uno se guarda como una key en el snapshot final.
 * Si un endpoint falla, los demás se siguen procesando — no aborta todo.
 *
 * Para sumar un endpoint nuevo, agregar acá:
 *   { key: "rentafija", path: "mercado/cotizaciones/rentafija" }
 */
const ENDPOINTS = [
  { key: "cauciones", path: "mercado/cotizaciones/cauciones" },
  // Próximos a habilitar:
  // { key: "rentafija", path: "mercado/cotizaciones/rentafija" },
  // { key: "forex",     path: "mercado/cotizaciones/forex" },
  // { key: "repo",      path: "mercado/cotizaciones/repo" },
];

// ─── Helpers ────────────────────────────────────────────

/**
 * Lee MAE_API_KEY desde .env.local. No usamos `dotenv` para evitar
 * agregar dependencia para un script tan chico.
 */
function loadApiKey() {
  // Primero probamos process.env (por si fue exportado desde shell)
  if (process.env.MAE_API_KEY) return process.env.MAE_API_KEY;

  // Si no, leemos .env.local
  if (!fs.existsSync(ENV_FILE_PATH)) {
    fail(
      `No se encontró ${ENV_FILE_PATH}.\n` +
      `Crear el archivo con: MAE_API_KEY=tu_key_aqui`
    );
  }
  const content = fs.readFileSync(ENV_FILE_PATH, "utf-8");
  const match = content.match(/^MAE_API_KEY\s*=\s*(.+?)\s*$/m);
  if (!match) {
    fail(`No se encontró MAE_API_KEY en ${ENV_FILE_PATH}`);
  }
  // Limpiar comillas si existen
  return match[1].replace(/^["']|["']$/g, "").trim();
}

async function fetchEndpoint(apiKey, endpoint) {
  const url = `${A3_BASE_URL}/${endpoint.path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (EcoFlow Snapshot Tool)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status} · ${body.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    return { ok: true, data };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return { ok: false, error: `Timeout después de ${REQUEST_TIMEOUT_MS}ms` };
    }
    return { ok: false, error: error.message };
  }
}

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function fmtDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log("\n📡 Refresh de snapshot A3 Mercados\n");

  const apiKey = loadApiKey();
  console.log(`🔑 API key cargada (longitud: ${apiKey.length} chars)`);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "A3 Mercados · api.mae.com.ar/MarketData/v1",
    endpoints: {},
  };

  let okCount = 0;
  let failCount = 0;

  for (const endpoint of ENDPOINTS) {
    const start = Date.now();
    process.stdout.write(`📥 ${endpoint.path} ... `);

    const result = await fetchEndpoint(apiKey, endpoint);
    const duration = Date.now() - start;

    if (result.ok) {
      const count = Array.isArray(result.data) ? result.data.length : "obj";
      console.log(`✅ ${count} items · ${fmtDuration(duration)}`);
      snapshot.endpoints[endpoint.key] = {
        ok: true,
        fetchedAt: new Date().toISOString(),
        durationMs: duration,
        data: result.data,
      };
      okCount++;
    } else {
      console.log(`❌ ${result.error}`);
      snapshot.endpoints[endpoint.key] = {
        ok: false,
        fetchedAt: new Date().toISOString(),
        error: result.error,
      };
      failCount++;
    }
  }

  // Asegurar que public/data/ exista
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");

  const sizeKb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
  console.log(`\n💾 Snapshot guardado en public/data/a3-snapshot.json (${sizeKb} KB)`);
  console.log(`   ${okCount} OK · ${failCount} fallos`);
  console.log(`\n📤 Próximo paso:`);
  console.log(`   git add public/data/a3-snapshot.json`);
  console.log(`   git commit -m "chore: refresh A3 snapshot"`);
  console.log(`   git push\n`);

  // Exit code 0 si al menos un endpoint funcionó (ajustar si querés strict)
  process.exit(okCount > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n💥 Error inesperado:", err);
  process.exit(1);
});
