-- ─────────────────────────────────────────────────────────────────────────
-- Fix permisos: garantizar que el rol service_role pueda escribir
-- en futures_settlements_history y futures_daily_adjustments.
--
-- El service_role debería bypasear RLS automáticamente, pero requiere
-- que existan grants explícitos a nivel tabla. Si la migración 012 no
-- los aplicó por algún motivo, este patch los garantiza.
-- ─────────────────────────────────────────────────────────────────────────

-- Permisos al rol service_role para ambas tablas.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.futures_settlements_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.futures_daily_adjustments    TO service_role;

-- Para tablas con secuencias autogeneradas (no aplica acá pero
-- por si más adelante usamos algo con SERIAL):
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Agregamos también una policy de INSERT/UPDATE para service_role en
-- settlements_history. service_role debería bypasear RLS, pero algunas
-- versiones de Supabase requieren la policy explícita.
DROP POLICY IF EXISTS "settlements_service_role_write"
  ON public.futures_settlements_history;
CREATE POLICY "settlements_service_role_write"
  ON public.futures_settlements_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verificar que el authenticated tiene SELECT
GRANT SELECT ON public.futures_settlements_history TO authenticated;
