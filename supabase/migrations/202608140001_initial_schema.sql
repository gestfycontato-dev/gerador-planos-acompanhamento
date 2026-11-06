begin;

create extension if not exists pgcrypto;

create type public.patient_gender as enum (
  'Feminino',
  'Masculino',
  'Outro',
  'Prefere não informar'
);

create type public.sale_status as enum (
  'Plano criado',
  'Plano vendido',
  'Plano não vendido'
);

create type public.clinic_role as enum ('doctor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  crm text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  display_name text not null default '',
  legal_name text not null default '',
  cnpj text not null default '',
  phone text not null default '',
  email text not null default '',
  zip_code text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.clinic_role not null default 'doctor',
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  gender public.patient_gender not null default 'Prefere não informar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  normalized_name text not null check (length(trim(normalized_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, normalized_name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discount_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  duration_weeks integer not null check (duration_weeks > 0 and duration_weeks <= 104),
  percent numeric(5,2) not null default 0 check (percent >= 0 and percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, duration_weeks)
);

create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  duration_weeks integer not null check (duration_weeks > 0 and duration_weeks <= 104),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan_templates(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  week_number integer not null check (week_number > 0 and week_number <= 104),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  note text,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  source_template_id uuid references public.plan_templates(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  duration_weeks integer not null check (duration_weeks > 0 and duration_weeks <= 104),
  start_date date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  week_number integer not null check (week_number > 0 and week_number <= 104),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  note text,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid not null unique references public.plans(id) on delete cascade,
  status public.sale_status not null default 'Plano criado',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  total numeric(12,2) not null default 0 check (total >= 0),
  payment_method text not null default '',
  sold_snapshot jsonb,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'Plano vendido' and sold_snapshot is not null and sold_at is not null) or status <> 'Plano vendido')
);

create table public.renewal_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  completed_by uuid not null references public.profiles(id),
  completed_at timestamptz not null default now(),
  notes text,
  unique (plan_id)
);

create index patients_clinic_name_idx on public.patients (clinic_id, name);
create index categories_clinic_idx on public.service_categories (clinic_id);
create index services_clinic_idx on public.services (clinic_id);
create index templates_clinic_updated_idx on public.plan_templates (clinic_id, updated_at desc);
create index template_items_template_week_idx on public.template_items (template_id, week_number);
create index plans_clinic_start_idx on public.plans (clinic_id, start_date);
create index plans_patient_idx on public.plans (patient_id);
create index plan_items_plan_week_idx on public.plan_items (plan_id, week_number);
create index sales_clinic_status_idx on public.sales (clinic_id, status);
create index renewal_contacts_clinic_idx on public.renewal_contacts (clinic_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger clinics_set_updated_at before update on public.clinics
for each row execute function public.set_updated_at();
create trigger patients_set_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.service_categories
for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger discounts_set_updated_at before update on public.discount_rules
for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.plan_templates
for each row execute function public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
for each row execute function public.set_updated_at();
create trigger sales_set_updated_at before update on public.sales
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_clinic_member(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members
    where clinic_id = target_clinic_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.create_clinic_for_current_user(initial_name text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_clinic_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.clinics (created_by, display_name)
  values (current_user_id, coalesce(initial_name, ''))
  returning id into new_clinic_id;

  insert into public.clinic_members (clinic_id, user_id, role)
  values (new_clinic_id, current_user_id, 'doctor');

  insert into public.discount_rules (clinic_id, duration_weeks, percent)
  select new_clinic_id, duration, 0
  from unnest(array[8, 12, 16, 24, 48]) as duration;

  return new_clinic_id;
end;
$$;

revoke all on function public.create_clinic_for_current_user(text) from public;
grant execute on function public.create_clinic_for_current_user(text) to authenticated;
grant execute on function public.is_clinic_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.patients enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.discount_rules enable row level security;
alter table public.plan_templates enable row level security;
alter table public.template_items enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.sales enable row level security;
alter table public.renewal_contacts enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy clinics_select_member on public.clinics
for select to authenticated using (public.is_clinic_member(id));
create policy clinics_update_member on public.clinics
for update to authenticated using (public.is_clinic_member(id)) with check (public.is_clinic_member(id));

create policy clinic_members_select_member on public.clinic_members
for select to authenticated using (public.is_clinic_member(clinic_id));

create policy patients_member_all on public.patients
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy categories_member_all on public.service_categories
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy services_member_all on public.services
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy discounts_member_all on public.discount_rules
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy templates_member_all on public.plan_templates
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy plans_member_all on public.plans
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy sales_member_all on public.sales
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy renewals_member_all on public.renewal_contacts
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy template_items_select_member on public.template_items
for select to authenticated using (
  exists (
    select 1 from public.plan_templates template
    where template.id = template_id
      and public.is_clinic_member(template.clinic_id)
  )
);
create policy template_items_insert_member on public.template_items
for insert to authenticated with check (
  exists (
    select 1 from public.plan_templates template
    where template.id = template_id
      and public.is_clinic_member(template.clinic_id)
  )
);
create policy template_items_update_member on public.template_items
for update to authenticated using (
  exists (
    select 1 from public.plan_templates template
    where template.id = template_id
      and public.is_clinic_member(template.clinic_id)
  )
) with check (
  exists (
    select 1 from public.plan_templates template
    where template.id = template_id
      and public.is_clinic_member(template.clinic_id)
  )
);
create policy template_items_delete_member on public.template_items
for delete to authenticated using (
  exists (
    select 1 from public.plan_templates template
    where template.id = template_id
      and public.is_clinic_member(template.clinic_id)
  )
);

create policy plan_items_select_member on public.plan_items
for select to authenticated using (
  exists (
    select 1 from public.plans plan
    where plan.id = plan_id
      and public.is_clinic_member(plan.clinic_id)
  )
);
create policy plan_items_insert_member on public.plan_items
for insert to authenticated with check (
  exists (
    select 1 from public.plans plan
    where plan.id = plan_id
      and public.is_clinic_member(plan.clinic_id)
  )
);
create policy plan_items_update_member on public.plan_items
for update to authenticated using (
  exists (
    select 1 from public.plans plan
    where plan.id = plan_id
      and public.is_clinic_member(plan.clinic_id)
  )
) with check (
  exists (
    select 1 from public.plans plan
    where plan.id = plan_id
      and public.is_clinic_member(plan.clinic_id)
  )
);
create policy plan_items_delete_member on public.plan_items
for delete to authenticated using (
  exists (
    select 1 from public.plans plan
    where plan.id = plan_id
      and public.is_clinic_member(plan.clinic_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-logos',
  'clinic-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy clinic_logos_public_read on storage.objects
for select to public using (bucket_id = 'clinic-logos');

create policy clinic_logos_member_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'clinic-logos'
  and public.is_clinic_member(((storage.foldername(name))[1])::uuid)
);

create policy clinic_logos_member_update on storage.objects
for update to authenticated using (
  bucket_id = 'clinic-logos'
  and public.is_clinic_member(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id = 'clinic-logos'
  and public.is_clinic_member(((storage.foldername(name))[1])::uuid)
);

create policy clinic_logos_member_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'clinic-logos'
  and public.is_clinic_member(((storage.foldername(name))[1])::uuid)
);

commit;
