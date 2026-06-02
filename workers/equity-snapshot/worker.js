/**
 * Worker equity-snapshot: snapshot del cierre diario de acciones y CEDEARs
 * desde data912, una vez por día post-cierre. Upsertea en equity_daily_close.
 *
 * Sin backfill posible (data912 es un feed live, sin histórico): la serie
 * crece desde la primera corrida hacia adelante.
 *
 * Schedule: PM2 cron_restart '0 18 * * 1-5' (TZ del VPS = America/Argentina).
 *   18:00 ART = 30 min después del cierre (17:30); `c` ya es el precio de
 *   cierre del día.
 * Override manual: FECHA=YYYY-MM-DD node worker.js
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan vars de entorno (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Verificá .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const SOURCES = {
  stock: "https://data912.com/live/arg_stocks",
  cedear: "https://data912.com/live/arg_cedears",
};

function todayArDate() {
  const ar = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const y = ar.getFullYear();
  const m = String(ar.getMonth() + 1).padStart(2, "0");
  const d = String(ar.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isBusinessDay(yyyyMmDd) {
  const d = new Date(yyyyMmDd + "T12:00:00Z");
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function syncKind(kind, url, fecha) {
  const r = await fetch(url, { headers: { "User-Agent": "Midas/0.1" } });
  if (!r.ok) throw new Error(`${kind}: HTTP ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr)) throw new Error(`${kind}: respuesta no es array`);

  // Dedup por ticker (data912 no debería duplicar, pero defensivo).
  const byTicker = new Map();
  for (const it of arr) {
    const ticker = String(it.symbol || "").trim();
    const close = numOrNull(it.c);
    if (!ticker || close == null || close <= 0) continue;
    byTicker.set(ticker, {
      trade_date: fecha,
      ticker,
      kind,
      close,
      pct_change: numOrNull(it.pct_change),
      volume: numOrNull(it.v),
      source: "data912",
      fetched_at: new Date().toISOString(),
    });
  }

  const rows = Array.from(byTicker.values());
  if (rows.length === 0) {
    console.log(`[${kind}] sin datos`);
    return 0;
  }
  const { error } = await supabase
    .from("equity_daily_close")
    .upsert(rows, { onConflict: "trade_date,ticker" });
  if (error) throw error;
  console.log(`[${kind}] ${rows.length} rows`);
  return rows.length;
}

async function main() {
  const stamp = new Date().toISOString();
  const fecha = process.env.FECHA || todayArDate();

  if (!isBusinessDay(fecha)) {
    console.log(`[${stamp}] ${fecha} no es día hábil, skip`);
    return;
  }

  console.log(`[${stamp}] snapshot equity para ${fecha}`);
  let total = 0;
  for (const [kind, url] of Object.entries(SOURCES)) {
    total += await syncKind(kind, url, fecha);
  }
  console.log(`[${new Date().toISOString()}] done, ${total} rows`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("fatal:", err);
    process.exit(1);
  });
