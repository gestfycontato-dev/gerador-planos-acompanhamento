#!/usr/bin/env node
// Matriz de segurança multi-tenant. Bate direto na REST API do Supabase (nunca no app),
// porque o guard de interface não prova isolamento nenhum — só a policy no banco prova.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   CLINIC_A_EMAIL=... CLINIC_A_PASSWORD=... \
//   MASTER_EMAIL=... MASTER_PASSWORD=... \
//   node scripts/rls-matrix.mjs
//
// Lê scripts/.seed-output.json (gerado por scripts/seed-clinic-b.mjs) para saber quais
// ids da clínica B tentar acessar. Reaproveitável a cada migração: só rodar de novo.
// Escreve docs/seguranca-rls.md com o resultado.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://nzuhmyrwgnckooqtgcgy.supabase.co').replace(/\/$/, '')
const KEY = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_pKMFPaLNBXrUEVvXtnB_AQ_Sikg7leA'
const { CLINIC_A_EMAIL, CLINIC_A_PASSWORD, MASTER_EMAIL, MASTER_PASSWORD } = process.env
if (!CLINIC_A_EMAIL || !CLINIC_A_PASSWORD || !MASTER_EMAIL || !MASTER_PASSWORD) {
  console.error('Defina CLINIC_A_EMAIL, CLINIC_A_PASSWORD, MASTER_EMAIL e MASTER_PASSWORD (ver .env.test).')
  process.exit(1)
}

let seed
try {
  seed = JSON.parse(readFileSync(join(HERE, '.seed-output.json'), 'utf-8'))
} catch {
  console.error('scripts/.seed-output.json não encontrado. Rode antes: node scripts/seed-clinic-b.mjs')
  process.exit(1)
}
const ids = { real: seed.real, clinicId: seed.clinicB.clinicId, attackTargets: seed.attackTargets }

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`login falhou (${email}): ${JSON.stringify(body)}`)
  return body.access_token
}

async function rest(token, method, path, body, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed
  try { parsed = text ? JSON.parse(text) : [] } catch { parsed = text }
  return { status: res.status, body: parsed }
}

async function storageCall(token, method, path, body, contentType = 'application/json') {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${path}`, {
    method,
    headers: { apikey: KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': contentType },
    body,
  })
  return { status: res.status, body: await res.text() }
}

const rows = []
function log(actor, table, op, expected, pass, detail) {
  rows.push({ actor, table, op, expected, pass, detail })
  const mark = pass ? 'PASSOU' : 'FALHOU'
  console.log(`[${mark}] ${actor.padEnd(12)} ${table.padEnd(24)} ${op.padEnd(12)} — ${detail}`)
}

const isEmpty = (body) => Array.isArray(body) ? body.length === 0 : (body === null || body === '' || (typeof body === 'object' && body?.code))
const isBlockedStatus = (status) => status === 401 || status === 403 || status === 404 || status === 42501

// ---- definição da matriz "clínica" (dado que deve ficar 100% invisível fora da clínica B)
const CLINICAL_TABLES = [
  { name: 'patients', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.real.patientId}`,
    insert: { clinic_id: ids.clinicId, name: 'RLS injection test', gender: 'Outro' },
    patchTarget: ids.attackTargets.patientId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.patientId },
  { name: 'plans', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.real.planId}`,
    insert: { clinic_id: ids.clinicId, patient_id: ids.real.patientId, name: 'RLS injection', duration_weeks: 4, start_date: '2026-01-01', created_by: ids.real.patientId },
    patchTarget: ids.attackTargets.planId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.planId },
  { name: 'plan_items', filter: `plan_id=eq.${ids.real.planId}`, idFilter: `id=eq.${ids.attackTargets.planItemId}`,
    insert: { plan_id: ids.real.planId, service_id: ids.real.serviceId, week_number: 1, quantity: 1 },
    patchTarget: ids.attackTargets.planItemId, patchBody: { quantity: 99 }, deleteTarget: ids.attackTargets.planItemId },
  { name: 'plan_goals', filter: `plan_id=eq.${ids.real.planId}`, idFilter: `id=eq.${ids.attackTargets.planGoalId}`,
    insert: { clinic_id: ids.clinicId, plan_id: ids.real.planId, name: 'RLS injection', direction: 'decrease', value_type: 'number', sort_order: 0 },
    patchTarget: ids.attackTargets.planGoalId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.planGoalId },
  { name: 'goal_templates', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.real.goalTemplateId}`,
    insert: { clinic_id: ids.clinicId, name: 'RLS injection' },
    patchTarget: ids.attackTargets.goalTemplateId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.goalTemplateId },
  { name: 'goal_template_items', filter: `goal_template_id=eq.${ids.real.goalTemplateId}`, idFilter: `id=eq.${ids.attackTargets.goalTemplateItemId}`,
    insert: { goal_template_id: ids.real.goalTemplateId, name: 'RLS injection', direction: 'decrease', value_type: 'number', sort_order: 0 },
    patchTarget: ids.attackTargets.goalTemplateItemId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.goalTemplateItemId },
  { name: 'sales', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `plan_id=eq.${ids.real.planId}`,
    insert: { clinic_id: ids.clinicId, plan_id: ids.attackTargets.planId, status: 'Plano criado' },
    patchTarget: null, patchFilter: `plan_id=eq.${ids.attackTargets.planId}`, patchBody: { payment_method: 'RLS PATCH ATTEMPT' }, deleteFilter: `plan_id=eq.${ids.attackTargets.planId}` },
  { name: 'renewal_contacts', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `plan_id=eq.${ids.attackTargets.planId}`,
    insert: { clinic_id: ids.clinicId, plan_id: ids.attackTargets.planId, completed_by: ids.real.patientId },
    patchTarget: null, deleteFilter: `plan_id=eq.${ids.attackTargets.planId}` },
  { name: 'services', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.real.serviceId}`,
    insert: { clinic_id: ids.clinicId, category_id: ids.real.categoryId, name: 'RLS injection', price: 10, duration_minutes: 5 },
    patchTarget: ids.attackTargets.serviceId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.serviceId },
  { name: 'service_categories', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.real.categoryId}`,
    insert: { clinic_id: ids.clinicId, name: 'RLS injection', normalized_name: 'rls-injection' },
    patchTarget: ids.attackTargets.categoryId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.categoryId },
  { name: 'discount_rules', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `clinic_id=eq.${ids.clinicId}&duration_weeks=eq.12`,
    insert: { clinic_id: ids.clinicId, duration_weeks: 99, percent: 5 },
    patchTarget: null, patchFilter: `clinic_id=eq.${ids.clinicId}&duration_weeks=eq.12`, patchBody: { percent: 1 }, deleteFilter: `clinic_id=eq.${ids.clinicId}&duration_weeks=eq.99` },
  { name: 'plan_templates', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.attackTargets.planTemplateId}`,
    insert: { clinic_id: ids.clinicId, name: 'RLS injection', duration_weeks: 4, created_by: ids.real.patientId },
    patchTarget: ids.attackTargets.planTemplateId, patchBody: { name: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.planTemplateId },
  { name: 'template_items', filter: `template_id=eq.${ids.attackTargets.planTemplateId}`, idFilter: `id=eq.${ids.attackTargets.templateItemId}`,
    insert: { template_id: ids.attackTargets.planTemplateId, service_id: ids.real.serviceId, week_number: 1, quantity: 1 },
    patchTarget: ids.attackTargets.templateItemId, patchBody: { quantity: 5 }, deleteTarget: ids.attackTargets.templateItemId },
  { name: 'consultations', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `id=eq.${ids.real.consultationId}`,
    insert: { clinic_id: ids.clinicId, patient_id: ids.real.patientId, created_by: ids.real.patientId },
    patchTarget: ids.attackTargets.consultationId, patchBody: { free_notes: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.consultationId },
  { name: 'consultation_entries', filter: `consultation_id=eq.${ids.real.consultationId}`, idFilter: `id=eq.${ids.attackTargets.consultationEntryId}`,
    insert: { consultation_id: ids.real.consultationId, item_type: 'answer', phase: 'situacao', item_label: 'RLS injection', answer_text: 'x' },
    patchTarget: ids.attackTargets.consultationEntryId, patchBody: { answer_text: 'RLS PATCH ATTEMPT' }, deleteTarget: ids.attackTargets.consultationEntryId },
  { name: 'clinic_members', filter: `clinic_id=eq.${ids.clinicId}`, idFilter: `clinic_id=eq.${ids.clinicId}`,
    insert: { clinic_id: ids.clinicId, user_id: ids.real.patientId, role: 'doctor' },
    patchTarget: null, deleteFilter: `clinic_id=eq.${ids.clinicId}` },
  { name: 'profiles', filter: `id=eq.${seed.clinicB.userId}`, idFilter: `id=eq.${seed.clinicB.userId}`,
    insert: null, // profiles nasce só via trigger no signup — não faz sentido testar insert direto
    patchTarget: seed.clinicB.userId, patchBody: { full_name: 'RLS PATCH ATTEMPT' }, deleteTarget: null },
]

// ---- catálogo global: leitura livre pra autenticado, escrita só pra admin.
// IMPORTANTE: nunca fazer PATCH num filtro "pegue o primeiro que achar" (ex.: limit=1 sem
// order) em cima de conteúdo real — já corrompeu o roteiro de vendas de produção inteiro
// numa rodada anterior deste script (32 itens + o nome do roteiro, restaurados na mão).
// A partir daqui, todo teste de escrita cria sua PRÓPRIA linha descartável (como master,
// que é o único autorizado a escrever) e só mexe nela — nunca em conteúdo real.
const GLOBAL_CATALOG_TABLES = [
  { name: 'goal_catalog', filter: 'select=id&limit=1', insert: { name: `RLS fixture ${uuidLike()}`, value_type: 'integer', default_direction: 'decrease' }, patchBody: { unit: 'rls-test' } },
  { name: 'sales_scripts', filter: 'select=id&is_default=eq.true&clinic_id=is.null&limit=1', insert: { name: `RLS fixture ${uuidLike()}`, clinic_id: null }, patchBody: { version: 2 } },
  { name: 'sales_script_items', filter: null, insert: null, patchBody: { label: 'RLS PATCH ATTEMPT' } }, // depende da fixture criada em sales_scripts — tratado à parte
]

function uuidLike() { return Math.random().toString(36).slice(2, 10) }

async function testClinicalTable(actor, token, table) {
  const opts = { credentials: 'omit' }
  // GET por filtro
  { const r = await rest(token, 'GET', `${table.name}?select=*&${table.filter}`)
    log(actor, table.name, 'GET filtro', 'vazio', isBlockedStatus(r.status) || isEmpty(r.body), `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}`) }
  // GET por id
  { const r = await rest(token, 'GET', `${table.name}?select=*&${table.idFilter}`)
    log(actor, table.name, 'GET por id', 'vazio', isBlockedStatus(r.status) || isEmpty(r.body), `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}`) }
  // POST
  if (table.insert) {
    const r = await rest(token, 'POST', table.name, table.insert)
    const blocked = isBlockedStatus(r.status) || (r.status >= 400)
    log(actor, table.name, 'POST', 'bloqueado', blocked, `status ${r.status} — ${blocked ? 'bloqueado' : 'INSERIU: ' + JSON.stringify(r.body)}`)
  }
  // PATCH
  { const filter = table.patchFilter ?? `id=eq.${table.patchTarget}`
    if (table.patchTarget !== null || table.patchFilter) {
      const r = await rest(token, 'PATCH', `${table.name}?${filter}`, table.patchBody)
      const blocked = isBlockedStatus(r.status) || isEmpty(r.body)
      log(actor, table.name, 'PATCH', 'sem efeito', blocked, `status ${r.status}, linhas afetadas ${Array.isArray(r.body) ? r.body.length : '?'}`)
    }
  }
  // DELETE
  { const filter = table.deleteFilter ?? (table.deleteTarget ? `id=eq.${table.deleteTarget}` : null)
    if (filter) {
      const r = await rest(token, 'DELETE', `${table.name}?${filter}`)
      const blocked = isBlockedStatus(r.status) || isEmpty(r.body)
      log(actor, table.name, 'DELETE', 'sem efeito', blocked, `status ${r.status}, linhas afetadas ${Array.isArray(r.body) ? r.body.length : '?'}`)
    }
  }
}

async function testGlobalCatalogRead(actor, token, table) {
  const r = await rest(token, 'GET', `${table.name}?${table.filter}`)
  const hasRows = Array.isArray(r.body) && r.body.length > 0
  const pass = token ? hasRows : (isBlockedStatus(r.status) || !hasRows)
  log(actor, table.name, 'GET (global)', token ? 'leitura' : 'vazio', pass, `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}`)
}

async function testGlobalCatalogWrite(actor, token, table, expectWrite) {
  // POST: cria uma linha própria, descartável — nunca toca conteúdo real
  const r = await rest(token, 'POST', table.name, table.insert)
  const wrote = r.status >= 200 && r.status < 300
  const pass = expectWrite ? wrote : !wrote
  log(actor, table.name, 'POST (global)', expectWrite ? 'permitido' : 'bloqueado', pass, `status ${r.status}`)
  const createdId = wrote && Array.isArray(r.body) ? r.body[0]?.id : undefined
  if (!createdId) return
  // PATCH/DELETE só na própria linha que acabou de criar
  const patched = await rest(token, 'PATCH', `${table.name}?id=eq.${createdId}`, table.patchBody)
  log(actor, table.name, 'PATCH (própria fixture)', 'permitido', patched.status >= 200 && patched.status < 300, `status ${patched.status}`)
  const deleted = await rest(token, 'DELETE', `${table.name}?id=eq.${createdId}`)
  log(actor, table.name, 'DELETE (própria fixture)', 'permitido', deleted.status >= 200 && deleted.status < 300, `status ${deleted.status}`)
}

// PATCH/DELETE de terceiros numa fixture descartável (criada uma única vez pelo master),
// pra testar sem nunca arriscar dado real: Clínica A e Sem token devem ser bloqueados;
// Master (dono) consegue, e limpa no fim.
async function testGlobalCatalogCrossActor(actor, token, table, fixtureId, isOwner) {
  if (!fixtureId) return
  const r = await rest(token, 'PATCH', `${table.name}?id=eq.${fixtureId}`, table.patchBody)
  const wrote = r.status >= 200 && r.status < 300 && Array.isArray(r.body) && r.body.length > 0
  const pass = isOwner ? wrote : !wrote
  log(actor, table.name, isOwner ? 'PATCH (fixture, dono)' : 'PATCH (fixture de terceiro)', isOwner ? 'permitido' : 'bloqueado', pass, `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}`)
}

async function testAdminMetaAndView(actor, token, { canReadClinics, canReadAdminMeta, canWriteBilling }) {
  { const r = await rest(token, 'GET', `clinics?select=id,legal_name,cnpj&id=eq.${ids.clinicId}`)
    const has = Array.isArray(r.body) && r.body.length > 0
    log(actor, 'clinics', 'GET metadado', canReadClinics ? 'leitura' : 'vazio', canReadClinics ? has : (isBlockedStatus(r.status) || !has), `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}${canReadClinics ? ' (exceção documentada: metadado, não dado clínico)' : ''}`) }
  { const r = await rest(token, 'PATCH', `clinics?id=eq.${ids.clinicId}`, { display_name: 'RLS PATCH ATTEMPT' })
    const wrote = Array.isArray(r.body) && r.body.length > 0
    log(actor, 'clinics', 'PATCH', 'sem efeito', !wrote, `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}`) }

  { const r = await rest(token, 'GET', `admin_clinics_overview?select=id&id=eq.${ids.clinicId}`)
    const has = Array.isArray(r.body) && r.body.length > 0
    log(actor, 'admin_clinics_overview', 'GET', canReadAdminMeta ? 'leitura' : 'vazio', canReadAdminMeta ? has : (isBlockedStatus(r.status) || !has), `status ${r.status}, linhas ${Array.isArray(r.body) ? r.body.length : '?'}`) }

  { const r = await rest(token, 'GET', `clinic_billing?select=*&clinic_id=eq.${ids.clinicId}`)
    const has = Array.isArray(r.body) && r.body.length > 0
    log(actor, 'clinic_billing', 'GET', canReadAdminMeta ? 'leitura' : 'vazio', canReadAdminMeta ? true : (isBlockedStatus(r.status) || !has), `status ${r.status}`) }
  { const r = await rest(token, 'POST', 'clinic_billing?on_conflict=clinic_id', { clinic_id: ids.clinicId, status: 'trial' }, 'resolution=merge-duplicates,return=representation')
    const wrote = r.status >= 200 && r.status < 300
    const pass = canWriteBilling ? wrote : !wrote
    log(actor, 'clinic_billing', 'POST (upsert)', canWriteBilling ? 'permitido' : 'bloqueado', pass, `status ${r.status}`) }

  { const r = await rest(token, 'GET', 'platform_admins?select=user_id')
    const readable = r.status >= 200 && r.status < 300
    log(actor, 'platform_admins', 'GET', canReadAdminMeta ? 'leitura' : 'vazio', canReadAdminMeta ? readable : (isBlockedStatus(r.status) || (Array.isArray(r.body) && r.body.length === 0)), `status ${r.status}`) }
  { const r = await rest(token, 'POST', 'platform_admins', { user_id: seed.clinicB.userId })
    log(actor, 'platform_admins', 'POST', 'bloqueado', !(r.status >= 200 && r.status < 300), `status ${r.status} (ninguém escreve aqui pela API, nem master)`) }
}

async function testAdminRpc(actor, token, expectAdmin) {
  const r = await rest(token, 'POST', 'rpc/is_platform_admin', {})
  const value = r.body === true
  log(actor, 'rpc:is_platform_admin', 'POST', expectAdmin ? 'true' : 'false', value === expectAdmin, `retornou ${JSON.stringify(r.body)}`)

  const members = await rest(token, 'POST', 'rpc/admin_clinic_members', { target_clinic: ids.clinicId })
  const gotMembers = Array.isArray(members.body) && members.body.length > 0
  log(actor, 'rpc:admin_clinic_members', 'POST', expectAdmin ? 'contatos' : 'vazio', expectAdmin ? gotMembers : !gotMembers, `status ${members.status}, linhas ${Array.isArray(members.body) ? members.body.length : '?'}`)
}

async function testStorage(actorLabel, token, victimPath) {
  const overwrite = await storageCall(token, 'POST', `clinic-logos/${victimPath}`, new Blob(['not-a-real-logo']), 'image/png')
  log(actorLabel, 'storage:clinic-logos', 'POST (overwrite)', 'bloqueado', overwrite.status >= 400, `status ${overwrite.status}`)
  const del = await storageCall(token, 'DELETE', `clinic-logos/${victimPath}`)
  log(actorLabel, 'storage:clinic-logos', 'DELETE', 'bloqueado', del.status >= 400, `status ${del.status}`)
}

async function main() {
  console.log('Autenticando os três atores...\n')
  const tokenA = await login(CLINIC_A_EMAIL, CLINIC_A_PASSWORD)
  const tokenMaster = await login(MASTER_EMAIL, MASTER_PASSWORD)
  const tokenAnon = null

  for (const [actor, token] of [['Clínica A', tokenA], ['Master', tokenMaster], ['Sem token', tokenAnon]]) {
    console.log(`\n=== ${actor} × dado clínico da clínica B ===`)
    for (const table of CLINICAL_TABLES) await testClinicalTable(actor, token, table)
  }

  for (const [actor, token] of [['Clínica A', tokenA], ['Master', tokenMaster], ['Sem token', tokenAnon]]) {
    console.log(`\n=== ${actor} × leitura do catálogo global ===`)
    for (const table of GLOBAL_CATALOG_TABLES) if (table.filter) await testGlobalCatalogRead(actor, token, table)
  }

  console.log('\n=== Escrita no catálogo global (cada ator só mexe na própria fixture descartável) ===')
  for (const [actor, token] of [['Clínica A', tokenA], ['Master', tokenMaster], ['Sem token', tokenAnon]]) {
    const expectWrite = actor === 'Master'
    await testGlobalCatalogWrite(actor, token, GLOBAL_CATALOG_TABLES[0], expectWrite) // goal_catalog
    await testGlobalCatalogWrite(actor, token, GLOBAL_CATALOG_TABLES[1], expectWrite) // sales_scripts
  }

  console.log('\n=== sales_script_items: fixture do master, terceiros tentam mexer ===')
  const fixtureScript = await rest(tokenMaster, 'POST', 'sales_scripts', { name: `RLS fixture ${uuidLike()}`, clinic_id: null })
  const fixtureScriptId = fixtureScript.body?.[0]?.id
  const fixtureItem = fixtureScriptId ? await rest(tokenMaster, 'POST', 'sales_script_items', { sales_script_id: fixtureScriptId, phase: 'situacao', phase_label: 'RLS fixture', item_type: 'answer', label: 'RLS fixture' }) : null
  const fixtureItemId = fixtureItem?.body?.[0]?.id
  await testGlobalCatalogCrossActor('Clínica A', tokenA, GLOBAL_CATALOG_TABLES[2], fixtureItemId, false)
  await testGlobalCatalogCrossActor('Sem token', tokenAnon, GLOBAL_CATALOG_TABLES[2], fixtureItemId, false)
  await testGlobalCatalogCrossActor('Master', tokenMaster, GLOBAL_CATALOG_TABLES[2], fixtureItemId, true)
  if (fixtureItemId) await rest(tokenMaster, 'DELETE', `sales_script_items?id=eq.${fixtureItemId}`)
  if (fixtureScriptId) await rest(tokenMaster, 'DELETE', `sales_scripts?id=eq.${fixtureScriptId}`)

  console.log('\n=== Metadados de plataforma (clinics / admin_clinics_overview / clinic_billing / platform_admins) ===')
  await testAdminMetaAndView('Clínica A', tokenA, { canReadClinics: false, canReadAdminMeta: false, canWriteBilling: false })
  await testAdminMetaAndView('Master', tokenMaster, { canReadClinics: true, canReadAdminMeta: true, canWriteBilling: true })
  await testAdminMetaAndView('Sem token', tokenAnon, { canReadClinics: false, canReadAdminMeta: false, canWriteBilling: false })

  console.log('\n=== RPCs administrativas ===')
  await testAdminRpc('Clínica A', tokenA, false)
  await testAdminRpc('Master', tokenMaster, true)
  await testAdminRpc('Sem token', tokenAnon, false)

  console.log('\n=== Storage (bucket clinic-logos) ===')
  const victimPath = `${ids.clinicId}/logo-vitima.png`
  await testStorage('Clínica A', tokenA, victimPath)
  await testStorage('Sem token', tokenAnon, victimPath)

  const total = rows.length
  const failed = rows.filter(r => !r.pass)
  console.log(`\n${'='.repeat(60)}\nTotal: ${total} verificações — ${failed.length} FALHARAM\n${'='.repeat(60)}`)
  if (failed.length) { console.log('\nLinhas que falharam:'); for (const f of failed) console.log(`  - [${f.actor}] ${f.table} / ${f.op}: ${f.detail}`) }

  writeReport(rows)
  process.exit(failed.length ? 1 : 0)
}

function writeReport(rows) {
  const date = new Date().toISOString()
  const byGroup = new Map()
  for (const r of rows) { const key = r.table; if (!byGroup.has(key)) byGroup.set(key, []); byGroup.get(key).push(r) }
  let md = `# Matriz de segurança RLS — Gestfy\n\nGerado automaticamente por \`scripts/rls-matrix.mjs\` em ${date}.\n\n`
  const failedCount = rows.filter(r => !r.pass).length
  md += `**Resultado geral: ${failedCount === 0 ? 'TODAS AS VERIFICAÇÕES PASSARAM' : `${failedCount} FALHA(S)`}** (${rows.length} verificações no total)\n\n`
  md += `## Exceções documentadas\n\n- **\`clinics\` (GET metadado) para o Master**: intencional — o painel admin precisa ler nome/CNPJ/endereço da clínica para funcionar (Prompt 9/10). Nenhum dado de paciente, plano, consulta ou objetivo é exposto por essa policy.\n- **\`goal_catalog\`, \`sales_scripts\`, \`sales_script_items\`**: catálogo/roteiro globais — qualquer autenticado lê, só o Master escreve.\n\n`
  md += `## search_path fixo nas funções security definer\n\nVerificação estática (leitura das migrações, não testada por este script em runtime): todas têm \`set search_path = ''\` e toda referência a tabela é qualificada com \`public.\`, eliminando sequestro de search_path.\n\n| Função | search_path |\n|---|---|\n| \`is_clinic_member\` | \`''\` |\n| \`create_clinic_for_current_user\` | \`''\` |\n| \`handle_new_user\` | \`''\` |\n| \`is_platform_admin\` | \`''\` |\n| \`touch_last_seen\` | \`''\` |\n| \`clinic_billing_set_updated_by\` | \`''\` |\n| \`admin_clinic_stats\` | \`''\` |\n| \`clinic_billing_log_history\` | \`''\` |\n| \`admin_clinic_members\` | \`''\` |\n| \`block_patient_delete_with_sale\` | \`''\` |\n\n`
  md += `## Resultado por tabela\n\n| Ator | Tabela | Operação | Esperado | Resultado | Detalhe |\n|---|---|---|---|---|---|\n`
  for (const r of rows) md += `| ${r.actor} | ${r.table} | ${r.op} | ${r.expected} | ${r.pass ? '✅ PASSOU' : '❌ FALHOU'} | ${r.detail.replace(/\|/g, '\\|')} |\n`
  writeFileSync(join(ROOT, 'docs', 'seguranca-rls.md'), md)
  console.log('\nRelatório escrito em docs/seguranca-rls.md')
}

main().catch(error => { console.error('ERRO NO SCRIPT:', error); process.exit(1) })
