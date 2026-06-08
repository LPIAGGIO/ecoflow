// Serverless function: tasa de Cauciones en PESOS.
//
// FUENTE (nueva): tabla `mtr_market_data` de Supabase, filas de segmento
// `rx_MAE` (CAARS/1D..4D), pobladas por el worker PM2 `mtr-market-data` que
// mantiene un WS abierto contra el visor A3 de matbarofex. Es la MISMA fuente
// MAE que el snapshot estatico viejo (api.mae.com.ar/cauciones), por otro
// transporte — pero LIVE y sin depender de un refresh manual desde IP AR.
//
// El "precio" de una caucion ES la tasa (TNA %). El worker la deja en
// last/bid/ask durante la rueda activa, o en settlement/reference fuera de
// hora. Elegimos la mejor disponible por prioridad (ver pickRate()).
//
// FALLBACK: si Supabase no tiene filas rx_MAE (o falla), caemos al snapshot
// estatico en public/data/a3-snapshot.json (red de seguridad, mismo patron
// que /api/bcra-rem). Hoy ese snapshot esta vacio, asi que el fallback real
// es "sin dato" y el frontend usa su default.
//
// SHAPE de respuesta: array compatible con el parser del frontend
// (`extractCaucion1d`), que espera objetos con { moneda, codigoPlazo/plazo,
// ultimatasa/tasaPP, volumenAcumulado }. Sintetizamos ese shape desde las
// filas de Supabase: CAARS/1D -> codigoPlazo "001", /2D -> "002", etc.

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const SNAPSHOT_PATH = path.join(process.cwd(), "public", "data", "a3-snapshot.json");

// Ventana para considerar "last" como fresco (rueda activa). Para una tasa
// diaria, 12h alcanza: si se opero hoy, gana el last; sino caemos a quote/
// settlement/reference.
const LAST_FRESH_MS = 12 * 60 * 60 * 1000;

// rx_MAE_CAARS_1D -> { plazoNum: 1, codigoPlazo: "001" }
function plazoFromSymbol(symbol) {
  const m = (symbol || "").match(/CAARS\/(\d+)D/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return { plazoNum: n, codigoPlazo: String(n).padStart(3, "0") };
}

// Elige la mejor tasa disponible de una fila y devuelve { rate, source, asOf }.
// Prioridad: last (fresco) > mid(bid,ask) > settlement > reference.
function pickRate(row, nowMs) {
  const num = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
  const last = num(row.last);
  const bid = num(row.bid);
  const ask = num(row.ask);
  const settlement = num(row.settlement);
  const reference = num(row.reference);
  const lastTs = row.last_ts ? new Date(row.last_ts).getTime() : null;
  const lastAge = lastTs != null ? nowMs - lastTs : Infinity;

  if (last != null && last > 0 && lastAge <= LAST_FRESH_MS) {
    return { rate: last, source: "last", asOf: row.last_ts };
  }
  if (bid != null && ask != null && bid > 0 && ask > 0) {
    return { rate: (bid + ask) / 2, source: "mid", asOf: row.updated_at };
  }
  if (last != null && last > 0) {
    return { rate: last, source: "last_stale", asOf: row.last_ts };
  }
  if (settlement != null && settlement > 0) {
    return { rate: settlement, source: "settlement", asOf: row.settlement_ts || row.updated_at };
  }
  if (reference != null && reference > 0) {
    return { rate: reference, source: "reference", asOf: row.reference_ts || row.updated_at };
  }
  return null;
}

async function fromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const url =
    `${SUPABASE_URL}/rest/v1/mtr_market_data` +
    `?segment=eq.rx_MAE&symbol=like.CAARS*` +
    `&select=symbol,last,bid,ask,settlement,reference,last_ts,settlement_ts,reference_ts,updated_at`;
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (SUPABASE_ANON_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const nowMs = Date.now();
  const out = [];
  let mostRecentAsOf = null;
  let oneDSource = null;

  for (const row of rows) {
    const plazo = plazoFromSymbol(row.symbol);
    if (!plazo) continue;
    const picked = pickRate(row, nowMs);
    if (!picked) continue;

    if (plazo.plazoNum === 1) oneDSource = picked.source;
    if (picked.asOf && (!mostRecentAsOf || picked.asOf > mostRecentAsOf)) mostRecentAsOf = picked.asOf;

    // Shape compatible con extractCaucion1d (campos que el parser mira:
    // moneda, codigoPlazo/plazo, ultimatasa/tasaPP, volumenAcumulado).
    out.push({
      moneda: "ARS",
      plazo: String(plazo.plazoNum),
      codigoPlazo: plazo.codigoPlazo,
      ultimatasa: picked.rate,
      tasaPP: picked.rate,
      volumenAcumulado: null,
      // Extras informativos (el parser los ignora; utiles para debug/UI):
      _source: picked.source,
      _asOf: picked.asOf,
    });
  }

  if (out.length === 0) return null;
  out.sort((a, b) => parseInt(a.codigoPlazo, 10) - parseInt(b.codigoPlazo, 10));
  return { data: out, asOf: mostRecentAsOf, oneDSource };
}

function fromSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
  const snapshot = JSON.parse(raw);
  const cauEntry = snapshot?.endpoints?.cauciones;
  if (!cauEntry || !cauEntry.ok || !Array.isArray(cauEntry.data)) return null;
  return { data: cauEntry.data, generatedAt: snapshot.generatedAt, fetchedAt: cauEntry.fetchedAt };
}

export default async function handler(req, res) {
  try {
    // 1) Fuente preferida: Supabase (live via worker mtr-market-data).
    let live = null;
    try {
      live = await fromSupabase();
    } catch (e) {
      console.warn("a3-cauciones supabase fail:", e.message);
    }

    if (live) {
      // Cache corto: la tasa cambia intra-dia durante la rueda.
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      res.setHeader("X-Caucion-Source", `mtr_market_data:${live.oneDSource || "?"}`);
      if (live.asOf) res.setHeader("X-Caucion-AsOf", live.asOf);
      return res.status(200).json(live.data);
    }

    // 2) Fallback: snapshot estatico (red de seguridad).
    let snap = null;
    try {
      snap = fromSnapshot();
    } catch (e) {
      console.warn("a3-cauciones snapshot fail:", e.message);
    }
    if (snap) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      res.setHeader("X-Caucion-Source", "snapshot");
      res.setHeader("X-Snapshot-Generated-At", snap.generatedAt || "");
      res.setHeader("X-Snapshot-Fetched-At", snap.fetchedAt || "");
      return res.status(200).json(snap.data);
    }

    // 3) Nada disponible: array vacio (el frontend cae a su default).
    res.setHeader("X-Caucion-Source", "none");
    return res.status(200).json([]);
  } catch (error) {
    return res.status(500).json({ error: `Error en /api/a3-cauciones: ${error.message}` });
  }
}
