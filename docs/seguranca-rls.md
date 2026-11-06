# Matriz de segurança RLS — Gestfy

Gerado automaticamente por `scripts/rls-matrix.mjs` em 2026-08-27T00:16:07.101Z.

**Resultado geral: TODAS AS VERIFICAÇÕES PASSARAM** (293 verificações no total)

## Exceções documentadas

- **`clinics` (GET metadado) para o Master**: intencional — o painel admin precisa ler nome/CNPJ/endereço da clínica para funcionar (Prompt 9/10). Nenhum dado de paciente, plano, consulta ou objetivo é exposto por essa policy.
- **`goal_catalog`, `sales_scripts`, `sales_script_items`**: catálogo/roteiro globais — qualquer autenticado lê, só o Master escreve.

## search_path fixo nas funções security definer

Verificação estática (leitura das migrações, não testada por este script em runtime): todas têm `set search_path = ''` e toda referência a tabela é qualificada com `public.`, eliminando sequestro de search_path.

| Função | search_path |
|---|---|
| `is_clinic_member` | `''` |
| `create_clinic_for_current_user` | `''` |
| `handle_new_user` | `''` |
| `is_platform_admin` | `''` |
| `touch_last_seen` | `''` |
| `clinic_billing_set_updated_by` | `''` |
| `admin_clinic_stats` | `''` |
| `clinic_billing_log_history` | `''` |
| `admin_clinic_members` | `''` |
| `block_patient_delete_with_sale` | `''` |

## Resultado por tabela

| Ator | Tabela | Operação | Esperado | Resultado | Detalhe |
|---|---|---|---|---|---|
| Clínica A | patients | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | patients | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | patients | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | patients | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | patients | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plans | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plans | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plans | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | plans | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plans | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plan_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plan_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plan_items | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | plan_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plan_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plan_goals | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plan_goals | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plan_goals | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | plan_goals | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plan_goals | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | goal_templates | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | goal_templates | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | goal_templates | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | goal_templates | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | goal_templates | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | goal_template_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | goal_template_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | goal_template_items | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | goal_template_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | goal_template_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | sales | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | sales | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | sales | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | sales | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | sales | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | renewal_contacts | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | renewal_contacts | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | renewal_contacts | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | renewal_contacts | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | services | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | services | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | services | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | services | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | services | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | service_categories | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | service_categories | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | service_categories | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | service_categories | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | service_categories | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | discount_rules | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | discount_rules | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | discount_rules | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | discount_rules | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | discount_rules | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plan_templates | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plan_templates | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | plan_templates | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | plan_templates | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | plan_templates | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | template_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | template_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | template_items | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | template_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | template_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | consultations | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | consultations | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | consultations | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | consultations | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | consultations | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | consultation_entries | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | consultation_entries | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | consultation_entries | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | consultation_entries | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | consultation_entries | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | clinic_members | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | clinic_members | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | clinic_members | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Clínica A | clinic_members | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | profiles | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | profiles | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | profiles | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | patients | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | patients | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | patients | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | patients | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | patients | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plans | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plans | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plans | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | plans | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plans | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plan_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plan_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plan_items | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | plan_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plan_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plan_goals | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plan_goals | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plan_goals | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | plan_goals | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plan_goals | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | goal_templates | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | goal_templates | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | goal_templates | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | goal_templates | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | goal_templates | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | goal_template_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | goal_template_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | goal_template_items | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | goal_template_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | goal_template_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | sales | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | sales | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | sales | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | sales | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | sales | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | renewal_contacts | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | renewal_contacts | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | renewal_contacts | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | renewal_contacts | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | services | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | services | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | services | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | services | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | services | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | service_categories | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | service_categories | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | service_categories | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | service_categories | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | service_categories | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | discount_rules | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | discount_rules | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | discount_rules | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | discount_rules | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | discount_rules | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plan_templates | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plan_templates | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | plan_templates | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | plan_templates | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | plan_templates | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | template_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | template_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | template_items | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | template_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | template_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | consultations | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | consultations | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | consultations | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | consultations | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | consultations | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | consultation_entries | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | consultation_entries | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | consultation_entries | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | consultation_entries | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | consultation_entries | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | clinic_members | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | clinic_members | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | clinic_members | POST | bloqueado | ✅ PASSOU | status 403 — bloqueado |
| Master | clinic_members | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Master | profiles | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | profiles | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | profiles | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | patients | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | patients | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | patients | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | patients | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | patients | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plans | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plans | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plans | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | plans | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plans | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plan_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plan_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plan_items | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | plan_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plan_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plan_goals | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plan_goals | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plan_goals | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | plan_goals | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plan_goals | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | goal_templates | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | goal_templates | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | goal_templates | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | goal_templates | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | goal_templates | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | goal_template_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | goal_template_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | goal_template_items | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | goal_template_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | goal_template_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | sales | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | sales | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | sales | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | sales | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | sales | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | renewal_contacts | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | renewal_contacts | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | renewal_contacts | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | renewal_contacts | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | services | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | services | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | services | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | services | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | services | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | service_categories | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | service_categories | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | service_categories | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | service_categories | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | service_categories | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | discount_rules | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | discount_rules | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | discount_rules | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | discount_rules | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | discount_rules | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plan_templates | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plan_templates | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | plan_templates | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | plan_templates | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | plan_templates | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | template_items | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | template_items | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | template_items | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | template_items | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | template_items | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | consultations | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | consultations | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | consultations | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | consultations | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | consultations | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | consultation_entries | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | consultation_entries | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | consultation_entries | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | consultation_entries | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | consultation_entries | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | clinic_members | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | clinic_members | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | clinic_members | POST | bloqueado | ✅ PASSOU | status 401 — bloqueado |
| Sem token | clinic_members | DELETE | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Sem token | profiles | GET filtro | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | profiles | GET por id | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | profiles | PATCH | sem efeito | ✅ PASSOU | status 200, linhas afetadas 0 |
| Clínica A | goal_catalog | GET (global) | leitura | ✅ PASSOU | status 200, linhas 1 |
| Clínica A | sales_scripts | GET (global) | leitura | ✅ PASSOU | status 200, linhas 1 |
| Master | goal_catalog | GET (global) | leitura | ✅ PASSOU | status 200, linhas 1 |
| Master | sales_scripts | GET (global) | leitura | ✅ PASSOU | status 200, linhas 1 |
| Sem token | goal_catalog | GET (global) | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | sales_scripts | GET (global) | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | goal_catalog | POST (global) | bloqueado | ✅ PASSOU | status 403 |
| Clínica A | sales_scripts | POST (global) | bloqueado | ✅ PASSOU | status 403 |
| Master | goal_catalog | POST (global) | permitido | ✅ PASSOU | status 201 |
| Master | goal_catalog | PATCH (própria fixture) | permitido | ✅ PASSOU | status 200 |
| Master | goal_catalog | DELETE (própria fixture) | permitido | ✅ PASSOU | status 200 |
| Master | sales_scripts | POST (global) | permitido | ✅ PASSOU | status 201 |
| Master | sales_scripts | PATCH (própria fixture) | permitido | ✅ PASSOU | status 200 |
| Master | sales_scripts | DELETE (própria fixture) | permitido | ✅ PASSOU | status 200 |
| Sem token | goal_catalog | POST (global) | bloqueado | ✅ PASSOU | status 401 |
| Sem token | sales_scripts | POST (global) | bloqueado | ✅ PASSOU | status 401 |
| Clínica A | sales_script_items | PATCH (fixture de terceiro) | bloqueado | ✅ PASSOU | status 200, linhas 0 |
| Sem token | sales_script_items | PATCH (fixture de terceiro) | bloqueado | ✅ PASSOU | status 200, linhas 0 |
| Master | sales_script_items | PATCH (fixture, dono) | permitido | ✅ PASSOU | status 200, linhas 1 |
| Clínica A | clinics | GET metadado | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | clinics | PATCH | sem efeito | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | admin_clinics_overview | GET | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | clinic_billing | GET | vazio | ✅ PASSOU | status 200 |
| Clínica A | clinic_billing | POST (upsert) | bloqueado | ✅ PASSOU | status 403 |
| Clínica A | platform_admins | GET | vazio | ✅ PASSOU | status 200 |
| Clínica A | platform_admins | POST | bloqueado | ✅ PASSOU | status 403 (ninguém escreve aqui pela API, nem master) |
| Master | clinics | GET metadado | leitura | ✅ PASSOU | status 200, linhas 1 (exceção documentada: metadado, não dado clínico) |
| Master | clinics | PATCH | sem efeito | ✅ PASSOU | status 200, linhas 0 |
| Master | admin_clinics_overview | GET | leitura | ✅ PASSOU | status 200, linhas 1 |
| Master | clinic_billing | GET | leitura | ✅ PASSOU | status 200 |
| Master | clinic_billing | POST (upsert) | permitido | ✅ PASSOU | status 200 |
| Master | platform_admins | GET | leitura | ✅ PASSOU | status 200 |
| Master | platform_admins | POST | bloqueado | ✅ PASSOU | status 403 (ninguém escreve aqui pela API, nem master) |
| Sem token | clinics | GET metadado | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | clinics | PATCH | sem efeito | ✅ PASSOU | status 200, linhas 0 |
| Sem token | admin_clinics_overview | GET | vazio | ✅ PASSOU | status 200, linhas 0 |
| Sem token | clinic_billing | GET | vazio | ✅ PASSOU | status 200 |
| Sem token | clinic_billing | POST (upsert) | bloqueado | ✅ PASSOU | status 401 |
| Sem token | platform_admins | GET | vazio | ✅ PASSOU | status 200 |
| Sem token | platform_admins | POST | bloqueado | ✅ PASSOU | status 401 (ninguém escreve aqui pela API, nem master) |
| Clínica A | rpc:is_platform_admin | POST | false | ✅ PASSOU | retornou false |
| Clínica A | rpc:admin_clinic_members | POST | vazio | ✅ PASSOU | status 200, linhas 0 |
| Master | rpc:is_platform_admin | POST | true | ✅ PASSOU | retornou true |
| Master | rpc:admin_clinic_members | POST | contatos | ✅ PASSOU | status 200, linhas 1 |
| Sem token | rpc:is_platform_admin | POST | false | ✅ PASSOU | retornou false |
| Sem token | rpc:admin_clinic_members | POST | vazio | ✅ PASSOU | status 200, linhas 0 |
| Clínica A | storage:clinic-logos | POST (overwrite) | bloqueado | ✅ PASSOU | status 400 |
| Clínica A | storage:clinic-logos | DELETE | bloqueado | ✅ PASSOU | status 400 |
| Sem token | storage:clinic-logos | POST (overwrite) | bloqueado | ✅ PASSOU | status 400 |
| Sem token | storage:clinic-logos | DELETE | bloqueado | ✅ PASSOU | status 400 |
