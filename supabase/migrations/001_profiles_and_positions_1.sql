-- ============================================================================
-- EcoFlow — Migration 001: profiles + positions
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar todo → Run
--
-- Crea las dos tablas core del módulo Portfolio IA:
--   * profiles  — metadata extra del usuario (linkeado a auth.users)
--   * positions — cada fila es una posición de cartera del usuario
--
-- Setup de seguridad:
--   * RLS habilitado en ambas tablas
--   * Cada usuario SOLO puede ver/editar sus propias filas
--   * El service_role (backend Supabase) puede leer todo (para triggers)
--
-- Cómo se popula:
--   * profiles se crea automáticamente cuando un user se registra
--     (vía trigger handle_new_user)
--   * positions se crea/edita desde el frontend con el cliente Supabase
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. TABLA PROFILES
-- ─────────────────────────────────────────────────────────────────────────
-- Espejo de auth.users con info que nosotros queremos editar/extender.
-- Mantenemos el mismo UUID que auth.users para que sea trivial joinear.

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  last_login_at timestamptz default now()
);

comment on table public.profiles is
  'Metadata de usuario, sincronizada con auth.users vía trigger.';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. TABLA POSITIONS
-- ─────────────────────────────────────────────────────────────────────────
-- Cada fila = una posición individual del usuario.
-- Diseño flexible para soportar todos los tipos de instrumento (bonos,
-- futuros, cauciones, acciones, CEDEARs, opciones, USD, cripto, etc.)
-- sin tener que tocar el schema cada vez que sumamos un tipo.
--
-- Uso de fields:
--   * instrument_type  → enum string (ver constraint check abajo)
--   * ticker           → identificador del instrumento (ej. "T30J6", "DLR052026")
--   * quantity         → cantidad. Para bonos: VN. Para futuros: contratos.
--                        Para USD: monto en USD. Para acciones: nominales.
--                        Negativo = posición vendida (futuros, opciones).
--   * entry_price      → precio de compra/venta en moneda de cotización
--   * entry_currency   → ARS / USD / USD-CCL / USD-MEP
--   * entry_date       → fecha de la operación
--   * notes            → texto libre, opcional
--   * extra            → JSONB para campos específicos por tipo
--                        (ej. tasa para cauciones, strike para opciones)

create table public.positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Identificación del instrumento
  instrument_type text not null check (instrument_type in (
    'bond_ars',          -- Bonos en pesos (Lecap, Boncap, Bonares ARS)
    'bond_usd',          -- Bonos en dólares (AL30, GD30, etc.)
    'on',                -- Obligaciones Negociables
    'stock',             -- Acciones argentinas
    'cedear',            -- CEDEARs
    'future',            -- Futuros (DLR, RFX20, etc.)
    'option',            -- Opciones (calls/puts)
    'caucion',           -- Cauciones (colocadas o tomadas)
    'fci',               -- FCI / Fondos Comunes de Inversión
    'usd',               -- USD físico / MEP / CCL
    'crypto'             -- Criptomonedas (BTC, USDT, USDC, ETH, etc.)
  )),
  ticker text not null,

  -- Magnitudes
  quantity numeric not null,                    -- VN, contratos, USD, nominales...
  entry_price numeric,                          -- precio de entrada (puede ser null si no aplica, ej. caucion)
  entry_currency text default 'ARS' check (entry_currency in (
    'ARS', 'USD', 'USD-MEP', 'USD-CCL', 'USD-Blue'
  )),
  entry_date date,

  -- Metadata libre
  notes text,
  extra jsonb default '{}'::jsonb,
    -- Ejemplos de extra:
    --   caucion:   { "rate_tna": 32.5, "term_days": 1, "is_taken": false }
    --   option:    { "strike": 1500, "expiry": "2026-06-30", "type": "call" }
    --   future:    { "contract_size": 1000 }   -- DLR = 1000 USD
    --   crypto:    { "wallet": "binance" }

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.positions is
  'Posiciones individuales en la cartera del usuario. Una fila por compra/venta.';

-- Índice principal: queries por usuario
create index positions_user_id_idx on public.positions(user_id);
-- Índice secundario: filtrar por tipo dentro del usuario
create index positions_user_type_idx on public.positions(user_id, instrument_type);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────
-- Sin RLS, cualquier usuario logueado podría leer/modificar las posiciones
-- de cualquier otro. Las políticas garantizan aislamiento por user_id.

-- Habilitar RLS
alter table public.profiles enable row level security;
alter table public.positions enable row level security;

-- ─── Policies para PROFILES ───
-- Un user puede leer su propio profile
create policy "users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Un user puede actualizar su propio profile (display_name, etc.)
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- INSERT lo hace el trigger handle_new_user (con privilegios elevados)
-- DELETE no lo permitimos desde el cliente — si querés borrar la cuenta,
-- se hace borrando auth.users y cascadea automáticamente.

-- ─── Policies para POSITIONS ───
-- Un user puede ver sus propias posiciones
create policy "users can view own positions"
  on public.positions for select
  using (auth.uid() = user_id);

-- Un user puede crear posiciones para sí mismo
create policy "users can insert own positions"
  on public.positions for insert
  with check (auth.uid() = user_id);

-- Un user puede actualizar sus propias posiciones
create policy "users can update own positions"
  on public.positions for update
  using (auth.uid() = user_id);

-- Un user puede borrar sus propias posiciones
create policy "users can delete own positions"
  on public.positions for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: crear profile al registrar un user nuevo
-- ─────────────────────────────────────────────────────────────────────────
-- Cuando un usuario se loguea por primera vez con Google, Supabase crea
-- una fila en auth.users automáticamente. Este trigger captura ese evento
-- y crea la fila correspondiente en public.profiles, con los datos que
-- vienen del provider OAuth (nombre, avatar, email).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer  -- corre con privilegios del owner para saltar RLS
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );
  return new;
end;
$$;

-- Ejecuta handle_new_user después de cada INSERT en auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER: actualizar updated_at automáticamente
-- ─────────────────────────────────────────────────────────────────────────
-- Cuando se modifica una fila, se setea updated_at = now() automáticamente.
-- Útil para auditar y para cache busting en el frontend.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_positions
  before update on public.positions
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRATION 001
-- ─────────────────────────────────────────────────────────────────────────
-- Para verificar que se aplicó correctamente, ejecutar:
--
--   select tablename from pg_tables where schemaname = 'public';
--     -- Debería listar: profiles, positions
--
--   select tgname from pg_trigger where tgname = 'on_auth_user_created';
--     -- Debería devolver una fila
--
-- Para crear el profile de tu usuario actual (que ya existía antes del
-- trigger), ejecutar manualmente:
--
--   insert into public.profiles (id, email, display_name, avatar_url)
--   select id, email,
--     coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
--     coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
--   from auth.users
--   on conflict (id) do nothing;
-- ============================================================================
