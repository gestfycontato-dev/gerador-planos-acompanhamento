begin;

-- down: drop policy goal_catalog_admin_write on public.goal_catalog;
-- Catálogo global de objetivos: clínica continua só lendo (policy antiga intacta).
-- Agora o admin de plataforma também pode escrever via API (antes só por SQL Editor) —
-- prepara terreno para uma futura tela de manutenção do catálogo no painel admin.
create policy goal_catalog_admin_write on public.goal_catalog
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- down: drop policy sales_scripts_admin_write on public.sales_scripts;
--       drop policy sales_script_items_admin_write on public.sales_script_items;
-- Mesmo raciocínio para o roteiro de vendas global (clinic_id is null): clínica continua
-- só lendo, admin ganha escrita via API.
create policy sales_scripts_admin_write on public.sales_scripts
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy sales_script_items_admin_write on public.sales_script_items
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

commit;
