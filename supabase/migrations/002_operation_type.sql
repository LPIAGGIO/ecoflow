-- ============================================================================
-- EcoFlow — Migration 002: agregar operation_type a positions
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar todo → Run
--
-- Ajusta el modelo de positions para soportar:
--   * Cada compra/venta como una fila independiente (modelo "transacciones")
--   * Campo operation_type explícito (buy / sell) en lugar de cantidad negativa
--
-- La cantidad neta de un ticker se calcula sumando buys y restando sells.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Agregar columna operation_type
-- ─────────────────────────────────────────────────────────────────────────
-- Por defecto 'buy' — es lo que cubre el ~95% de las cargas iniciales.
-- not null garantiza que toda fila futura tenga el dato.

alter table public.positions
  add column operation_type text not null default 'buy'
  check (operation_type in ('buy', 'sell'));

comment on column public.positions.operation_type is
  'Tipo de operación: buy (compra/colocación) o sell (venta/toma).';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Índice para queries por operación
-- ─────────────────────────────────────────────────────────────────────────
-- Cuando consolidamos la cartera, queremos sumar buys y restar sells
-- agrupando por ticker. Este índice acelera ese tipo de queries.

create index positions_user_ticker_idx
  on public.positions(user_id, ticker, operation_type);


-- ─────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRATION 002
-- ─────────────────────────────────────────────────────────────────────────
-- Para verificar que se aplicó:
--
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'positions'
--     and column_name = 'operation_type';
--   -- debería devolver una fila con default 'buy'
-- ============================================================================
