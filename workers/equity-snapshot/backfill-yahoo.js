/**
 * Backfill one-shot del histórico de acciones/CEDEARs desde Yahoo Finance
 * (tickers .BA = BYMA, en pesos), hacia equity_daily_close.
 *
 * Yahoo expone OHLCV diario gratis vía la API no-oficial v8/finance/chart.
 * data912 (el worker diario) no tiene histórico; Yahoo sí. Empalman: el
 * cierre de Yahoo matchea el de data912 dentro de ~0.5% (mismo cierre BYMA).
 *
 * - Toma los tickers del último snapshot de equity_daily_close (data912).
 * - Para cada uno pide Yahoo `${ticker}.BA?range=2y&interval=1d`.
 * - Upsert con ignoreDuplicates: NO pisa lo que data912 ya cargó (hoy);
 *   solo rellena los días históricos que faltan.
 * - Throttle 400ms para no comerse el rate-limit de Yahoo.
 *
 * Uso: node backfill-yahoo.js   (override rango: RANGE=1y node backfill-yahoo.js)
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

const RANGE = process.env.RANGE || "2y";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tsToArDate(tsSeconds) {
  return new Date(tsSeconds * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

async function getTickers() {
  // Último snapshot (data912) = el set de tickers vivos a backfillear.
  const { data, error } = await supabase
    .from("equity_daily_close")
    .select("ticker, kind, trade_date")
    .order("trade_date", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const seen = new Map();
  let maxDate = "";
  for (const r of data || []) if (r.trade_date > maxDate) maxDate = r.trade_date;
  for (const r of data || []) {
    if (r.trade_date === maxDate && !seen.has(r.ticker)) seen.set(r.ticker, r.kind);
  }
  return Array.from(seen.entries()).map(([ticker, kind]) => ({ ticker, kind }));
}

async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.BA?range=${RANGE}&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const j = await r.json();
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.timestamp || !res.indicators || !res.indicators.quote) return null;
  const ts = res.timestamp;
  const closes = res.indicators.quote[0].close || [];
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const c = Number(closes[i]);
    if (!Number.isFinite(c) || c <= 0) continue;
    rows.push({ trade_date: tsToArDate(ts[i]), close: c });
  }
  return rows;
}

async function main() {
  const t0 = Date.now();
  const tickers = await getTickers();
  console.log(`backfill Yahoo (${RANGE}) para ${tickers.length} tickers`);

  let okT = 0, skipT = 0, totalRows = 0;
  for (let i = 0; i < tickers.length; i++) {
    const { ticker, kind } = tickers[i];
    try {
      const hist = await fetchYahoo(ticker);
      if (!hist || hist.length === 0) {
        skipT++;
      } else {
        const fetchedAt = new Date().toISOString();
        const rows = hist.map((h) => ({
          trade_date: h.trade_date,
          ticker,
          kind,
          close: h.close,
          source: "yahoo",
          fetched_at: fetchedAt,
        }));
        // ignoreDuplicates: no pisa lo de data912 ya cargado.
        const { error } = await supabase
          .from("equity_daily_close")
          .upsert(rows, { onConflict: "trade_date,ticker", ignoreDuplicates: true });
        if (error) throw error;
        okT++;
        totalRows += rows.length;
      }
    } catch (e) {
      skipT++;
      console.log(`  ${ticker}: error ${String(e.message || e).slice(0, 80)}`);
    }
    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${tickers.length} · ok ${okT} · skip ${skipT} · rows ${totalRows}`);
    }
    await sleep(400);
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`done en ${dur}s · ok ${okT} · skip ${skipT} · ${totalRows} rows insertadas`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("fatal:", err);
    process.exit(1);
  });
