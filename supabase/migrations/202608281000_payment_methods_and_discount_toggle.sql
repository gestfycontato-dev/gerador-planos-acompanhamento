begin;

alter table public.plans add column apply_discount boolean not null default true;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  created_at timestamptz not null default now()
);
create index payment_methods_clinic_idx on public.payment_methods (clinic_id, created_at);

alter table public.payment_methods enable row level security;

create policy payment_methods_member_all on public.payment_methods
for all to authenticated
using (public.is_clinic_member(clinic_id))
with check (public.is_clinic_member(clinic_id));

commit;
