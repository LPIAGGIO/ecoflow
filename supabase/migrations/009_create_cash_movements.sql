-- ============================================================================
-- Migración 009 — Crear tabla cash_movements
--
-- Propósito:
--   Trackear el saldo en efectivo del comitente por moneda. El saldo NO se
--   persiste como columna en ninguna tabla — se calcula siempre del log de
--   movements (sum de amounts firmados). Eso garantiza consistencia: si una
--   operación se borra, el cash asociado también desaparece (cascade) y
--   el saldo se ajusta solo.
--
-- Tipos de movimiento:
--   - deposit          : depósito manual (ingresá $X desde tu banco)
--   - withdrawal       : retiro manual (sacá $X a tu banco)
--   - sale_proceeds    : cash recibido por una venta (auto, asociado a una position)
--   - purchase_cost    : cash pagado por una compra (auto, asociado a una position)
--
--   Más adelante podemos agregar 'coupon_payment', 'amortization', 'dividend',
--   'manual_adjustment', etc. Por ahora arrancamos con estos 4.
--
-- Convención de signos:
--   amount es SIEMPRE positivo. El signo efectivo lo determina movement_type:
--     deposit, sale_proceeds            → +amount (suma al saldo)
--     withdrawal, purchase_cost         → -amount (resta del saldo)
--   Esto evita confusión al leer los datos crudos de la tabla.
--
-- movement_date:
--   Fecha en la que el cash efectivamente impacta el saldo.
--     - Para deposit/withdrawal: la fecha del movimiento real (la elegís en UI).
--     - Para sale_proceeds/purchase_cost: depende del settlement de la position
--         CI → entry_date
--         T1 → entry_date + 1 día hábil
--   El cálculo del +1 día hábil lo hacemos en frontend al insertar (no es trivial
--   en SQL puro porque requiere conocer feriados argentinos). Por ahora
--   usaremos +1 día calendario; si cae sábado/domingo lo movemos a lunes.
--
-- currency:
--   3 valores válidos: 'ARS' | 'USD-MEP' | 'USD-CCL'.
--   Para movimientos automáticos se toma de positions.entry_currency.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movement_date       DATE NOT NULL,
  movement_type       TEXT NOT NULL,
  currency            TEXT NOT NULL,
  amount              NUMERIC(20, 4) NOT NULL,
  related_position_id UUID NULL REFERENCES positions(id) ON DELETE CASCADE,
  notes               TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validación de tipos válidos
  CONSTRAINT cash_movements_type_check
    CHECK (movement_type IN ('deposit', 'withdrawal', 'sale_proceeds', 'purchase_cost')),

  -- Validación de monedas válidas
  CONSTRAINT cash_movements_currency_check
    CHECK (currency IN ('ARS', 'USD-MEP', 'USD-CCL')),

  -- amount siempre positivo (el signo lo da movement_type)
  CONSTRAINT cash_movements_amount_positive
    CHECK (amount > 0),

  -- Si es sale_proceeds o purchase_cost, related_position_id debe estar.
  -- Si es deposit o withdrawal, related_position_id debe ser NULL (es manual).
  CONSTRAINT cash_movements_related_position_logic
    CHECK (
      (movement_type IN ('sale_proceeds', 'purchase_cost') AND related_position_id IS NOT NULL)
      OR
      (movement_type IN ('deposit', 'withdrawal') AND related_position_id IS NULL)
    )
);

-- Índice principal: el query más frecuente es "saldo del usuario X en moneda Y a fecha Z"
CREATE INDEX IF NOT EXISTS idx_cash_movements_user_date
  ON cash_movements(user_id, movement_date);

CREATE INDEX IF NOT EXISTS idx_cash_movements_user_currency
  ON cash_movements(user_id, currency);

CREATE INDEX IF NOT EXISTS idx_cash_movements_related_position
  ON cash_movements(related_position_id)
  WHERE related_position_id IS NOT NULL;

-- ============================================================================
-- RLS (Row Level Security)
-- Asumimos el mismo modelo que positions: cada usuario solo ve sus propios
-- movimientos.
-- ============================================================================

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash movements"
  ON cash_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash movements"
  ON cash_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cash movements"
  ON cash_movements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cash movements"
  ON cash_movements FOR DELETE
  USING (auth.uid() = user_id);
