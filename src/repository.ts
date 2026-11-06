import { db, rpc, uploadClinicLogo } from './supabase'
import type { AuthUser } from './supabase'
import type { AdminClinicDetail, AdminClinicOverview, AdminCreateUserInput, AdminMemberContact, ClinicBillingHistoryEntry, ClinicBillingInput, ClinicProfile, Consultation, ConsultationEntry, ConsultationEntryInput, ConsultationFull, ConsultationStatus, Discount, GoalCatalogItem, GoalTemplate, GoalTemplateInput, GoalTemplateItem, Patient, PaymentMethod, Plan, PlanGoal, PlanGoalInput, SaleSnapshot, SalesScript, SalesScriptInput, SaleStatus, Service, Week } from './types'

type Row = Record<string, any>

export type WorkspaceData = {
  clinic: ClinicProfile
  patients: Patient[]
  services: Service[]
  categories: string[]
  categoryIds: Record<string, string>
  discounts: Discount[]
  paymentMethods: PaymentMethod[]
  plans: Plan[]
  completedRenewals: string[]
}

const rowToSaleSnapshot = (raw: Row | null | undefined): SaleSnapshot | undefined => {
  if (!raw) return undefined
  const legacyPlan = raw.plan ?? {}
  return {
    planId: raw.planId ?? legacyPlan.id,
    planName: raw.planName ?? legacyPlan.name,
    patientId: raw.patientId ?? legacyPlan.patientId,
    startDate: raw.startDate ?? legacyPlan.startDate,
    duration: raw.duration ?? legacyPlan.duration,
    weeks: raw.weeks ?? [],
    goals: raw.goals ?? [],
    consultationId: raw.consultationId ?? undefined,
    services: raw.services ?? [],
    subtotal: raw.subtotal ?? 0,
    discountPercent: raw.discountPercent ?? 0,
    total: raw.total ?? 0,
    capturedAt: raw.capturedAt,
  }
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
const readableDate = (value?: string) => value ? new Date(value).toLocaleDateString('pt-BR') : 'Agora'
export const normalizeCategory = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/s$/, '').trim()

const rowsToWeeks = (duration: number, items: Row[]): Week[] => {
  const weeks = Array.from({ length: duration }, (_, index) => ({ number: index + 1, items: [] as Week['items'] }))
  for (const item of items ?? []) {
    const week = weeks[item.week_number - 1]
    if (week) week.items.push({ id: item.id, serviceId: item.service_id, quantity: item.quantity, note: item.note ?? undefined })
  }
  return weeks
}

const planItemsPayload = (planId: string, weeks: Week[], key: 'plan_id' | 'template_id') => weeks.flatMap(week => week.items.map(item => ({
  id: item.id,
  [key]: planId,
  service_id: item.serviceId,
  week_number: week.number,
  quantity: item.quantity ?? 1,
  note: item.note ?? null,
})))

export async function loadWorkspace(user: AuthUser): Promise<WorkspaceData> {
  let memberships = await db<Row[]>('clinic_members', { query: `select=clinic_id&user_id=eq.${user.id}&limit=1` })
  if (!memberships.length) {
    const clinicId = await rpc<string>('create_clinic_for_current_user', { initial_name: '' })
    memberships = [{ clinic_id: clinicId }]
  }
  const clinicId = memberships[0].clinic_id

  const [profileRows, clinicRows, patientsRows, categoryRows, serviceRows, discountRows, paymentMethodRows, templateRows, planRows, renewalRows] = await Promise.all([
    db<Row[]>('profiles', { query: `select=*&id=eq.${user.id}&limit=1` }),
    db<Row[]>('clinics', { query: `select=*&id=eq.${clinicId}&limit=1` }),
    db<Row[]>('patients', { query: `select=*&clinic_id=eq.${clinicId}&archived_at=is.null&order=name.asc` }),
    db<Row[]>('service_categories', { query: `select=*&clinic_id=eq.${clinicId}&order=name.asc` }),
    db<Row[]>('services', { query: `select=*&clinic_id=eq.${clinicId}&order=name.asc` }),
    db<Row[]>('discount_rules', { query: `select=*&clinic_id=eq.${clinicId}&order=duration_weeks.asc` }),
    // toleramos a tabela ainda não existir enquanto a migração não roda em produção, pra não derrubar o carregamento do workspace inteiro
    db<Row[]>('payment_methods', { query: `select=id,label&clinic_id=eq.${clinicId}&order=created_at.asc` }).catch(() => [] as Row[]),
    db<Row[]>('plan_templates', { query: `select=*,template_items(*)&clinic_id=eq.${clinicId}&order=updated_at.desc` }),
    db<Row[]>('plans', { query: `select=*,plan_items(*),sales(*)&clinic_id=eq.${clinicId}&order=updated_at.desc` }),
    db<Row[]>('renewal_contacts', { query: `select=plan_id&clinic_id=eq.${clinicId}` }),
  ])

  const profile = profileRows[0] ?? {}
  const clinicRow = clinicRows[0] ?? {}
  const categoryById = new Map(categoryRows.map(row => [row.id, row.name]))
  const categoryIds = Object.fromEntries(categoryRows.map(row => [row.name, row.id]))
  const logo = clinicRow.logo_path ? `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/clinic-logos/${clinicRow.logo_path}` : ''

  const templates: Plan[] = templateRows.map(row => ({
    id: row.id,
    name: row.name,
    duration: row.duration_weeks,
    startDate: new Date().toISOString().slice(0, 10),
    createdAt: row.created_at?.slice(0, 10),
    updatedAt: readableDate(row.updated_at),
    status: 'Plano criado',
    weeks: rowsToWeeks(row.duration_weeks, row.template_items),
  }))

  const individualPlans: Plan[] = planRows.map(row => {
    const sale = Array.isArray(row.sales) ? row.sales[0] : row.sales
    return {
      id: row.id,
      name: row.name,
      patientId: row.patient_id,
      duration: row.duration_weeks,
      startDate: row.start_date,
      createdAt: row.created_at?.slice(0, 10),
      updatedAt: readableDate(row.updated_at),
      status: sale?.status ?? 'Plano criado',
      soldSnapshot: rowToSaleSnapshot(sale?.sold_snapshot),
      soldAt: sale?.sold_at,
      weeks: rowsToWeeks(row.duration_weeks, row.plan_items),
      applyDiscount: row.apply_discount ?? true,
    }
  })

  return {
    clinic: {
      id: clinicId,
      name: clinicRow.display_name ?? '',
      plan: '',
      legalName: clinicRow.legal_name ?? '',
      cnpj: clinicRow.cnpj ?? '',
      phone: clinicRow.phone ?? '',
      email: clinicRow.email ?? '',
      address: clinicRow.address ?? '',
      zipCode: clinicRow.zip_code ?? '',
      city: clinicRow.city ?? '',
      state: clinicRow.state ?? '',
      doctorName: profile.full_name ?? '',
      doctorEmail: profile.email ?? user.email ?? '',
      crm: profile.crm ?? '',
      logo,
      brandPrimary: clinicRow.brand_primary_color ?? '',
      brandSecondary: clinicRow.brand_secondary_color ?? '',
    },
    patients: patientsRows.map(row => ({ id: row.id, name: row.name, initials: initials(row.name), gender: row.gender })),
    categories: categoryRows.map(row => row.name),
    categoryIds,
    services: serviceRows.map(row => ({ id: row.id, name: row.name, categoryId: row.category_id, category: categoryById.get(row.category_id) ?? '', price: Number(row.price), duration: row.duration_minutes })),
    discounts: discountRows.map(row => ({ duration: row.duration_weeks, percent: Number(row.percent) })),
    paymentMethods: paymentMethodRows.map(row => ({ id: row.id, label: row.label })),
    plans: [...individualPlans, ...templates],
    completedRenewals: renewalRows.map(row => row.plan_id),
  }
}

export async function saveClinic(clinic: ClinicProfile, userId: string) {
  await Promise.all([
    db('clinics', {
      method: 'PATCH',
      query: `id=eq.${clinic.id}`,
      body: { display_name: clinic.name, legal_name: clinic.legalName, cnpj: clinic.cnpj, phone: clinic.phone, email: clinic.email, zip_code: clinic.zipCode, address: clinic.address, city: clinic.city, state: clinic.state, brand_primary_color: clinic.brandPrimary || null, brand_secondary_color: clinic.brandSecondary || null, ...(clinic.logo ? {} : { logo_path: null }) },
    }),
    db('profiles', { method: 'PATCH', query: `id=eq.${userId}`, body: { full_name: clinic.doctorName, email: clinic.doctorEmail, crm: clinic.crm } }),
  ])
}

export async function saveLogo(clinicId: string, file: File) {
  const uploaded = await uploadClinicLogo(clinicId, file)
  await db('clinics', { method: 'PATCH', query: `id=eq.${clinicId}`, body: { logo_path: uploaded.path } })
  return uploaded.publicUrl
}

export async function upsertPatient(clinicId: string, patient: Patient) {
  const [row] = await db<Row[]>('patients', { method: 'POST', query: 'on_conflict=id', prefer: 'resolution=merge-duplicates,return=representation', body: { id: patient.id, clinic_id: clinicId, name: patient.name, gender: patient.gender } })
  return { ...patient, id: row.id, initials: initials(row.name) }
}

export const deletePatient = (id: string) => db('patients', { method: 'DELETE', query: `id=eq.${id}` })

export const archivePatient = (id: string) => db('patients', { method: 'PATCH', query: `id=eq.${id}`, body: { archived_at: new Date().toISOString() } })

export type PatientDeletionSummary = { plans: number; consultations: number; goals: number; hasSale: boolean }

export async function getPatientDeletionSummary(patientId: string): Promise<PatientDeletionSummary> {
  const [plans, consultations] = await Promise.all([
    db<Row[]>('plans', { query: `select=id&patient_id=eq.${patientId}` }),
    db<Row[]>('consultations', { query: `select=id&patient_id=eq.${patientId}` }),
  ])
  const planIds = plans.map(p => p.id)
  const idsList = planIds.join(',') || '00000000-0000-0000-0000-000000000000'
  const [goals, sales] = await Promise.all([
    planIds.length ? db<Row[]>('plan_goals', { query: `select=id&plan_id=in.(${idsList})` }) : Promise.resolve([]),
    planIds.length ? db<Row[]>('sales', { query: `select=id&plan_id=in.(${idsList})&status=eq.Plano vendido` }) : Promise.resolve([]),
  ])
  return { plans: plans.length, consultations: consultations.length, goals: goals.length, hasSale: sales.length > 0 }
}

export async function createCategory(clinicId: string, name: string) {
  const [row] = await db<Row[]>('service_categories', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name, normalized_name: normalizeCategory(name) } })
  return { id: row.id as string, name: row.name as string }
}

export const deleteCategory = (id: string) => db('service_categories', { method: 'DELETE', query: `id=eq.${id}` })

export async function upsertService(clinicId: string, service: Service, categoryId: string) {
  const [row] = await db<Row[]>('services', { method: 'POST', query: 'on_conflict=id', prefer: 'resolution=merge-duplicates,return=representation', body: { id: service.id, clinic_id: clinicId, category_id: categoryId, name: service.name, price: service.price, duration_minutes: service.duration } })
  return { ...service, id: row.id, categoryId: row.category_id }
}

export const deleteService = (id: string) => db('services', { method: 'DELETE', query: `id=eq.${id}` })

export const deletePlan = (id: string) => db('plans', { method: 'DELETE', query: `id=eq.${id}` })

export const saveDiscounts = (clinicId: string, discounts: Discount[]) => db('discount_rules', {
  method: 'POST',
  query: 'on_conflict=clinic_id,duration_weeks',
  prefer: 'resolution=merge-duplicates',
  body: discounts.map(discount => ({ clinic_id: clinicId, duration_weeks: discount.duration, percent: discount.percent })),
})

export async function createPaymentMethod(clinicId: string, label: string) {
  const [row] = await db<Row[]>('payment_methods', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, label } })
  return { id: row.id as string, label: row.label as string }
}

export const deletePaymentMethod = (id: string) => db('payment_methods', { method: 'DELETE', query: `id=eq.${id}` })

export async function upsertPlan(clinicId: string, userId: string, plan: Plan) {
  if (!plan.patientId) {
    await db('plan_templates', { method: 'POST', query: 'on_conflict=id', prefer: 'resolution=merge-duplicates', body: { id: plan.id, clinic_id: clinicId, name: plan.name, duration_weeks: plan.duration, created_by: userId } })
    await db('template_items', { method: 'DELETE', query: `template_id=eq.${plan.id}` })
    const items = planItemsPayload(plan.id, plan.weeks, 'template_id')
    if (items.length) await db('template_items', { method: 'POST', body: items })
    return plan
  }

  await db('plans', { method: 'POST', query: 'on_conflict=id', prefer: 'resolution=merge-duplicates', body: { id: plan.id, clinic_id: clinicId, patient_id: plan.patientId, name: plan.name, duration_weeks: plan.duration, start_date: plan.startDate, created_by: userId, apply_discount: plan.applyDiscount ?? true } })
  await db('plan_items', { method: 'DELETE', query: `plan_id=eq.${plan.id}` })
  const items = planItemsPayload(plan.id, plan.weeks, 'plan_id')
  if (items.length) await db('plan_items', { method: 'POST', body: items })
  // status sempre 'Plano criado' aqui: esta chamada só garante que a linha de venda exista para um plano novo.
  // Mudar o status é responsabilidade exclusiva de updateSale — nunca reenviar plan.status aqui, ou o valor
  // 'Plano vendido' sem sold_snapshot/sold_at reprovaria a check constraint mesmo com ignore-duplicates.
  await db('sales', { method: 'POST', query: 'on_conflict=plan_id', prefer: 'resolution=ignore-duplicates', body: { clinic_id: clinicId, plan_id: plan.id, status: 'Plano criado' } })
  return plan
}

export async function updateSale(clinicId: string, plan: Plan, status: SaleStatus, services: Service[], discounts: Discount[]): Promise<SaleSnapshot | undefined> {
  const subtotal = plan.weeks.flatMap(week => week.items).reduce((total, item) => total + (services.find(service => service.id === item.serviceId)?.price ?? 0) * (item.quantity ?? 1), 0)
  const discount = plan.applyDiscount === false ? 0 : (discounts.find(rule => rule.duration === plan.duration)?.percent ?? 0)
  const total = subtotal * (1 - discount / 100)
  let snapshot: SaleSnapshot | undefined
  let soldAt: string | undefined
  if (status === 'Plano vendido') {
    const [goals, consultation] = await Promise.all([listPlanGoals(plan.id), getConsultationByPlan(plan.id)])
    soldAt = new Date().toISOString()
    snapshot = {
      planId: plan.id,
      planName: plan.name,
      patientId: plan.patientId,
      startDate: plan.startDate,
      duration: plan.duration,
      weeks: plan.weeks,
      goals: goals.map(goal => ({ name: goal.name, unit: goal.unit, direction: goal.direction, valueType: goal.valueType, currentValue: goal.currentValue, targetValue: goal.targetValue, currentText: goal.currentText, targetText: goal.targetText })),
      consultationId: consultation?.id,
      services: services.filter(service => plan.weeks.some(week => week.items.some(item => item.serviceId === service.id))),
      subtotal,
      discountPercent: discount,
      total,
      capturedAt: soldAt,
    }
  }
  await db('sales', {
    method: 'PATCH',
    query: `plan_id=eq.${plan.id}&clinic_id=eq.${clinicId}`,
    body: { status, subtotal, discount_percent: discount, total, ...(snapshot ? { sold_snapshot: snapshot, sold_at: soldAt } : {}) },
  })
  return snapshot
}

export const completeRenewal = (clinicId: string, planId: string, userId: string) => db('renewal_contacts', {
  method: 'POST',
  query: 'on_conflict=plan_id',
  prefer: 'resolution=merge-duplicates',
  body: { clinic_id: clinicId, plan_id: planId, completed_by: userId },
})

const rowToGoalTemplateItem = (row: Row): GoalTemplateItem => ({
  id: row.id,
  name: row.name,
  unit: row.unit ?? undefined,
  direction: row.direction,
  valueType: row.value_type,
  defaultCurrent: row.default_current !== null ? Number(row.default_current) : undefined,
  defaultTarget: row.default_target !== null ? Number(row.default_target) : undefined,
  notes: row.notes ?? undefined,
  sortOrder: row.sort_order,
})

const rowToGoalTemplate = (row: Row): GoalTemplate => ({
  id: row.id,
  clinicId: row.clinic_id,
  name: row.name,
  description: row.description ?? undefined,
  items: ((row.goal_template_items ?? []) as Row[]).map(rowToGoalTemplateItem).sort((a, b) => a.sortOrder - b.sortOrder),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const goalTemplateItemPayload = (goalTemplateId: string, item: GoalTemplateInput['items'][number]) => ({
  id: item.id ?? crypto.randomUUID(),
  goal_template_id: goalTemplateId,
  name: item.name,
  unit: item.unit ?? null,
  direction: item.direction,
  value_type: item.valueType,
  default_current: item.defaultCurrent ?? null,
  default_target: item.defaultTarget ?? null,
  notes: item.notes ?? null,
  sort_order: item.sortOrder,
})

export async function listGoalTemplates(clinicId: string): Promise<GoalTemplate[]> {
  const rows = await db<Row[]>('goal_templates', { query: `select=*,goal_template_items(*)&clinic_id=eq.${clinicId}&order=name.asc` })
  return rows.map(rowToGoalTemplate)
}

export async function getGoalTemplate(id: string): Promise<GoalTemplate | null> {
  const rows = await db<Row[]>('goal_templates', { query: `select=*,goal_template_items(*)&id=eq.${id}&limit=1` })
  return rows[0] ? rowToGoalTemplate(rows[0]) : null
}

export async function createGoalTemplate(clinicId: string, template: GoalTemplateInput): Promise<GoalTemplate> {
  const [row] = await db<Row[]>('goal_templates', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: template.name, description: template.description ?? null } })
  const items = template.items.length ? await db<Row[]>('goal_template_items', { method: 'POST', prefer: 'return=representation', body: template.items.map(item => goalTemplateItemPayload(row.id, item)) }) : []
  return rowToGoalTemplate({ ...row, goal_template_items: items })
}

export async function updateGoalTemplate(id: string, template: GoalTemplateInput): Promise<GoalTemplate> {
  const [row] = await db<Row[]>('goal_templates', { method: 'PATCH', query: `id=eq.${id}`, prefer: 'return=representation', body: { name: template.name, description: template.description ?? null } })
  await db('goal_template_items', { method: 'DELETE', query: `goal_template_id=eq.${id}` })
  const items = template.items.length ? await db<Row[]>('goal_template_items', { method: 'POST', prefer: 'return=representation', body: template.items.map(item => goalTemplateItemPayload(id, item)) }) : []
  return rowToGoalTemplate({ ...row, goal_template_items: items })
}

export const deleteGoalTemplate = (id: string) => db('goal_templates', { method: 'DELETE', query: `id=eq.${id}` })

const rowToPlanGoal = (row: Row): PlanGoal => ({
  id: row.id,
  clinicId: row.clinic_id,
  planId: row.plan_id,
  name: row.name,
  unit: row.unit ?? undefined,
  direction: row.direction,
  valueType: row.value_type,
  currentValue: row.current_value !== null ? Number(row.current_value) : undefined,
  targetValue: row.target_value !== null ? Number(row.target_value) : undefined,
  currentText: row.current_text ?? undefined,
  targetText: row.target_text ?? undefined,
  notes: row.notes ?? undefined,
  sortOrder: row.sort_order,
  sourceTemplateItemId: row.source_template_item_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const planGoalPayload = (clinicId: string, planId: string, goal: PlanGoalInput) => ({
  id: goal.id,
  clinic_id: clinicId,
  plan_id: planId,
  name: goal.name,
  unit: goal.unit ?? null,
  direction: goal.direction,
  value_type: goal.valueType,
  current_value: goal.currentValue ?? null,
  target_value: goal.targetValue ?? null,
  current_text: goal.currentText ?? null,
  target_text: goal.targetText ?? null,
  notes: goal.notes ?? null,
  sort_order: goal.sortOrder,
  source_template_item_id: goal.sourceTemplateItemId ?? null,
})

export async function listPlanGoals(planId: string): Promise<PlanGoal[]> {
  const rows = await db<Row[]>('plan_goals', { query: `select=*&plan_id=eq.${planId}&order=sort_order.asc` })
  return rows.map(rowToPlanGoal)
}

export async function upsertPlanGoals(clinicId: string, planId: string, goals: PlanGoalInput[]): Promise<PlanGoal[]> {
  if (!goals.length) return []
  const rows = await db<Row[]>('plan_goals', { method: 'POST', query: 'on_conflict=id', prefer: 'resolution=merge-duplicates,return=representation', body: goals.map(goal => planGoalPayload(clinicId, planId, goal)) })
  return rows.map(rowToPlanGoal)
}

export const deletePlanGoal = (id: string) => db('plan_goals', { method: 'DELETE', query: `id=eq.${id}` })

const rowToGoalCatalogItem = (row: Row): GoalCatalogItem => ({
  id: row.id,
  name: row.name,
  unit: row.unit ?? undefined,
  valueType: row.value_type,
  decimals: row.decimals,
  minValue: row.min_value !== null ? Number(row.min_value) : undefined,
  maxValue: row.max_value !== null ? Number(row.max_value) : undefined,
  defaultDirection: row.default_direction,
  sortOrder: row.sort_order,
  active: row.active,
})

export async function listGoalCatalog(): Promise<GoalCatalogItem[]> {
  const rows = await db<Row[]>('goal_catalog', { query: 'select=*&active=eq.true&order=sort_order.asc' })
  return rows.map(rowToGoalCatalogItem)
}

const rowToSalesScriptItem = (row: Row) => ({
  id: row.id as string,
  phase: row.phase,
  phaseLabel: row.phase_label as string,
  sectionLabel: row.section_label ?? undefined,
  timeHint: row.time_hint ?? undefined,
  itemType: row.item_type,
  label: row.label as string,
  sortOrder: row.sort_order as number,
})

const rowToSalesScript = (row: Row): SalesScript => ({
  id: row.id,
  clinicId: row.clinic_id ?? undefined,
  name: row.name,
  version: row.version,
  isDefault: row.is_default,
  items: ((row.sales_script_items ?? []) as Row[]).map(rowToSalesScriptItem).sort((a, b) => a.sortOrder - b.sortOrder),
})

const salesScriptItemPayload = (salesScriptId: string, item: SalesScriptInput['items'][number]) => ({
  sales_script_id: salesScriptId,
  phase: item.phase,
  phase_label: item.phaseLabel,
  section_label: item.sectionLabel ?? null,
  time_hint: item.timeHint ?? null,
  item_type: item.itemType,
  label: item.label,
  sort_order: item.sortOrder,
})

const globalDefaultSalesScript = async (): Promise<SalesScript | null> => {
  const rows = await db<Row[]>('sales_scripts', { query: 'select=*,sales_script_items(*)&is_default=eq.true&clinic_id=is.null&limit=1' })
  return rows[0] ? rowToSalesScript(rows[0]) : null
}

export async function getClinicSalesScript(clinicId: string): Promise<SalesScript | null> {
  const rows = await db<Row[]>('sales_scripts', { query: `select=*,sales_script_items(*)&clinic_id=eq.${clinicId}&limit=1` })
  return rows[0] ? rowToSalesScript(rows[0]) : null
}

export async function getSalesScript(clinicId: string): Promise<SalesScript | null> {
  return (await getClinicSalesScript(clinicId)) ?? (await globalDefaultSalesScript())
}

export async function cloneSalesScriptForClinic(clinicId: string): Promise<SalesScript> {
  const base = await globalDefaultSalesScript()
  if (!base) throw new Error('Nenhum roteiro padrão da plataforma encontrado para copiar.')
  const [row] = await db<Row[]>('sales_scripts', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, name: base.name, version: base.version, is_default: true } })
  const items = base.items.length ? await db<Row[]>('sales_script_items', { method: 'POST', prefer: 'return=representation', body: base.items.map(item => salesScriptItemPayload(row.id, item)) }) : []
  return rowToSalesScript({ ...row, sales_script_items: items })
}

export async function updateSalesScript(id: string, script: SalesScriptInput): Promise<SalesScript> {
  const [row] = await db<Row[]>('sales_scripts', { method: 'PATCH', query: `id=eq.${id}`, prefer: 'return=representation', body: { name: script.name } })
  await db('sales_script_items', { method: 'DELETE', query: `sales_script_id=eq.${id}` })
  const items = script.items.length ? await db<Row[]>('sales_script_items', { method: 'POST', prefer: 'return=representation', body: script.items.map(item => salesScriptItemPayload(id, item)) }) : []
  return rowToSalesScript({ ...row, sales_script_items: items })
}

export const resetSalesScriptToDefault = (id: string) => db('sales_scripts', { method: 'DELETE', query: `id=eq.${id}` })

const rowToConsultation = (row: Row): Consultation => ({
  id: row.id,
  clinicId: row.clinic_id,
  patientId: row.patient_id,
  planId: row.plan_id ?? undefined,
  salesScriptId: row.sales_script_id ?? undefined,
  status: row.status,
  currentPhase: row.current_phase,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
  freeNotes: row.free_notes ?? undefined,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function startConsultation(clinicId: string, patientId: string, userId: string, options?: { planId?: string; salesScriptId?: string }): Promise<Consultation> {
  const [row] = await db<Row[]>('consultations', { method: 'POST', prefer: 'return=representation', body: { clinic_id: clinicId, patient_id: patientId, plan_id: options?.planId ?? null, sales_script_id: options?.salesScriptId ?? null, created_by: userId } })
  return rowToConsultation(row)
}

const rowToConsultationEntry = (row: Row): ConsultationEntry => ({
  id: row.id,
  consultationId: row.consultation_id,
  itemId: row.item_id ?? undefined,
  itemType: row.item_type,
  phase: row.phase,
  itemLabel: row.item_label,
  answerText: row.answer_text ?? undefined,
  checked: row.checked ?? undefined,
  updatedAt: row.updated_at,
})

export async function saveEntry(consultationId: string, entry: ConsultationEntryInput): Promise<ConsultationEntry> {
  const [row] = await db<Row[]>('consultation_entries', {
    method: 'POST',
    query: 'on_conflict=consultation_id,item_id',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { consultation_id: consultationId, item_id: entry.itemId ?? null, item_type: entry.itemType, phase: entry.phase, item_label: entry.itemLabel, answer_text: entry.answerText ?? null, checked: entry.checked ?? null },
  })
  return rowToConsultationEntry(row)
}

export async function finishConsultation(consultationId: string, status: Extract<ConsultationStatus, 'concluida' | 'abandonada'> = 'concluida') {
  await db('consultations', { method: 'PATCH', query: `id=eq.${consultationId}`, body: { status, finished_at: new Date().toISOString() } })
}

export async function listConsultationsByPatient(patientId: string): Promise<Consultation[]> {
  const rows = await db<Row[]>('consultations', { query: `select=*&patient_id=eq.${patientId}&order=started_at.desc` })
  return rows.map(rowToConsultation)
}

export async function getConsultationFull(id: string): Promise<ConsultationFull | null> {
  const rows = await db<Row[]>('consultations', { query: `select=*,consultation_entries(*)&id=eq.${id}&limit=1` })
  if (!rows[0]) return null
  const row = rows[0]
  return { ...rowToConsultation(row), entries: ((row.consultation_entries ?? []) as Row[]).map(rowToConsultationEntry) }
}

export const setConsultationPhase = (id: string, phase: Consultation['currentPhase']) => db('consultations', { method: 'PATCH', query: `id=eq.${id}`, body: { current_phase: phase } })

export const updateConsultationNotes = (id: string, notes: string) => db('consultations', { method: 'PATCH', query: `id=eq.${id}`, body: { free_notes: notes || null } })

export const linkConsultationToPlan = (consultationId: string, planId: string) => db('consultations', { method: 'PATCH', query: `id=eq.${consultationId}`, body: { plan_id: planId } })

export const touchLastSeen = () => rpc('touch_last_seen', {})

export const isPlatformAdmin = () => rpc<boolean>('is_platform_admin', {})

const rowToAdminClinicOverview = (row: Row): AdminClinicOverview => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  billingStatus: row.billing_status ?? undefined,
  planLabel: row.plan_label ?? undefined,
  nextDueAt: row.next_due_at ?? undefined,
  lastPaymentAt: row.last_payment_at ?? undefined,
  members: Number(row.members ?? 0),
  patients: Number(row.patients ?? 0),
  plans: Number(row.plans ?? 0),
  sales: Number(row.sales ?? 0),
  lastSeenAt: row.last_seen_at ?? undefined,
})

export async function listAdminClinics(): Promise<AdminClinicOverview[]> {
  const rows = await db<Row[]>('admin_clinics_overview', { query: 'select=*' })
  return rows.map(rowToAdminClinicOverview)
}

export async function getAdminClinicDetail(clinicId: string): Promise<AdminClinicDetail | null> {
  const rows = await db<Row[]>('clinics', { query: `select=id,legal_name,cnpj,phone,email,address,zip_code,city,state&id=eq.${clinicId}&limit=1` })
  const row = rows[0]
  if (!row) return null
  return { id: row.id, legalName: row.legal_name ?? '', cnpj: row.cnpj ?? '', phone: row.phone ?? '', email: row.email ?? '', address: row.address ?? '', zipCode: row.zip_code ?? '', city: row.city ?? '', state: row.state ?? '' }
}

export async function getAdminClinicMembers(clinicId: string): Promise<AdminMemberContact[]> {
  const rows = await rpc<Row[]>('admin_clinic_members', { target_clinic: clinicId })
  return rows.map(row => ({ userId: row.user_id, fullName: row.full_name ?? '', email: row.email ?? '', crm: row.crm ?? '', lastSeenAt: row.last_seen_at ?? undefined, emailConfirmedAt: row.email_confirmed_at ?? undefined, lastSignInAt: row.last_sign_in_at ?? undefined }))
}

export const adminCreateUser = (input: AdminCreateUserInput) => rpc<{ user_id: string; clinic_id: string }>('admin_create_user', {
  target_email: input.email,
  target_password: input.password,
  target_full_name: input.fullName,
  confirm_now: input.confirmNow,
  target_clinic: input.clinicId ?? null,
  new_clinic_name: input.newClinicName ?? null,
})

export async function getAdminUsersWithoutClinic(): Promise<AdminMemberContact[]> {
  const rows = await rpc<Row[]>('admin_users_without_clinic', {})
  return rows.map(row => ({ userId: row.user_id, fullName: row.full_name ?? '', email: row.email ?? '', crm: '', createdAt: row.created_at ?? undefined, emailConfirmedAt: row.email_confirmed_at ?? undefined, lastSignInAt: row.last_sign_in_at ?? undefined }))
}

export const adminConfirmUser =(userId: string) => rpc('admin_confirm_user', { target_user: userId })

export const adminSetUserPassword = (userId: string, password: string) => rpc('admin_set_user_password', { target_user: userId, new_password: password })

export async function getClinicBillingHistory(clinicId: string): Promise<ClinicBillingHistoryEntry[]> {
  const rows = await db<Row[]>('clinic_billing_history', { query: `select=*&clinic_id=eq.${clinicId}&order=changed_at.desc` })
  return rows.map(row => ({ id: row.id, oldStatus: row.old_status ?? undefined, newStatus: row.new_status, notes: row.notes ?? undefined, changedByEmail: row.changed_by_email ?? undefined, changedAt: row.changed_at }))
}

export const saveClinicBilling = (clinicId: string, billing: ClinicBillingInput) => db('clinic_billing', {
  method: 'POST',
  query: 'on_conflict=clinic_id',
  prefer: 'resolution=merge-duplicates',
  body: { clinic_id: clinicId, status: billing.status, plan_label: billing.planLabel || null, due_day: billing.dueDay ?? null, last_payment_at: billing.lastPaymentAt || null, next_due_at: billing.nextDueAt || null, notes: billing.notes || null },
})

export async function getConsultationByPlan(planId: string): Promise<Consultation | null> {
  const rows = await db<Row[]>('consultations', { query: `select=*&plan_id=eq.${planId}&limit=1` })
  return rows[0] ? rowToConsultation(rows[0]) : null
}
