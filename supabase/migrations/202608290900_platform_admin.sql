begin;

-- Cadastro de administradores da plataforma. Sem policy de insert/update/delete para
-- "authenticated": promover alguém a admin só pode ser feito manualmente pelo SQL Editor
-- (ou service role), nunca pelo próprio app.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Cobrança por clínica. Não tem relação nenhuma com dados clínicos — só metadado
-- comercial que o admin da plataforma precisa enxergar e editar.
create table public.clinic_billing (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'adimplente', 'inadimplente', 'cancelada')),
  plan_label text,
  due_day integer check (due_day between 1 and 31),
  last_payment_at timestamptz,
  next_due_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.profiles add column last_seen_at timestamptz;

-- security definer + search_path fixo (vazio, igual às outras funções do projeto):
-- nada resolve sem estar qualificado com "public.", eliminando qualquer chance de
-- sequestro de search_path.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Só grava o last_seen_at do próprio usuário autenticado — auth.uid() não é
-- controlável pelo cliente, então não dá pra usar isso pra tocar o registro de outra pessoa.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- updated_by nunca vem do cliente: o trigger sobrescreve com auth.uid() sempre,
-- então o valor gravado é sempre fidedigno a quem de fato fez a chamada autenticada.
create or replace function public.clinic_billing_set_updated_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger clinic_billing_set_updated_by before insert or update on public.clinic_billing
for each row execute function public.clinic_billing_set_updated_by();

-- Única porta de entrada do admin para números agregados de patients/plans/sales/membros.
-- Nunca expõe uma linha dessas tabelas — só contagens e o maior last_seen_at entre os
-- membros. Ainda assim, checa is_platform_admin() por dentro: se alguém chamar essa
-- função diretamente sem ser admin, ela devolve zero linhas.
create or replace function public.admin_clinic_stats(target_clinic uuid)
returns table (members bigint, patients bigint, plans bigint, sales bigint, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.clinic_members where clinic_id = target_clinic),
    (select count(*) from public.patients where clinic_id = target_clinic),
    (select count(*) from public.plans where clinic_id = target_clinic),
    (select count(*) from public.sales where clinic_id = target_clinic),
    (select max(pr.last_seen_at) from public.clinic_members cm join public.profiles pr on pr.id = cm.user_id where cm.clinic_id = target_clinic)
  where public.is_platform_admin();
$$;

revoke all on function public.admin_clinic_stats(uuid) from public;
grant execute on function public.admin_clinic_stats(uuid) to authenticated;

alter table public.platform_admins enable row level security;
alter table public.clinic_billing enable row level security;

create policy platform_admins_select_admin on public.platform_admins
for select to authenticated using (public.is_platform_admin());

create policy clinic_billing_admin_all on public.clinic_billing
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Único ponto onde o admin ganha leitura direta de uma tabela "clínica": clinics guarda
-- só nome/CNPJ/endereço da clínica em si, não dado de paciente. Sem essa policy, a view
-- abaixo (security_invoker) não enxergaria nenhuma clínica para um admin que não é membro
-- de nenhuma delas.
create policy clinics_select_admin on public.clinics
for select to authenticated using (public.is_platform_admin());

-- security_invoker: a view roda com o RLS de quem consulta, não do dono. Para um usuário
-- comum (sem policy de admin em clinics e sem ser is_platform_admin()), o resultado é
-- vazio nas duas camadas de proteção: a base "clinics" já não devolve linha nenhuma pra
-- quem não é membro nem admin, e o "where" abaixo filtra de novo por garantia. patients,
-- plans, plan_goals, consultations e consultation_entries não são tocados por policy
-- nenhuma aqui — os números vêm só de admin_clinic_stats, que nunca devolve uma linha
-- daquelas tabelas, só contagens.
create or replace view public.admin_clinics_overview
with (security_invoker = true)
as
select
  c.id,
  c.display_name as name,
  c.created_at,
  cb.status as billing_status,
  cb.plan_label,
  cb.next_due_at,
  cb.last_payment_at,
  stats.members,
  stats.patients,
  stats.plans,
  stats.sales,
  stats.last_seen_at
from public.clinics c
left join public.clinic_billing cb on cb.clinic_id = c.id
cross join public.admin_clinic_stats(c.id) as stats
where public.is_platform_admin();

grant select on public.admin_clinics_overview to authenticated;

commit;
