begin;

-- Histórico de mudanças de status de cobrança. Só o trigger escreve aqui (nenhuma policy
-- de insert/update/delete para "authenticated") — o admin lê, nunca edita o passado.
-- changed_by_email fica gravado em texto no momento da mudança de propósito: assim o
-- histórico nunca precisa de leitura de profiles de outros admins para ser exibido.
create table public.clinic_billing_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  old_status text,
  new_status text not null,
  notes text,
  changed_by uuid references auth.users(id),
  changed_by_email text,
  changed_at timestamptz not null default now()
);

create index clinic_billing_history_clinic_idx on public.clinic_billing_history (clinic_id, changed_at desc);

create or replace function public.clinic_billing_log_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.clinic_billing_history (clinic_id, old_status, new_status, notes, changed_by, changed_by_email)
  values (
    new.clinic_id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    new.notes,
    auth.uid(),
    (select email from auth.users where id = auth.uid())
  );
  return new;
end;
$$;

create trigger clinic_billing_log_history after insert or update on public.clinic_billing
for each row execute function public.clinic_billing_log_history();

alter table public.clinic_billing_history enable row level security;

create policy clinic_billing_history_select_admin on public.clinic_billing_history
for select to authenticated using (public.is_platform_admin());

-- Contatos dos membros para o painel lateral. Não dá policy nova em "profiles" (que
-- continua só leitura própria) — mantém o mesmo princípio do prompt anterior: o admin só
-- enxerga exatamente o que a função devolve, nada de acesso de tabela solto.
create or replace function public.admin_clinic_members(target_clinic uuid)
returns table (user_id uuid, full_name text, email text, crm text, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.full_name, pr.email, pr.crm, pr.last_seen_at
  from public.clinic_members cm
  join public.profiles pr on pr.id = cm.user_id
  where cm.clinic_id = target_clinic
    and public.is_platform_admin();
$$;

revoke all on function public.admin_clinic_members(uuid) from public;
grant execute on function public.admin_clinic_members(uuid) to authenticated;

commit;
