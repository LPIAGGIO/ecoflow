-- ============================================================
-- 015 - Detector de desarbitraje MEP en soberanos hard-dollar
-- Universo: AL/GD/AE/GE (AL29 AL30 AL35 AL41 AE38 GD30 GD35 GD38 GD41)
-- Fase 1: DETECCION INDICATIVA. NO confirma rulo ejecutable todavia
-- (falta puntas bid/offer + sincronia intradia real). Ver handoff 03/06.
-- Aplicada en prod via MCP el 2026-06-03.
-- ============================================================

-- 1) Vista en vivo: MEP implicito por bono/plazo, deduplicado a la
--    fila mas fresca con last>0. mep = precio_pesos / precio_dolar(D).
create or replace view sovereign_mep_live as
with picks as (
  select distinct on (ticker, plazo, currency)
         ticker, plazo, currency, segment_code, last_price, trade_date, fetched_at
  from prices_cache
  where source = 'mae_rentafija'
    and ticker ~ '^(AL|GD|AE|GE)[0-9]+$'
    and last_price > 0
  order by ticker, plazo, currency, trade_date desc, fetched_at desc
)
select
  p.ticker,
  p.plazo,                                   -- '000'=CI, '001'=24hs
  ars.last_price as p_ars, ars.trade_date as td_ars, ars.fetched_at as fa_ars,
  d.last_price   as p_mep, d.trade_date   as td_mep, d.fetched_at   as fa_mep,
  c.last_price   as p_ccl, c.trade_date   as td_ccl, c.fetched_at   as fa_ccl,
  round(ars.last_price / d.last_price, 4) as mep,
  case when c.last_price > 0 then round(ars.last_price / c.last_price, 4) end as ccl,
  (ars.trade_date = d.trade_date) as patas_mismo_dia,
  least(ars.trade_date, d.trade_date) as min_td
from (select distinct ticker, plazo from picks) p
join picks ars on ars.ticker = p.ticker and ars.plazo = p.plazo and ars.currency = '$'
join picks d   on d.ticker   = p.ticker and d.plazo   = p.plazo and d.currency   = 'D'
left join picks c on c.ticker = p.ticker and c.plazo = p.plazo and c.currency = 'C';

-- 2) Vista de canje: dispersion del MEP entre bonos del mismo plazo.
--    Solo computa sobre patas del mismo dia (lo unico no-ruidoso con EOD).
--    spread_pct = ganancia bruta de vender el bono de MEP alto y comprar
--    el de MEP bajo, ANTES de friccion. OJO: con EOD "mismo dia" != "mismo
--    instante" -> spreads grandes son ruido de asincronia hasta tener
--    snapshot intradia sincronico + puntas.
create or replace view sovereign_mep_canje as
with fresh as (
  select ticker, plazo, mep
  from sovereign_mep_live
  where patas_mismo_dia is true and mep is not null
),
agg as (
  select plazo, min(mep) as mep_min, max(mep) as mep_max, count(*) as n_bonos
  from fresh group by plazo
)
select
  a.plazo,
  a.n_bonos,
  lo.ticker as comprar_pesos_vender_dolar,   -- MEP bajo: dolar barato
  a.mep_min,
  hi.ticker as vender_dolar_caro,            -- MEP alto: dolar caro
  a.mep_max,
  round((a.mep_max / a.mep_min - 1) * 100, 3) as spread_pct
from agg a
join fresh lo on lo.plazo = a.plazo and lo.mep = a.mep_min
join fresh hi on hi.plazo = a.plazo and hi.mep = a.mep_max
where a.n_bonos >= 2;

-- 3) Tabla historica: junta estadistica para el backtest / decision de fondeo.
create table if not exists sovereign_mep_snapshots (
  id              bigint generated always as identity primary key,
  snapshot_at     timestamptz not null default now(),
  ticker          text not null,
  plazo           text not null,
  p_ars           numeric,
  p_mep           numeric,
  p_ccl           numeric,
  mep             numeric,
  ccl             numeric,
  td_ars          date,
  td_mep          date,
  td_ccl          date,
  fa_ars          timestamptz,
  fa_mep          timestamptz,
  fa_ccl          timestamptz,
  patas_mismo_dia boolean
);
create index if not exists idx_smep_snap_at   on sovereign_mep_snapshots (snapshot_at desc);
create index if not exists idx_smep_ticker_at on sovereign_mep_snapshots (ticker, plazo, snapshot_at desc);

alter table sovereign_mep_snapshots enable row level security;
drop policy if exists "public read smep" on sovereign_mep_snapshots;
create policy "public read smep" on sovereign_mep_snapshots for select using (true);
grant select on sovereign_mep_snapshots to anon, authenticated;
grant select on sovereign_mep_live, sovereign_mep_canje to anon, authenticated;

-- 4) RPC: toma una foto del estado actual y la guarda en la tabla.
--    Llamable a mano ahora; despues la engancha un cron/worker.
create or replace function snapshot_sovereign_mep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into sovereign_mep_snapshots
    (ticker,plazo,p_ars,p_mep,p_ccl,mep,ccl,td_ars,td_mep,td_ccl,fa_ars,fa_mep,fa_ccl,patas_mismo_dia)
  select ticker,plazo,p_ars,p_mep,p_ccl,mep,ccl,td_ars,td_mep,td_ccl,fa_ars,fa_mep,fa_ccl,patas_mismo_dia
  from sovereign_mep_live;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function snapshot_sovereign_mep() to anon, authenticated;
