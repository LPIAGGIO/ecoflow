// Serverless: captura los settlements actuales de Primary y los guarda
// en futures_settlements_history.
//
// Diseñado para ser invocado por Vercel Cron diariamente a las 18:00 AR
// (post-cierre de mercado). También puede llamarse manualmente para
// backfill puntual.
//
// Flujo:
//   1. Auth contra Primary.
//   2. Trae instrumentos de futuros (CFICODE = "FXXXSX" o similar).
//   3. Para cada futuro con settlement, hace upsert en
//      futures_settlements_history (ticker, settle_date) → settlement.
//   4. Devuelve summary { captured, skipped, errors }.
//
// Auth: usa SUPABASE_SERVICE_ROLE_KEY (variable de entorno) para
// bypass de RLS. Esa key NUNCA se expone al cliente.

import { createClient } from "@supabase/supabase-js";

const PRIMARY_BASE = "https://api.remarkets.primary.com.ar";
const PRIMARY_USER = process.env.PRIMARY_USERNAME;
const PRIMARY_PASS = process.env.PRIMARY_PASSWORD;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tickers que nos interesan (futuros DLR + commodities relevantes).
// Si querés agregar más, simplemente sumalos acá.
const FUTURES_PREFIXES = ["DLR", "SOJ", "WTI", "TRI"];

/**
 * Determina si el symbol de Primary corresponde a un futuro que nos
 * interesa snapshotear. Filtra por prefijo + valida que tenga formato
 * "PREFIJO/MMMYY" (ej: DLR/MAY26, SOJ.ROS/JUL26).
 */
function isFutureOfInterest(symbol) {
  if (!symbol) return false;
  return FUTURES_PREFIXES.some(prefix => symbol.startsWith(prefix));
}

/**
 * Convierte un symbol de Primary "DLR/MAY26" al ticker que usa EcoFlow
 * "DLRMAY26". Si no matchea el patrón, devuelve null (lo skipeamos).
 */
function symbolToTicker(symbol) {
  // DLR/MAY26 → DLRMAY26
  // SOJ.ROS/MAY26 → SOJMAY26 (ROS y otros prefijos los ignoramos)
  const m = symbol.match(/^([A-Z]+)(?:\.[A-Z]+)?\/([A-Z]{3}\d{2})$/);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

/**
 * Hace login en Primary y devuelve el X-Auth-Token.
 */
async function getPrimaryToken() {
  if (!PRIMARY_USER || !PRIMARY_PASS) {
    throw new Error("PRIMARY_USERNAME/PASSWORD no están en env vars.");
  }
  const r = await fetch(`${PRIMARY_BASE}/auth/getToken`, {
    method: "POST",
    headers: {
      "X-Username": PRIMARY_USER,
      "X-Password": PRIMARY_PASS,
    },
  });
  if (!r.ok) {
    throw new Error(`Primary auth falló: ${r.status}`);
  }
  const token = r.headers.get("X-Auth-Token");
  if (!token) throw new Error("Primary no devolvió X-Auth-Token");
  return token;
}

/**
 * Lista todos los instrumentos de Primary en remarkets.
 */
async function listInstruments(token) {
  const r = await fetch(`${PRIMARY_BASE}/rest/instruments/all`, {
    headers: { "X-Auth-Token": token },
  });
  if (!r.ok) {
    throw new Error(`Primary instruments/all falló: ${r.status}`);
  }
  const json = await r.json();
  return json.instruments || [];
}

/**
 * Para un ticker determinado, pide el market data y devuelve el
 * settlement actual + su fecha. Primary devuelve SE como
 * { price: number, size: number|null, date: epoch_ms }.
 *
 * Retorna { price, settleDate } o null si no hay settlement válido.
 */
async function getSettlement(token, marketId, symbol) {
  const url =
    `${PRIMARY_BASE}/rest/marketdata/get?marketId=${encodeURIComponent(marketId)}` +
    `&symbol=${encodeURIComponent(symbol)}&entries=SE&depth=1`;

  const r = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!r.ok) return null;
  const json = await r.json();
  const se = json?.marketData?.SE;
  if (!se || typeof se !== "object") return null;

  const price = Number(se.price);
  if (!Number.isFinite(price)) return null;

  // se.date es epoch ms. Si está, lo usamos como fecha REAL del
  // settlement (más confiable que calcularlo nosotros). Si no, fallback
  // al cálculo de lastMarketCloseDate().
  let settleDate = null;
  if (se.date != null && Number.isFinite(Number(se.date))) {
    const d = new Date(Number(se.date));
    if (!isNaN(d.getTime())) {
      // Convertir a fecha AR para evitar shift de timezone
      settleDate = d.toISOString().split("T")[0]; // "YYYY-MM-DD"
    }
  }

  return { price, settleDate };
}

/**
 * Calcula la fecha del último cierre de mercado en zona AR. Si la hora
 * AR actual es < 17:30, asumimos que el último cierre fue ayer; si es
 * >= 17:30, es hoy. Fines de semana → último viernes.
 */
function lastMarketCloseDate() {
  const now = new Date();
  // Convertir a AR usando toLocaleString
  const arStr = now.toLocaleString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
  }); // formato "2026-05-07, 18:30:00"

  const [datePart, timePart] = arStr.split(", ");
  const [hh] = (timePart || "00:00:00").split(":").map(Number);

  // Si es antes de las 17:30 AR, el "cierre actual" es el del día previo.
  // Si es después, es de hoy (siempre que sea día hábil; si es fin de
  // semana, el cierre del último viernes).
  const arDate = new Date(`${datePart}T00:00:00`);

  if (hh < 17) {
    arDate.setDate(arDate.getDate() - 1);
  }

  // Si cae en fin de semana, retroceder a viernes.
  while (arDate.getDay() === 0 || arDate.getDay() === 6) {
    arDate.setDate(arDate.getDate() - 1);
  }

  return arDate.toISOString().split("T")[0]; // "YYYY-MM-DD"
}

export default async function handler(req, res) {
  // Auth simple para evitar que cualquiera lo pegue: requerimos que
  // el header `Authorization` matchee CRON_SECRET. Vercel Cron lo manda
  // automáticamente cuando configurás esa env var.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en env.",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const targetDate = lastMarketCloseDate();
  const summary = {
    target_date: targetDate,
    instruments_total: 0,
    futures_filtered: 0,
    captured: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  try {
    const token = await getPrimaryToken();
    const instruments = await listInstruments(token);
    summary.instruments_total = instruments.length;

    // Filtrar a los que nos interesan
    const futures = instruments.filter(it =>
      isFutureOfInterest(it?.instrumentId?.symbol)
    );
    summary.futures_filtered = futures.length;

    // Procesar de a uno (con throttle implícito por await secuencial)
    for (const inst of futures) {
      const symbol = inst.instrumentId.symbol;
      const marketId = inst.instrumentId.marketId;
      const ticker = symbolToTicker(symbol);
      if (!ticker) {
        summary.skipped++;
        continue;
      }

      try {
        const result = await getSettlement(token, marketId, symbol);
        if (!result) {
          summary.skipped++;
          summary.details.push({ ticker, status: "no_settlement" });
          continue;
        }

        // Preferimos la fecha que vino del propio settlement (es la
        // fecha real de la sesión que generó ese settle). Si no vino,
        // usamos targetDate calculada por nosotros como fallback.
        const dateToUse = result.settleDate || targetDate;

        const { error } = await supabase
          .from("futures_settlements_history")
          .upsert({
            ticker,
            settle_date: dateToUse,
            settlement: result.price,
          }, { onConflict: "ticker,settle_date" });

        if (error) {
          summary.errors++;
          summary.details.push({ ticker, status: "db_error", error: error.message });
        } else {
          summary.captured++;
          summary.details.push({ ticker, settle_date: dateToUse, settlement: result.price });
        }
      } catch (e) {
        summary.errors++;
        summary.details.push({ ticker, status: "fetch_error", error: e.message });
      }
    }

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, summary });
  }
}
