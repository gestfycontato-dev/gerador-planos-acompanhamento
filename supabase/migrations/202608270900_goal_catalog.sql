begin;

create type public.goal_catalog_value_type as enum ('integer', 'decimal');

create table public.goal_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  unit text,
  value_type public.goal_catalog_value_type not null,
  decimals integer not null default 0 check (decimals >= 0 and decimals <= 4),
  min_value numeric,
  max_value numeric,
  default_direction public.goal_direction not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create index goal_catalog_active_sort_idx on public.goal_catalog (active, sort_order);

alter table public.goal_catalog enable row level security;

create policy goal_catalog_select_authenticated on public.goal_catalog
for select to authenticated using (active);

-- Sem policy de insert/update/delete: catálogo é global e a escrita fica
-- restrita a quem roda migrações no SQL Editor (admin de plataforma),
-- nunca à aplicação autenticada como clínica.

-- Seed pendente: inserir aqui os 22 indicadores do Anexo A quando chegarem,
-- em uma migração separada (ex.: 202608XXXXXX_goal_catalog_seed.sql).

commit;
