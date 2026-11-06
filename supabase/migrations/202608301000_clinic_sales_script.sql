begin;

-- down: drop policy sales_scripts_member_all on public.sales_scripts;
--       drop policy sales_script_items_insert_member on public.sales_script_items;
--       drop policy sales_script_items_update_member on public.sales_script_items;
--       drop policy sales_script_items_delete_member on public.sales_script_items;
--       drop index public.sales_scripts_clinic_unique_idx;
-- Cada clínica passa a poder ter sua própria cópia editável do roteiro de vendas
-- (clinic_id preenchido), independente do roteiro padrão global (clinic_id null, só o
-- master edita — policies antigas intactas). Uma clínica só enxerga/edita a própria cópia;
-- nunca o roteiro global nem o de outra clínica. No máximo uma cópia por clínica.

create unique index sales_scripts_clinic_unique_idx on public.sales_scripts (clinic_id) where clinic_id is not null;

create policy sales_scripts_member_all on public.sales_scripts
for all to authenticated
using (clinic_id is not null and public.is_clinic_member(clinic_id))
with check (clinic_id is not null and public.is_clinic_member(clinic_id));

create policy sales_script_items_insert_member on public.sales_script_items
for insert to authenticated with check (
  exists (
    select 1 from public.sales_scripts script
    where script.id = sales_script_id
      and script.clinic_id is not null
      and public.is_clinic_member(script.clinic_id)
  )
);
create policy sales_script_items_update_member on public.sales_script_items
for update to authenticated using (
  exists (
    select 1 from public.sales_scripts script
    where script.id = sales_script_id
      and script.clinic_id is not null
      and public.is_clinic_member(script.clinic_id)
  )
) with check (
  exists (
    select 1 from public.sales_scripts script
    where script.id = sales_script_id
      and script.clinic_id is not null
      and public.is_clinic_member(script.clinic_id)
  )
);
create policy sales_script_items_delete_member on public.sales_script_items
for delete to authenticated using (
  exists (
    select 1 from public.sales_scripts script
    where script.id = sales_script_id
      and script.clinic_id is not null
      and public.is_clinic_member(script.clinic_id)
  )
);

commit;
