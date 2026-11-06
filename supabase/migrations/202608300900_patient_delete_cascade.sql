begin;

-- down: alter table public.patients drop column archived_at;
alter table public.patients add column archived_at timestamptz;

-- down: drop trigger patients_block_delete_with_sale on public.patients;
--       drop function public.block_patient_delete_with_sale();
-- Bloqueia a exclusão do paciente quando qualquer um dos seus planos tem venda concluída
-- (sales.status = 'Plano vendido') — venda é registro financeiro e não pode sumir. Nos
-- demais casos, a exclusão segue e cascateia (ver troca de FK abaixo). Rodar antes das
-- FKs virarem cascade, senão um DELETE já teria apagado tudo antes do trigger barrar.
create or replace function public.block_patient_delete_with_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.sales s
    join public.plans p on p.id = s.plan_id
    where p.patient_id = old.id and s.status = 'Plano vendido'
  ) then
    raise exception 'Não é possível excluir um paciente com plano vendido. Arquive o paciente em vez de excluir.';
  end if;
  return old;
end;
$$;

create trigger patients_block_delete_with_sale before delete on public.patients
for each row execute function public.block_patient_delete_with_sale();

-- down: restaurar "on delete restrict" nas duas FKs abaixo (nome original gerado pelo Postgres).
-- Antes disso a FK era "on delete restrict": qualquer plano ou consulta vinculado bloqueava
-- a exclusão do paciente inteiro, sem distinguir "tem venda" de "só rascunho". Agora quem
-- bloqueia é o trigger acima (só quando há venda concluída); sem venda, a exclusão do
-- paciente cascateia para plans/plan_items/plan_goals/sales-sem-venda e para
-- consultations/consultation_entries — sem órfão em nenhuma das duas famílias.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.plans'::regclass and confrelid = 'public.patients'::regclass and contype = 'f'
  loop
    execute format('alter table public.plans drop constraint %I', con.conname);
  end loop;
end $$;
alter table public.plans add constraint plans_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.consultations'::regclass and confrelid = 'public.patients'::regclass and contype = 'f'
  loop
    execute format('alter table public.consultations drop constraint %I', con.conname);
  end loop;
end $$;
alter table public.consultations add constraint consultations_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;

commit;
