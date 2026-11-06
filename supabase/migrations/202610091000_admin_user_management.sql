begin;

-- Gestão de usuários pelo admin da plataforma. Tudo roda como security definer porque mexe
-- em auth.users, mas cada função barra quem não for is_platform_admin() logo na entrada.
-- A criação é feita direto em auth.users (em vez de /auth/v1/signup) para não depender de
-- envio de e-mail nem esbarrar no limite de e-mails do Supabase.

create or replace function public.admin_require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma';
  end if;
end;
$$;

revoke all on function public.admin_require_platform_admin() from public, anon, authenticated;

-- GoTrue falha no login ("converting NULL to string") se colunas de token ficarem nulas.
-- O conjunto exato de colunas varia por versão, então zera dinamicamente as que existirem.
create or replace function public.admin_blank_auth_tokens(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  col text;
begin
  for col in
    select column_name from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
      and data_type in ('character varying', 'text')
      and (column_name like '%token%' or column_name in ('email_change', 'phone_change'))
  loop
    execute format('update auth.users set %I = coalesce(%I, '''') where id = $1', col, col) using target_user;
  end loop;
end;
$$;

revoke all on function public.admin_blank_auth_tokens(uuid) from public, anon, authenticated;

create or replace function public.admin_create_user(
  target_email text,
  target_password text,
  target_full_name text,
  confirm_now boolean,
  target_clinic uuid default null,
  new_clinic_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(trim(target_email));
  new_user_id uuid := gen_random_uuid();
  v_clinic_id uuid := target_clinic;
begin
  perform public.admin_require_platform_admin();

  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido';
  end if;
  if length(coalesce(target_password, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres';
  end if;
  if exists (select 1 from auth.users where lower(email) = clean_email) then
    raise exception 'Já existe um usuário com este e-mail';
  end if;
  if target_clinic is not null and not exists (select 1 from public.clinics where id = target_clinic) then
    raise exception 'Clínica não encontrada';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    clean_email,
    extensions.crypt(target_password, extensions.gen_salt('bf')),
    case when confirm_now then now() end,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(trim(target_full_name), '')),
    now(),
    now()
  );
  perform public.admin_blank_auth_tokens(new_user_id);

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    new_user_id::text,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', clean_email, 'email_verified', confirm_now, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  -- profile já foi criado pelo trigger on_auth_user_created
  if v_clinic_id is null then
    insert into public.clinics (created_by, display_name)
    values (new_user_id, coalesce(trim(new_clinic_name), ''))
    returning id into v_clinic_id;

    insert into public.discount_rules (clinic_id, duration_weeks, percent)
    select v_clinic_id, duration, 0 from unnest(array[8, 12, 16, 24, 48]) as duration;
  end if;

  insert into public.clinic_members (clinic_id, user_id, role)
  values (v_clinic_id, new_user_id, 'doctor');

  return jsonb_build_object('user_id', new_user_id, 'clinic_id', v_clinic_id);
end;
$$;

revoke all on function public.admin_create_user(text, text, text, boolean, uuid, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, boolean, uuid, text) to authenticated;

create or replace function public.admin_confirm_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_require_platform_admin();
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = target_user;
  if not found then raise exception 'Usuário não encontrado'; end if;
end;
$$;

revoke all on function public.admin_confirm_user(uuid) from public, anon;
grant execute on function public.admin_confirm_user(uuid) to authenticated;

create or replace function public.admin_set_user_password(target_user uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_require_platform_admin();
  if length(coalesce(new_password, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres';
  end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now() where id = target_user;
  if not found then raise exception 'Usuário não encontrado'; end if;
end;
$$;

revoke all on function public.admin_set_user_password(uuid, text) from public, anon;
grant execute on function public.admin_set_user_password(uuid, text) to authenticated;

-- Mudar o tipo de retorno exige recriar a função.
drop function if exists public.admin_clinic_members(uuid);
create function public.admin_clinic_members(target_clinic uuid)
returns table (user_id uuid, full_name text, email text, crm text, last_seen_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.full_name, pr.email, pr.crm, pr.last_seen_at, u.email_confirmed_at, u.last_sign_in_at
  from public.clinic_members cm
  join public.profiles pr on pr.id = cm.user_id
  join auth.users u on u.id = cm.user_id
  where cm.clinic_id = target_clinic
    and public.is_platform_admin()
  order by cm.created_at;
$$;

revoke all on function public.admin_clinic_members(uuid) from public, anon;
grant execute on function public.admin_clinic_members(uuid) to authenticated;

commit;
