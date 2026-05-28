// Endpoint Vercel: GET /api/mtr-md
//
// Lee la tabla mtr_market_data (poblada por el worker PM2 mtr-market-data
// en el VPS) y devuelve un snapshot con price/priceSource calculados
// server-side segun la prioridad acordada:
//
//   1. last si lastTs en los ultimos 30 min -> "last"
//   2. mid = (bid+ask)/2 si bid Y ask presentes -> "mid"
//   3. last si lastTs es de hoy o ayer -> "last_stale"
//   4. settlement -> "settlement"
//   5. null si nada -> priceSource: null
//
// Cache:
//   - s-maxage=2 (CDN edge): dos pedidos en la misma ventana de 2s
//     comparten respuesta. Reduce queries a Supabase.
//   - stale-while-revalidate=10: si el cache vencio, sirve el viejo
//     y revalida en background.
//
// Staleness:
//   - stale: true si el ultimo updated_at de la tabla es > STALE_THRESHOLD_MS.
//   - El frontend puede usar "stale" para mostrar banner "datos desactualizados".

import { createClient } from "@supabase/supabase-js";

// === Constantes de configuracion ===
const LAST_FRESH_MS = 30 * 60 * 1000;      // 30 min -> "last" valido
const LAST_INTRADAY_MS = 36 * 60 * 60 * 1000; // 36 hs -> "last_stale" tope (hoy o ayer)
const STALE_THRESHOLD_MS = 60 * 1000;       // 60s sin update global -> stale:true

// === Cliente Supabase (singleton entre invocaciones warm) ===
let supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY obligatorios");
  }
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

/**
 * Computa price y priceSource segun prioridad acordada.
 * Devuelve { price, priceSource, priceTs, priceAgeSeconds }.
 */
function computePrice(row, nowMs) {
  const lastTsMs = row.last_ts ? new Date(row.last_ts).getTime() : null;
  const lastAge = lastTsMs ? nowMs - lastTsMs : Infinity;

  // 1. last reciente (< 30 min)
  if (row.last != null && lastAge <= LAST_FRESH_MS) {
    return {
      price: row.last,
      priceSource: "last",
      priceTs: row.last_ts,
      priceAgeSeconds: Math.floor(lastAge / 1000),
    };
  }

  // 2. mid = (bid + ask) / 2 si AMBOS presentes
  if (row.bid != null && row.ask != null) {
    return {
      price: (row.bid + row.ask) / 2,
      priceSource: "mid",
      priceTs: row.updated_at,
      priceAgeSeconds: row.updated_at
        ? Math.max(0, Math.floor((nowMs - new Date(row.updated_at).getTime()) / 1000))
        : null,
    };
  }

  // 3. last "stale" pero intraday (hoy o ayer, hasta 36h)
  if (row.last != null && lastAge <= LAST_INTRADAY_MS) {
    return {
      price: row.last,
      priceSource: "last_stale",
      priceTs: row.last_ts,
      priceAgeSeconds: Math.floor(lastAge / 1000),
    };
  }

  // 4. settlement (cierre anterior)
  if (row.settlement != null) {
    const settleTsMs = row.settlement_ts ? new Date(row.settlement_ts).getTime() : null;
    return {
      price: row.settlement,
      priceSource: "settlement",
      priceTs: row.settlement_ts,
      priceAgeSeconds: settleTsMs ? Math.floor((nowMs - settleTsMs) / 1000) : null,
    };
  }

  // 5. nada
  return { price: null, priceSource: null, priceTs: null, priceAgeSeconds: null };
}

/**
 * Transforma una fila del DB al shape del response.
 * Convierte snake_case -> camelCase para consumo desde el frontend.
 */
function shapeRow(row, nowMs) {
  const priced = computePrice(row, nowMs);
  return {
    securityId: row.security_id,
    symbol: row.symbol,
    segment: row.segment,
    seq: row.seq,
    bid: row.bid,
    bidSize: row.bid_size,
    ask: row.ask,
    askSize: row.ask_size,
    last: row.last,
    lastTs: row.last_ts,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    closeTs: row.close_ts,
    settlement: row.settlement,
    settlementTs: row.settlement_ts,
    reference: row.reference,
    referenceTs: row.reference_ts,
    volume: row.volume,
    volumeNominal: row.volume_nominal,
    volumeEffective: row.volume_effective,
    openInterest: row.open_interest,
    updatedAt: row.updated_at,
    ...priced,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const client = getSupabase();
    const { data, error } = await client
      .from("mtr_market_data")
      .select("*")
      .order("symbol", { ascending: true });

    if (error) {
      console.error("[mtr-md] supabase error", error);
      return res.status(503).json({
        error: "supabase_unavailable",
        message: error.message,
      });
    }

    const nowMs = Date.now();
    const rows = (data || []).map((r) => shapeRow(r, nowMs));

    // Staleness global: el dato mas reciente del set debe ser < STALE_THRESHOLD_MS.
    let latestUpdateMs = 0;
    for (const r of data || []) {
      if (r.updated_at) {
        const t = new Date(r.updated_at).getTime();
        if (t > latestUpdateMs) latestUpdateMs = t;
      }
    }
    const stalenessMs = latestUpdateMs ? nowMs - latestUpdateMs : null;
    const stale = stalenessMs == null || stalenessMs > STALE_THRESHOLD_MS;

    res.setHeader("Cache-Control", "s-maxage=2, stale-while-revalidate=10");
    return res.status(200).json({
      asOf: new Date(nowMs).toISOString(),
      stale,
      stalenessSeconds: stalenessMs != null ? Math.floor(stalenessMs / 1000) : null,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("[mtr-md] exception", err);
    return res.status(500).json({
      error: "internal_error",
      message: err.message,
    });
  }
}
