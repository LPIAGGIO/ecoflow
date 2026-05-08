-- ─────────────────────────────────────────────────────────────────────────
-- Migration 014: mae_boletin_history
--
-- Almacena los boletines diarios oficiales de MAE (Mercado Abierto
-- Electrónico). Se popula con un cron diario post-cierre que tira del
-- endpoint /api/mae?type=boletin&fecha=YYYY-MM-DD.
--
-- USOS:
--   - precioCierreAyer oficial para P&L diario preciso (más confiable que
--     derivarlo de pct_change de data912).
--   - Histórico de precios oficiales para snapshots de cartera (Backlog B1).
--   - Dataset para enriquecer instruments con descripciones y plazos.
--   - Base para detector de oportunidades (compara precios MAE vs BYMA).
--
-- DECISIONES DE DISEÑO:
--   - Una fila por (ticker, fecha, plazo). Plazo es parte de la PK porque
--     "AL30/24hs" y "AL30/CI" son operaciones distintas con precios distintos.
--   - segmento_codigo: agrupa por tipo de instrumento (4 = renta fija
--     pesos+dolares según boletín). Útil para queries por segmento.
--   - data pública (no user_id): los precios son del mercado, todos los
--     usuarios los pueden leer. Solo el cron escribe (vía service_role).
--   - JSONB para totales del segmento del día: agregados que no cambian
--     por ticker pero queremos preservar para análisis macro.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mae_boletin_history (
  id                          BIGSERIAL    PRIMARY KEY,
  ticker                      TEXT         NOT NULL,                  -- "AL30", "AE38C", etc. (sin sufijo de plazo)
  ticker_full                 TEXT         NOT NULL,                  -- "AL30/24hs", "AL30C/CI" — tal como viene de MAE
  fecha                       DATE         NOT NULL,
  plazo                       TEXT         NOT NULL,                  -- "000", "001", "002" (días de liquidación)
  cupon                       TEXT,
  moneda_codigo               TEXT         NOT NULL,                  -- "$" (pesos) | "D" (dolares)
  segmento_codigo             TEXT,                                    -- "4" para renta fija, etc.
  cantidad                    NUMERIC,
  monto                       NUMERIC,
  precio_promedio_ponderado   NUMERIC,
  precio_cierre_ayer          NUMERIC,
  precio_cierre_hoy           NUMERIC,
  precio_ultimo               NUMERIC,
  variacion                   NUMERIC,
  precio_minimo               NUMERIC,
  precio_maximo               NUMERIC,
  raw_payload                 JSONB,                                   -- por las dudas, guardamos el objeto completo
  captured_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Una fila única por ticker_full × fecha. Si el cron corre 2 veces
  -- el mismo día, hace upsert sobre esta key.
  CONSTRAINT mae_boletin_unique
    UNIQUE (ticker_full, fecha)
);

-- ─── Índices ─────────────────────────────────────────────────────────
-- Por ticker (sin sufijo) ordenado por fecha — para queries del frontend
-- "dame el precio_cierre_hoy del último día disponible para AL30".
CREATE INDEX IF NOT EXISTS idx_mae_boletin_ticker_fecha
  ON public.mae_boletin_history (ticker, fecha DESC);

-- Por fecha — para snapshots de cartera (mostrar todos los precios de un día).
CREATE INDEX IF NOT EXISTS idx_mae_boletin_fecha
  ON public.mae_boletin_history (fecha DESC);

-- Por moneda — útil para filtrar pesos vs dólares.
CREATE INDEX IF NOT EXISTS idx_mae_boletin_moneda_fecha
  ON public.mae_boletin_history (moneda_codigo, fecha DESC);


-- ─── RLS ──────────────────────────────────────────────────────────────
-- Datos públicos: cualquier usuario autenticado puede leer.
-- Solo el service_role puede escribir (vía cron).
ALTER TABLE public.mae_boletin_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mae_boletin_read_authenticated"
  ON public.mae_boletin_history;
CREATE POLICY "mae_boletin_read_authenticated"
  ON public.mae_boletin_history
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mae_boletin_service_role_write"
  ON public.mae_boletin_history;
CREATE POLICY "mae_boletin_service_role_write"
  ON public.mae_boletin_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.mae_boletin_history
  TO service_role;
GRANT SELECT
  ON public.mae_boletin_history
  TO authenticated;

GRANT USAGE, SELECT
  ON SEQUENCE mae_boletin_history_id_seq
  TO service_role;
