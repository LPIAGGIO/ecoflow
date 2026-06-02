/**
 * Enriquecimiento one-shot de nombres largos de acciones/CEDEARs desde Yahoo
 * (meta.longName del endpoint chart) hacia ticker_names.
 *
 * El ticker solo confunde (GGAL = Grupo Financiero Galicia). Yahoo da el
 * nombre en el mismo endpoint que usamos para el histórico.
 *
 * Uso: node enrich-names.js
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan vars de entorno.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTickers() {
  const { data, error } = await supabase
    .from("equity_daily_close")
    .select("ticker, trade_date")
    .order("trade_date", { ascending: false })
    .limit(2000);
  if (error) throw error;
  let maxDate = "";
  for (const r of data || []) if (r.trade_date > maxDate) maxDate = r.trade_date;
  const seen = new Set();
  for (const r of data || []) if (r.trade_date === maxDate) seen.add(r.ticker);
  return Array.from(seen);
}

async function fetchName(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.BA?range=1d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const j = await r.json();
  const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m) return null;
  const name = m.longName || m.shortName || null;
  return name ? String(name).trim() : null;
}

async function main() {
  const t0 = Date.now();
  const tickers = await getTickers();
  console.log(`enrich names para ${tickers.length} tickers`);

  let ok = 0, skip = 0;
  const batch = [];
  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("ticker_names")
      .upsert(batch.splice(0, batch.length), { onConflict: "ticker" });
    if (error) throw error;
  };

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      const name = await fetchName(ticker);
      if (name) {
        batch.push({ ticker, name, source: "yahoo", updated_at: new Date().toISOString() });
        ok++;
      } else {
        skip++;
      }
    } catch (e) {
      skip++;
    }
    if (batch.length >= 50) await flush();
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${tickers.length} · ok ${ok} · skip ${skip}`);
    await sleep(400);
  }
  await flush();

  const dur = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`done en ${dur}s · ok ${ok} · skip ${skip}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("fatal:", err);
    process.exit(1);
  });
