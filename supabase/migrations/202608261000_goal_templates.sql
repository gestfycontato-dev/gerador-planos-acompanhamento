begin;

create type public.goal_direction as enum ('decrease', 'increase', 'target');
create type public.goal_value_type as enum ('number', 'text');

create table public.goal_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_template_items (
  id uuid primary key default gen_random_uuid(),
  goal_template_id uuid not null references public.goal_templates(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  unit text,
  direction public.goal_direction not null,
  value_type public.goal_value_type not null,
  default_current numeric,
  default_target numeric,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.plan_goals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  unit text,
  direction public.goal_direction not null,
  value_type public.goal_value_type not null,
  current_value numeric,
  target_value numeric,
  current_text text,
  target_text text,
  notes text,
  sort_order integer not null default 0,
  source_template_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goal_templates_clinic_idx on public.goal_templates (clinic_id);
create index goal_template_items_template_idx on public.goal_template_items (goal_template_id, sort_order);
create index plan_goals_plan_idx on public.plan_goals (plan_id, sort_order);
create index plan_goals_clinic_idx on public.plan_goals (clinic_id);

create trigger goal_templates_set_updated_at before update on public.goal_templates
for each row execute function public.set_updated_at();
create trigger plan_goals_set_updated_at before update on public.plan_goals
for each row execute function public.set_updated_at();

alter table public.goal_templates enable row level security;
alter table public.goal_template_items enable row level security;
alter table public.plan_goals enable row level security;

create policy goal_templates_member_all on public.goal_templates
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy goal_template_items_select_member on public.goal_template_items
for select to authenticated using (
  exists (
    select 1 from public.goal_templates template
    where template.id = goal_template_id
      and public.is_clinic_member(template.clinic_id)
  )
);
create policy goal_template_items_insert_member on public.goal_template_items
for insert to authenticated with check (
  exists (
    select 1 from public.goal_templates template
    where template.id = goal_template_id
      and public.is_clinic_member(template.clinic_id)
  )
);
create policy goal_template_items_update_member on public.goal_template_items
for update to authenticated using (
  exists (
    select 1 from public.goal_templates template
    where template.id = goal_template_id
      and public.is_clinic_member(template.clinic_id)
  )
) with check (
  exists (
    select 1 from public.goal_templates template
    where template.id = goal_template_id
      and public.is_clinic_member(template.clinic_id)
  )
);
create policy goal_template_items_delete_member on public.goal_template_items
for delete to authenticated using (
  exists (
    select 1 from public.goal_templates template
    where template.id = goal_template_id
      and public.is_clinic_member(template.clinic_id)
  )
);

create policy plan_goals_member_all on public.plan_goals
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

commit;
