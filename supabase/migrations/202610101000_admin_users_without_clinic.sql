begin;

-- Quem se cadastrou pela tela de login mas nunca entrou não tem clínica: ela só nasce no
-- primeiro login (create_clinic_for_current_user), e o login exige e-mail confirmado.
-- Sem esta função o admin não enxerga esses cadastros, porque o painel parte das clínicas.
create or replace function public.admin_users_without_clinic()
returns table (user_id uuid, full_name text, email text, created_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, coalesce(pr.full_name, ''), u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where public.is_platform_admin()
    and not exists (select 1 from public.clinic_members cm where cm.user_id = u.id)
    and not exists (select 1 from public.platform_admins pa where pa.user_id = u.id)
  order by u.created_at desc;
$$;

revoke all on function public.admin_users_without_clinic() from public, anon;
grant execute on function public.admin_users_without_clinic() to authenticated;

commit;
