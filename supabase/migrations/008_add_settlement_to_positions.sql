-- ============================================================================
-- Migración 008 — Agregar plazo de liquidación a positions
--
-- Contexto:
--   En el mercado argentino retail (Balanz, Cocos, IOL, etc.) cada operación
--   se carga con un plazo de liquidación: CI (Contado Inmediato, mismo día)
--   o T1 (24hs hábiles). Esto determina cuándo el cash de la operación se
--   acredita o debita efectivamente en la cuenta del comitente.
--
-- Decisiones:
--   - Default 'CI': es lo más común en retail.
--   - NOT NULL: toda operación tiene siempre un plazo.
--   - CHECK constraint: solo 'CI' o 'T1'. Hoy no existe T2 en mercado AR.
--
-- Las operaciones existentes (cargadas antes de esta migración) se setean
-- todas como CI por default. Si querés ajustar alguna a T1 después, lo
-- hacés desde la UI editando la operación.
-- ============================================================================

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS settlement TEXT NOT NULL DEFAULT 'CI';

ALTER TABLE positions
  ADD CONSTRAINT positions_settlement_check
  CHECK (settlement IN ('CI', 'T1'));

-- Verificación rápida (opcional, podés correrlo después):
-- SELECT settlement, COUNT(*) FROM positions GROUP BY settlement;
