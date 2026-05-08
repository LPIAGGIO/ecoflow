// Serverless: captura el boletín final de MAE del último día hábil
// publicado y lo persiste en mae_boletin_history.
//
// Diseñado para ser invocado por Vercel Cron diariamente post-cierre
// de mercado AR (sugerido: 22:00 UTC = 19:00 AR). MAE típicamente
// publica el boletín alrededor de las 18:00 AR.
//
// FLUJO:
//   1. Determina la fecha objetivo (último día hábil <= hoy AR).
//   2. Si ya existe data para esa fecha → no re-procesa.
//   3. Pega contra MAE /boletin/ReporteResumenFinal?fecha=...
//   4. Para cada título en cada segmento, hace upsert en
//      mae_boletin_history (ticker_full, fecha) → datos.
//   5. Devuelve summary con métricas: captured, skipped, errors,
//      duration, fecha procesada.
//
// AUTH:
//   - CRON_SECRET (Bearer auth). Misma key que snapshot-settlements.
//   - MAE_API_KEY para llamar a MAE.
//   - SUPABASE_SERVICE_ROLE_KEY para bypass de RLS al hacer upsert.
//
// IDEMPOTENCIA: re-correr el cron N veces para la misma fecha es
// seguro porque el upsert usa ON CONFLICT (ticker_full, fecha).

import { createClient } from "@supabase/supabase-js";

const MAE_BASE = "https://api.mae.com.ar/MarketData/v1";
const MAE_API_KEY = process.env.MAE_API_KEY;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Calcula la última fecha de día hábil <= hoy AR (formato YYYY-MM-DD).
 * Retrocede a viernes si hoy es sábado/domingo.
 *
 * Si querés capturar boletín de fechas previas (backfill manual),
 * pasale ?fecha=YYYY-MM-DD al endpoint.
 */
function lastBusinessDayAR() {
  const now = new Date();
  const arStr = now.toLocaleString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
  });
  const [datePart] = arStr.split(", ");
  const d = new Date(`${datePart}T00:00:00`);

  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }

  return d.toISOString().split("T")[0];
}

/**
 * Extrae el ticker base de "AL30/24hs" → "AL30", "AL30C/CI" → "AL30C".
 * Mantiene los sufijos D/C que indican plaza (MEP, CCL).
 */
function extractTicker(tickerFull) {
  if (!tickerFull) return null;
  const slashIdx = tickerFull.indexOf("/");
  return slashIdx > 0 ? tickerFull.slice(0, slashIdx) : tickerFull;
}

export default async function handler(req, res) {
  const t0 = Date.now();

  // ─── Auth ───────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!MAE_API_KEY) {
    return res.status(500).json({ error: "MAE_API_KEY no configurada" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en env.",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── Determinar fecha objetivo ──────────────────────────
  const targetDate = req.query?.fecha || lastBusinessDayAR();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return res.status(400).json({
      error: "fecha debe tener formato YYYY-MM-DD",
      received: targetDate,
    });
  }

  const summary = {
    target_date: targetDate,
    segments_total: 0,
    titulos_total: 0,
    captured: 0,
    skipped: 0,
    errors: 0,
    duration_ms: 0,
    details_errors: [],
  };

  try {
    // ─── Fetch MAE ────────────────────────────────────────
    const url = `${MAE_BASE}/mercado/boletin/ReporteResumenFinal?fecha=${targetDate}`;
    const r = await fetch(url, {
      headers: { "x-api-key": MAE_API_KEY },
    });

    if (!r.ok) {
      summary.errors = 1;
      summary.duration_ms = Date.now() - t0;
      console.error(`[snapshot-mae-boletin] MAE devolvió ${r.status} para fecha=${targetDate}`);
      return res.status(502).json({
        ok: false,
        error: `MAE devolvió ${r.status}`,
        summary,
      });
    }

    const json = await r.json();

    // Si MAE devuelve segmento vacío significa que ese día no se publicó
    // boletín (probable: día no hábil o aún muy temprano). Reportamos OK
    // pero sin data.
    if (!json?.segmento || json.segmento.length === 0) {
      summary.duration_ms = Date.now() - t0;
      console.info(`[snapshot-mae-boletin] fecha=${targetDate}: boletín vacío (sin publicar todavía o día no hábil)`);
      return res.status(200).json({
        ok: true,
        summary,
        message: "Boletín vacío para esa fecha",
      });
    }

    summary.segments_total = json.segmento.length;

    // ─── Procesar cada título ─────────────────────────────
    const rowsToUpsert = [];

    for (const segmento of json.segmento) {
      const segCodigo = segmento.segmentoCodigo || null;
      const titulos = segmento.titulos || [];
      summary.titulos_total += titulos.length;

      for (const t of titulos) {
        const tickerFull = (t.ticker || "").trim();
        if (!tickerFull) {
          summary.skipped++;
          continue;
        }

        const ticker = extractTicker(tickerFull);
        if (!ticker) {
          summary.skipped++;
          continue;
        }

        rowsToUpsert.push({
          ticker,
          ticker_full: tickerFull,
          fecha: targetDate,
          plazo: t.plazo || "",
          cupon: t.cupon || null,
          moneda_codigo: t.monedaCodigo || "$",
          segmento_codigo: segCodigo,
          cantidad: t.cantidad ?? null,
          monto: t.monto ?? null,
          precio_promedio_ponderado: t.precioPromedioPonderado ?? null,
          precio_cierre_ayer: t.precioCierreAyer ?? null,
          precio_cierre_hoy: t.precioCierreHoy ?? null,
          precio_ultimo: t.precioUltimo ?? null,
          variacion: t.variacion ?? null,
          precio_minimo: t.precioMinimo ?? null,
          precio_maximo: t.precioMaximo ?? null,
          raw_payload: t,
        });
      }
    }

    // ─── Upsert en lotes ──────────────────────────────────
    // Supabase tiene límite de payload, así que hacemos en lotes de 500.
    const BATCH_SIZE = 500;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
      const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("mae_boletin_history")
        .upsert(batch, { onConflict: "ticker_full,fecha" });

      if (error) {
        summary.errors += batch.length;
        summary.details_errors.push({
          batch_start: i,
          batch_size: batch.length,
          error: error.message,
        });
        console.error(`[snapshot-mae-boletin] Error upsert batch ${i}:`, error);
      } else {
        summary.captured += batch.length;
      }
    }

    summary.duration_ms = Date.now() - t0;
    console.info(
      `[snapshot-mae-boletin] OK fecha=${targetDate} ` +
      `captured=${summary.captured} segments=${summary.segments_total} ` +
      `duration=${summary.duration_ms}ms`
    );

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    summary.errors = 1;
    summary.duration_ms = Date.now() - t0;
    summary.details_errors.push({ error: err.message });
    console.error(`[snapshot-mae-boletin] Excepción:`, err);
    return res.status(500).json({
      ok: false,
      error: err.message,
      summary,
    });
  }
}
