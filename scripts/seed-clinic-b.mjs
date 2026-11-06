#!/usr/bin/env node
// Semeia a "clínica B" usada pela matriz de segurança (scripts/rls-matrix.mjs) e pela
// regressão funcional (Parte 3 do Prompt 11). Roda pelo fluxo normal do app (fetch cru
// contra a REST API do Supabase, autenticado como a própria clínica B) — nunca por SQL
// direto, pra garantir que os dados nascem exatamente como um uso real criaria.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... CLINIC_B_EMAIL=... CLINIC_B_PASSWORD=... \
//     node scripts/seed-clinic-b.mjs
//
// Grava scripts/.seed-output.json (fora do controle de versão, ver .gitignore) com todos
// os ids criados — é o que scripts/rls-matrix.mjs e os testes de regressão consomem.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://nzuhmyrwgnckooqtgcgy.supabase.co').replace(/\/$/, '')
const KEY = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_pKMFPaLNBXrUEVvXtnB_AQ_Sikg7leA'
const EMAIL = process.env.CLINIC_B_EMAIL
const PASSWORD = process.env.CLINIC_B_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error('Defina CLINIC_B_EMAIL e CLINIC_B_PASSWORD (ver .env.test).')
  process.exit(1)
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`login falhou (${email}): ${JSON.stringify(body)}`)
  return { token: body.access_token, userId: body.user.id }
}

function db(token) {
  return async (table, { method = 'GET', query = '', body, prefer } = {}) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error(`${method} ${table} -> ${res.status}: ${text}`)
    return parsed
  }
}

function rpc(token) {
  return async (name, params = {}) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error(`rpc ${name} -> ${res.status}: ${text}`)
    return parsed
  }
}

const uuid = () => crypto.randomUUID()

async function main() {
  console.log(`Logando como clínica B (${EMAIL})...`)
  const { token, userId } = await login(EMAIL, PASSWORD)
  const query = db(token)
  const call = rpc(token)

  let memberships = await query('clinic_members', { query: `select=clinic_id&user_id=eq.${userId}&limit=1` })
  let clinicId
  if (!memberships.length) {
    console.log('Sem clínica ainda — criando via create_clinic_for_current_user...')
    clinicId = await call('create_clinic_for_current_user', { initial_name: 'Clínica B (teste RLS)' })
  } else {
    clinicId = memberships[0].clinic_id
  }
  await query('clinics', { method: 'PATCH', query: `id=eq.${clinicId}`, body: { display_name: 'Clínica B (teste RLS)', legal_name: 'Clínica B Testes Ltda', cnpj: '00.000.000/0001-00', phone: '(21) 90000-0000', email: EMAIL, address: 'Rua de Teste, 123', city: 'Rio de Janeiro', state: 'RJ', zip_code: '20000-000' } })
  await query('profiles', { method: 'PATCH', query: `id=eq.${userId}`, body: { full_name: 'Dra. Clínica B Teste', crm: 'CRM-RJ 000000' } })
  console.log('Clínica B:', clinicId)

  // categoria + serviço "reais" (usados pela regressão da Parte 3) — idempotente: rodar
  // de novo depois de uma falha parcial não deve travar em chave duplicada.
  const [category] = await query('service_categories', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', query: 'on_conflict=clinic_id,normalized_name', body: { clinic_id: clinicId, name: 'Estética', normalized_name: 'estetica' } })
  const [service] = await query('services', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, category_id: category.id, name: 'Consulta de avaliação', price: 300, duration_minutes: 40 } })
  await query('discount_rules', { method: 'POST', prefer: 'resolution=merge-duplicates', query: 'on_conflict=clinic_id,duration_weeks', body: { clinic_id: clinicId, duration_weeks: 12, percent: 10 } })

  // template de objetivos "real"
  const [goalTemplate] = await query('goal_templates', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: 'Emagrecimento padrão' } })
  const [goalTemplateItem] = await query('goal_template_items', { method: 'POST', prefer: 'return=representation', body: { goal_template_id: goalTemplate.id, name: 'Peso', unit: 'kg', direction: 'decrease', value_type: 'number', default_current: 90, default_target: 78, sort_order: 0 } })

  // paciente "real"
  const [patient] = await query('patients', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: 'Paciente Teste Clínica B', gender: 'Feminino' } })

  // plano "real": data de início, 2 objetivos, 1 serviço agendado
  const planId = uuid()
  await query('plans', { method: 'POST', body: { id: planId, clinic_id: clinicId, patient_id: patient.id, name: 'Plano Teste Clínica B', duration_weeks: 12, start_date: '2026-09-01', created_by: userId } })
  await query('plan_items', { method: 'POST', body: { plan_id: planId, service_id: service.id, week_number: 1, quantity: 1 } })
  await query('plan_goals', { method: 'POST', body: [
    { clinic_id: clinicId, plan_id: planId, name: 'Peso', unit: 'kg', direction: 'decrease', value_type: 'number', current_value: 90, target_value: 78, sort_order: 0 },
    { clinic_id: clinicId, plan_id: planId, name: 'IMC', unit: null, direction: 'decrease', value_type: 'number', current_value: 32, target_value: 26, sort_order: 1 },
  ] })

  // consulta SPIN "real", com respostas preenchidas
  const [script] = await query('sales_scripts', { query: 'select=id,sales_script_items(id,item_type,phase,label)&is_default=eq.true&clinic_id=is.null&limit=1' })
  const [consultation] = await query('consultations', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, patient_id: patient.id, plan_id: planId, sales_script_id: script?.id ?? null, created_by: userId, status: 'concluida', finished_at: new Date().toISOString(), free_notes: 'Anotação livre de teste da clínica B.' } })
  let consultationEntryId = null
  if (script) {
    const answerItem = script.sales_script_items.find(i => i.item_type === 'answer')
    const checkItem = script.sales_script_items.find(i => i.item_type === 'check')
    const entries = []
    if (answerItem) entries.push({ consultation_id: consultation.id, item_id: answerItem.id, item_type: 'answer', phase: answerItem.phase, item_label: answerItem.label, answer_text: 'Resposta de teste da clínica B, com dado sensível fictício.', checked: null })
    if (checkItem) entries.push({ consultation_id: consultation.id, item_id: checkItem.id, item_type: 'check', phase: checkItem.phase, item_label: checkItem.label, answer_text: null, checked: true })
    if (entries.length) {
      const created = await query('consultation_entries', { method: 'POST', prefer: 'return=representation', body: entries })
      consultationEntryId = created[0]?.id ?? null
    }
  }

  // venda concluída "real" — precisa existir a linha em sales antes (o app sempre garante
  // isso ao salvar o plano pela primeira vez; aqui como é seed direto, criamos na mão)
  const now = new Date().toISOString()
  const snapshot = { planId, planName: 'Plano Teste Clínica B', patientId: patient.id, startDate: '2026-09-01', duration: 12, weeks: [], goals: [{ name: 'Peso', unit: 'kg', direction: 'decrease', valueType: 'number', currentValue: 90, targetValue: 78 }], consultationId: consultation.id, services: [service], subtotal: 300, discountPercent: 10, total: 270, capturedAt: now }
  await query('sales', { method: 'POST', body: { clinic_id: clinicId, plan_id: planId, status: 'Plano vendido', subtotal: 300, discount_percent: 10, total: 270, sold_snapshot: snapshot, sold_at: now } })

  // --- fixtures descartáveis, só para os testes destrutivos (PATCH/DELETE) da matriz de
  // segurança. Nunca usados pela regressão da Parte 3 — podem "quebrar" sem prejuízo.
  const [atkCategory] = await query('service_categories', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', query: 'on_conflict=clinic_id,normalized_name', body: { clinic_id: clinicId, name: 'Alvo RLS', normalized_name: 'alvo-rls' } })
  const [atkService] = await query('services', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, category_id: atkCategory.id, name: 'Serviço alvo RLS', price: 50, duration_minutes: 10 } })
  const [atkPatient] = await query('patients', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: 'Paciente Alvo RLS', gender: 'Outro' } })
  const atkPlanId = uuid()
  await query('plans', { method: 'POST', body: { id: atkPlanId, clinic_id: clinicId, patient_id: atkPatient.id, name: 'Plano Alvo RLS', duration_weeks: 8, start_date: '2026-09-01', created_by: userId } })
  const [atkPlanItem] = await query('plan_items', { method: 'POST', prefer: 'return=representation', body: { plan_id: atkPlanId, service_id: atkService.id, week_number: 1, quantity: 1 } })
  const [atkGoal] = await query('plan_goals', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, plan_id: atkPlanId, name: 'Alvo', direction: 'decrease', value_type: 'number', current_value: 1, target_value: 0, sort_order: 0 } })
  const [atkTemplate] = await query('plan_templates', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: 'Template alvo RLS', duration_weeks: 4, created_by: userId } })
  const [atkTemplateItem] = await query('template_items', { method: 'POST', prefer: 'return=representation', body: { template_id: atkTemplate.id, service_id: atkService.id, week_number: 1, quantity: 1 } })
  const [atkGoalTemplate] = await query('goal_templates', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: 'Template objetivo alvo RLS' } })
  const [atkGoalTemplateItem] = await query('goal_template_items', { method: 'POST', prefer: 'return=representation', body: { goal_template_id: atkGoalTemplate.id, name: 'Alvo', direction: 'decrease', value_type: 'number', sort_order: 0 } })
  const [atkConsultation] = await query('consultations', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, patient_id: atkPatient.id, created_by: userId } })
  let atkEntry = null
  if (script) {
    const anyItem = script.sales_script_items[0]
    const [created] = await query('consultation_entries', { method: 'POST', prefer: 'return=representation', body: { consultation_id: atkConsultation.id, item_id: anyItem.id, item_type: anyItem.item_type, phase: anyItem.phase, item_label: anyItem.label, checked: false } })
    atkEntry = created
  }
  await query('renewal_contacts', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, plan_id: atkPlanId, completed_by: userId, notes: 'Alvo RLS' } })
  const [atkSale] = await query('sales', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, plan_id: atkPlanId, status: 'Plano criado' } })

  const output = {
    seededAt: now,
    supabaseUrl: SUPABASE_URL,
    clinicB: { email: EMAIL, password: PASSWORD, userId, clinicId },
    real: {
      categoryId: category.id, serviceId: service.id, goalTemplateId: goalTemplate.id, goalTemplateItemId: goalTemplateItem.id,
      patientId: patient.id, planId, consultationId: consultation.id, consultationEntryId, salesScriptId: script?.id ?? null,
    },
    attackTargets: {
      categoryId: atkCategory.id, serviceId: atkService.id, patientId: atkPatient.id, planId: atkPlanId, planItemId: atkPlanItem.id,
      planGoalId: atkGoal.id, planTemplateId: atkTemplate.id, templateItemId: atkTemplateItem.id, goalTemplateId: atkGoalTemplate.id,
      goalTemplateItemId: atkGoalTemplateItem.id, consultationId: atkConsultation.id, consultationEntryId: atkEntry?.id ?? null,
      salesId: atkSale?.id ?? null,
    },
  }
  writeFileSync(join(HERE, '.seed-output.json'), JSON.stringify(output, null, 2))
  console.log('\nSemeadura concluída. Detalhes em scripts/.seed-output.json')
  console.log(JSON.stringify(output, null, 2))
}

main().catch(error => { console.error('ERRO NA SEMEADURA:', error.message); process.exit(1) })
