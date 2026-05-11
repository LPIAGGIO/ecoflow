-- ============================================================================
-- Migración 011 — Backfill de cash_movements para futuros ya cerrados
--
-- Propósito:
--   La migración 010 inyectó movements para todas las compras/ventas de
--   bonos/stocks/cedears/on. PERO excluyó futuros porque la lógica del
--   cash de futuros es distinta (P&L del par cerrado, no qty × price).
--
--   Ahora que el frontend genera cash_movements automáticos al cerrar
--   pares de futuros (sale_proceeds o purchase_cost por el P&L), este
--   script crea retroactivamente los movements de los pares ya cerrados
--   ANTES de que esta lógica existiera.
--
--   Para tu cartera, esto debería generar un movement por DLRJUN26
--   (+$796.000 aprox) y nada para DLRMAY26 (que está abierto, sin
--   ventas que se hayan cerrado contra compras previas).
--
-- Lógica:
--   Por cada ticker × user, ordenamos las operaciones cronológicamente
--   y por cada VENTA calculamos el P&L del par contra el PPP del
--   momento, igual que hace computeFuturePnLForSell() en el frontend.
--   Insertamos un movement en ARS con fecha = entry_date_venta + 1 día
--   hábil aproximado (acá usamos +1 día calendario, no +1 hábil, para
--   simplificar — la diferencia es de 0 a 2 días, ajustable si querés
--   precisión BYMA).
--
-- Idempotencia:
--   Skip las ventas que ya tienen un cash_movement asociado (por
--   related_position_id).
--
-- Multiplicador:
--   Hardcoded en 1000 (DLR estándar). Si tenés otros futuros con
--   multiplicadores distintos, ajustar la constante.
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  cum_qty NUMERIC := 0;
  cum_value NUMERIC := 0;
  ppp NUMERIC;
  consumed NUMERIC;
  pnl NUMERIC;
  movement_t TEXT;
  amount_abs NUMERIC;
  prev_user UUID := NULL;
  prev_ticker TEXT := NULL;
  FUTURE_MULT CONSTANT NUMERIC := 1000;
BEGIN
  -- Iteramos por user × ticker, ordenado cronológicamente
  FOR rec IN
    SELECT
      p.id, p.user_id, p.ticker, p.operation_type, p.quantity, p.entry_price,
      p.entry_date, p.created_at
    FROM positions p
    WHERE p.instrument_type = 'future'
      AND p.entry_price IS NOT NULL AND p.entry_price > 0
      AND p.quantity > 0
    ORDER BY p.user_id, p.ticker, p.entry_date NULLS LAST, p.created_at
  LOOP
    -- Reset de acumuladores cuando cambia el grupo (user × ticker)
    IF prev_user IS DISTINCT FROM rec.user_id OR prev_ticker IS DISTINCT FROM rec.ticker THEN
      cum_qty := 0;
      cum_value := 0;
      prev_user := rec.user_id;
      prev_ticker := rec.ticker;
    END IF;

    IF rec.operation_type = 'sell' THEN
      -- Solo procesamos si hay compras previas (no short)
      IF cum_qty > 0 THEN
        ppp := cum_value / cum_qty;
        consumed := LEAST(rec.quantity, cum_qty);
        pnl := consumed * FUTURE_MULT * (rec.entry_price - ppp);

        -- Solo insertamos si no existe ya un movement para esta position
        IF NOT EXISTS (
          SELECT 1 FROM cash_movements cm WHERE cm.related_position_id = rec.id
        ) THEN
          IF pnl >= 0 THEN
            movement_t := 'sale_proceeds';
            amount_abs := pnl;
          ELSE
            movement_t := 'purchase_cost';
            amount_abs := -pnl;
          END IF;

          -- Solo insertamos si el monto no es cero (evita filas inútiles)
          IF amount_abs > 0 THEN
            INSERT INTO cash_movements (
              user_id, movement_date, movement_type, currency, amount,
              related_position_id, notes
            ) VALUES (
              rec.user_id,
              -- T+1: usamos +1 día calendario por simplicidad (frontend usa
              -- +1 día hábil con feriados BYMA, aquí preferimos ser conservador
              -- y no replicar esa lógica en SQL puro)
              COALESCE(rec.entry_date, rec.created_at::date) + INTERVAL '1 day',
              movement_t,
              'ARS',
              amount_abs,
              rec.id,
              'Backfill futuro: P&L cierre par ' || rec.ticker
            );
          END IF;
        END IF;

        -- Decrementar el lote consumido
        cum_qty := cum_qty - consumed;
        cum_value := cum_value - consumed * ppp;
      END IF;
      -- Si era short puro (sin compras previas), no hacemos nada
    ELSE
      -- Compra: acumula al lote
      cum_qty := cum_qty + rec.quantity;
      cum_value := cum_value + rec.quantity * rec.entry_price;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Verificación post-migración (correr manual después)
--
--   SELECT
--     ticker_from_position.ticker AS ticker,
--     cm.movement_date,
--     cm.movement_type,
--     cm.amount,
--     cm.notes
--   FROM cash_movements cm
--   JOIN positions ticker_from_position
--     ON ticker_from_position.id = cm.related_position_id
--   WHERE cm.notes LIKE 'Backfill futuro%'
--     AND cm.user_id = auth.uid()
--   ORDER BY cm.movement_date DESC;
--
-- Saldo ARS post-backfill:
--   SELECT SUM(
--     CASE
--       WHEN movement_type IN ('deposit','sale_proceeds') THEN amount
--       ELSE -amount
--     END
--   ) AS saldo_ars
--   FROM cash_movements
--   WHERE user_id = auth.uid() AND currency = 'ARS';
-- ============================================================================
