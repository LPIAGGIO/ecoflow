-- ─────────────────────────────────────────────────────────────────────────
-- Migration 012: futures_daily_adjustments + futures_settlements_history
--
-- Modela los ajustes diarios MTM de futuros ROFEX/A3:
--   - futures_settlements_history: snapshot diario de settlements por
--     ticker (popula cada noche el endpoint /api/snapshot-settlements).
--   - futures_daily_adjustments: ajuste pendiente por posición × día.
--     Cada fila representa "tenés X plata para acreditar en cuenta
--     comitente del día Y". El usuario confirma o edita el monto.
--
-- Cuando confirma, se crea un cash_movement asociado y la fila pasa a
-- status='confirmed'.
-- ─────────────────────────────────────────────────────────────────────────


-- ─── 1) Histórico de settlements ──────────────────────────────────────
-- No tiene user_id porque los settlements de mercado son públicos. Una
-- sola fila por ticker × fecha sirve a todos los usuarios.
CREATE TABLE IF NOT EXISTS public.futures_settlements_history (
  ticker      TEXT        NOT NULL,
  settle_date DATE        NOT NULL,
  settlement  NUMERIC     NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, settle_date)
);

CREATE INDEX IF NOT EXISTS idx_settlements_ticker_date
  ON public.futures_settlements_history (ticker, settle_date DESC);

-- Acceso de lectura para todos los usuarios autenticados.
-- Inserción/update solo desde el backend (con service_role).
ALTER TABLE public.futures_settlements_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlements_read_all_authenticated"
  ON public.futures_settlements_history;
CREATE POLICY "settlements_read_all_authenticated"
  ON public.futures_settlements_history
  FOR SELECT
  TO authenticated
  USING (true);


-- ─── 2) Ajustes pendientes por posición × día ─────────────────────────
CREATE TABLE IF NOT EXISTS public.futures_daily_adjustments (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id      UUID         NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  ticker           TEXT         NOT NULL,
  adjustment_date  DATE         NOT NULL,                                  -- fecha del cierre que generó el ajuste
  prev_settle      NUMERIC      NOT NULL,                                  -- settlement de adjustment_date - 1 (o entry_price si es el primer día)
  curr_settle      NUMERIC      NOT NULL,                                  -- settlement de adjustment_date
  net_qty          NUMERIC      NOT NULL,                                  -- cantidad neta signed (+ long, - short)
  multiplier       NUMERIC      NOT NULL DEFAULT 1000,
  estimated_amount NUMERIC      NOT NULL,                                  -- (curr - prev) × net_qty × multiplier
  actual_amount    NUMERIC,                                                -- lo que el usuario confirma (puede diferir del estimado)
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','confirmed','skipped')),
  confirmed_at     TIMESTAMPTZ,
  cash_movement_id UUID         REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Una posición tiene UN solo ajuste por fecha. Si el usuario salta y
  -- quiere recrear, primero borra el viejo.
  CONSTRAINT futures_daily_adjustments_unique_per_day
    UNIQUE (position_id, adjustment_date)
);

CREATE INDEX IF NOT EXISTS idx_adjustments_user_status
  ON public.futures_daily_adjustments (user_id, status);

CREATE INDEX IF NOT EXISTS idx_adjustments_position_date
  ON public.futures_daily_adjustments (position_id, adjustment_date DESC);

-- RLS: cada usuario ve y modifica solo sus propios ajustes.
ALTER TABLE public.futures_daily_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adjustments_owner_full"
  ON public.futures_daily_adjustments;
CREATE POLICY "adjustments_owner_full"
  ON public.futures_daily_adjustments
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─── 3) Trigger para updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_adjustments_updated_at
  ON public.futures_daily_adjustments;
CREATE TRIGGER trg_adjustments_updated_at
  BEFORE UPDATE ON public.futures_daily_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
