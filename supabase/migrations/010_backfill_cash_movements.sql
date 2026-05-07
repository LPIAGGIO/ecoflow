-- ============================================================================
-- Migración 010 — Backfill retroactivo de cash_movements
--
-- Propósito:
--   Generar los cash_movements correspondientes a todas las operaciones
--   (positions) que ya existen en la base. Cada compra de bono/stock/cedear/on
--   genera un purchase_cost; cada venta genera un sale_proceeds.
--
-- IMPORTANTE — Tipos excluidos del backfill:
--
--   * future, option:
--       Los futuros y opciones NO mueven cash al abrirse (son compromisos).
--       Solo al cierre del par hay un P&L que entra como cash. Por ahora
--       NO inyectamos movements automáticos para estos. Si querés reflejar
--       el P&L de tus futuros DLR ya cerrados, lo cargás manualmente con
--       "Ingresar" en la card TOTAL.
--
--   * caucion, fci:
--       Tienen lógica especial (tomar/colocar caución, suscribir/rescatar FCI)
--       que conviene cargar manualmente al menos en esta primera versión.
--
--   * crypto, usd:
--       Posiciones puras de tenencia que no cambian cash en pesos al cargarlas.
--
-- Tipos INCLUIDOS:
--   bond_ars, bond_usd, on, stock, cedear
--
-- Settlement:
--   Asumimos CI para todas las operaciones existentes (el ALTER TABLE 008 ya
--   las puso en CI por default). movement_date = entry_date.
--
-- Resultado esperado:
--   Vas a ver un saldo cash MUY negativo después de correr esto, porque
--   probablemente tenés muchas compras (T30J6 35M+10M+1M, S29Y6 23M, etc.)
--   sin contrapartida de cash inicial. Eso está bien — al usar la app
--   por primera vez vas a clickear "Ingresar" y poner el saldo inicial
--   con el que arrancaste, lo que va a llevar el saldo a su valor real.
--
-- Idempotencia:
--   Esta migración es SEGURA de correr múltiples veces. Tiene un guard
--   que evita duplicar movements para una position que ya tiene su
--   movement asociado. Si en el futuro cargás operaciones nuevas, NO uses
--   este script: el frontend las inyecta automáticamente al guardar.
-- ============================================================================

-- Insertamos movements solo para positions que aún no tienen uno asociado.
INSERT INTO cash_movements (
  user_id,
  movement_date,
  movement_type,
  currency,
  amount,
  related_position_id,
  notes
)
SELECT
  p.user_id,
  COALESCE(p.entry_date, p.created_at::date)            AS movement_date,
  CASE
    WHEN p.operation_type = 'sell' THEN 'sale_proceeds'
    ELSE 'purchase_cost'
  END                                                    AS movement_type,
  COALESCE(p.entry_currency, 'ARS')                      AS currency,
  -- Cálculo del monto en la moneda nativa del instrumento.
  -- Para bonos / ON: (qty × price) / 100 (porque se cotizan en VN%)
  -- Para acciones / cedears: qty × price
  ABS(
    CASE
      WHEN p.instrument_type IN ('bond_ars', 'bond_usd', 'on') THEN
        (p.quantity * COALESCE(p.entry_price, 0)) / 100
      ELSE
        p.quantity * COALESCE(p.entry_price, 0)
    END
  )                                                       AS amount,
  p.id                                                    AS related_position_id,
  'Backfill automático desde migración 010'              AS notes
FROM positions p
WHERE
  -- Solo tipos que mueven cash al abrir
  p.instrument_type IN ('bond_ars', 'bond_usd', 'on', 'stock', 'cedear')
  -- Que tengan precio (sin precio no podemos calcular el cash)
  AND p.entry_price IS NOT NULL
  AND p.entry_price > 0
  -- Que tengan quantity
  AND p.quantity > 0
  -- Guard de idempotencia: si la position ya tiene un movement, lo salteamos
  AND NOT EXISTS (
    SELECT 1
    FROM cash_movements cm
    WHERE cm.related_position_id = p.id
  );

-- ============================================================================
-- Verificación post-migración (opcional)
--
-- Para ver qué se insertó, ejecutá manual después de la migración:
--
--   SELECT
--     currency,
--     movement_type,
--     COUNT(*) as cantidad,
--     SUM(amount) as total
--   FROM cash_movements
--   WHERE notes LIKE 'Backfill%'
--   GROUP BY currency, movement_type
--   ORDER BY currency, movement_type;
--
-- Y para ver el saldo neto que te quedó:
--
--   SELECT
--     currency,
--     SUM(
--       CASE
--         WHEN movement_type IN ('deposit', 'sale_proceeds') THEN amount
--         WHEN movement_type IN ('withdrawal', 'purchase_cost') THEN -amount
--       END
--     ) AS saldo
--   FROM cash_movements
--   WHERE user_id = auth.uid()
--   GROUP BY currency;
-- ============================================================================
