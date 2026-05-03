-- ============================================================================
-- EcoFlow — Migration 004: catálogo de instrumentos refrescado periódicamente
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar todo → Run
--
-- Crea la tabla `instruments` que actúa como cache local del catálogo de
-- tickers consultado a data912.com. El refresh corre vía /api/refresh-
-- instruments (Vercel serverless), idealmente 1 vez por día post-cierre.
--
-- Cobertura: stock, cedear, bond_usd, on. Bonos ARS y futuros DLR siguen
-- hardcoded en src/bondMaturities.js y src/dlrContracts.js porque tienen
-- metadata específica que data912 no provee.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabla principal: catálogo de instrumentos
-- ─────────────────────────────────────────────────────────────────────────
-- PK compuesta (instrument_type, ticker) porque el mismo ticker podría
-- existir en otra categoría en teoría (poco probable pero la PK lo
-- modela explícito y deja la puerta abierta).
--
-- metadata JSONB queda preparado para enriquecer con ratio CEDEAR, sector,
-- maturityDate de bonos USD, etc. cuando consigamos otra fuente. Por
-- ahora data912 solo da el symbol, así que arranca vacío.

create table public.instruments (
  ticker             text         not null,
  instrument_type    text         not null
    check (instrument_type in ('stock', 'cedear', 'bond_usd', 'on')),
  description        text,
  metadata           jsonb        not null default '{}'::jsonb,
  last_refreshed_at  timestamptz  not null default now(),
  primary key (instrument_type, ticker)
);

comment on table public.instruments is
  'Catálogo de tickers refrescado periódicamente desde data912.com (~1 vez al día).';

comment on column public.instruments.metadata is
  'JSON libre para enriquecimiento futuro (ratio CEDEAR, sector, maturityDate, etc.).';

comment on column public.instruments.last_refreshed_at is
  'Última vez que data912 confirmó este ticker. Tickers no vistos durante mucho tiempo pueden depurarse manualmente.';


-- Index para queries por tipo (ej. "dame todos los CEDEARs ordenados por ticker")
create index instruments_type_ticker_idx
  on public.instruments(instrument_type, ticker);


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tabla de auditoría: log de refreshes
-- ─────────────────────────────────────────────────────────────────────────
-- Cada vez que /api/refresh-instruments corre, deja una fila acá. Sirve
-- para:
--   * Saber cuándo fue el último refresh exitoso (lazy on-demand chequea
--     esto para decidir si vale la pena llamar a data912 o no)
--   * Monitorear si data912 tiene caídas frecuentes
--   * Debug si algún día el catálogo aparece raro

create table public.instruments_refresh_log (
  id               bigserial    primary key,
  source           text         not null,                        -- 'data912'
  records_updated  integer      not null default 0,
  status           text         not null
    check (status in ('ok', 'partial', 'error')),
  error_message    text,
  ran_at           timestamptz  not null default now()
);

comment on table public.instruments_refresh_log is
  'Auditoría de cada ejecución del refresh del catálogo (1 fila por corrida).';

create index instruments_refresh_log_ran_at_idx
  on public.instruments_refresh_log(ran_at desc);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — lectura abierta a usuarios autenticados, escritura solo backend
-- ─────────────────────────────────────────────────────────────────────────
-- El catálogo es info pública (tickers que se operan en BYMA), así que
-- cualquier user logueado lo lee sin restricción. La escritura la hace
-- /api/refresh-instruments con la service_role_key (que bypasea RLS),
-- así que NO hace falta policy de INSERT/UPDATE para usuarios normales.

alter table public.instruments enable row level security;
alter table public.instruments_refresh_log enable row level security;

create policy "instruments_select_authenticated"
  on public.instruments for select
  to authenticated
  using (true);

create policy "instruments_refresh_log_select_authenticated"
  on public.instruments_refresh_log for select
  to authenticated
  using (true);


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Grants
-- ─────────────────────────────────────────────────────────────────────────
-- Sin esto las RLS policies no alcanzan: las tablas creadas por SQL puro
-- no tienen grants automáticos al rol authenticated. (Mismo issue que
-- resolvió la migration 003 para positions.)

grant select on public.instruments to authenticated;
grant select on public.instruments_refresh_log to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRATION 004
-- ─────────────────────────────────────────────────────────────────────────
-- Para verificar que se aplicó:
--
--   select count(*) from public.instruments;
--   -- 0 filas (el endpoint /api/refresh-instruments las popula)
--
--   \d public.instruments
--   -- debería listar la PK compuesta y la columna metadata jsonb
--
-- Después de aplicar:
--   1. Setear env vars en Vercel:
--        SUPABASE_URL              = https://utcltvmhpmlgolzyzkvl.supabase.co
--        SUPABASE_SERVICE_ROLE_KEY = (Settings → API → service_role secret)
--        CRON_SECRET               = (string aleatorio largo)
--   2. Deploy.
--   3. Disparar primer refresh manualmente:
--        curl -X POST https://ecoflow-bay.vercel.app/api/refresh-instruments \
--             -H "Authorization: Bearer $CRON_SECRET"
--   4. Verificar:
--        select instrument_type, count(*)
--        from public.instruments
--        group by instrument_type;
-- ============================================================================
