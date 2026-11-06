export type Service = { id: string; name: string; category: string; categoryId?: string; price: number; duration: number }
export type Patient = { id: string; name: string; initials: string; gender: 'Feminino' | 'Masculino' | 'Outro' | 'Prefere não informar' }
export type WeekItem = { id: string; serviceId: string; quantity?: number; note?: string }
export type Week = { number: number; items: WeekItem[] }
export type SaleStatus = 'Plano criado' | 'Plano vendido' | 'Plano não vendido'

export type SaleSnapshotGoal = {
  name: string
  unit?: string
  direction: GoalDirection
  valueType: GoalValueType
  currentValue?: number
  targetValue?: number
  currentText?: string
  targetText?: string
}
export type SaleSnapshot = {
  planId: string
  planName: string
  patientId?: string
  startDate: string
  duration: number
  weeks: Week[]
  goals: SaleSnapshotGoal[]
  consultationId?: string
  services: Service[]
  subtotal: number
  discountPercent: number
  total: number
  capturedAt: string
}

export type Plan = { id: string; name: string; patientId?: string; duration: number; startDate: string; createdAt: string; weeks: Week[]; status: SaleStatus; updatedAt: string; soldSnapshot?: SaleSnapshot; soldAt?: string; applyDiscount?: boolean }
export type Discount = { duration: number; percent: number }
export type PaymentMethod = { id: string; label: string }

export type GoalDirection = 'decrease' | 'increase' | 'target'
export type GoalValueType = 'number' | 'text'

export type GoalTemplateItem = {
  id: string
  name: string
  unit?: string
  direction: GoalDirection
  valueType: GoalValueType
  defaultCurrent?: number
  defaultTarget?: number
  notes?: string
  sortOrder: number
}
export type GoalTemplateItemInput = Omit<GoalTemplateItem, 'id'> & { id?: string }

export type GoalTemplate = {
  id: string
  clinicId: string
  name: string
  description?: string
  items: GoalTemplateItem[]
  createdAt?: string
  updatedAt?: string
}
export type GoalTemplateInput = { name: string; description?: string; items: GoalTemplateItemInput[] }

export type PlanGoal = {
  id: string
  clinicId: string
  planId: string
  name: string
  unit?: string
  direction: GoalDirection
  valueType: GoalValueType
  currentValue?: number
  targetValue?: number
  currentText?: string
  targetText?: string
  notes?: string
  sortOrder: number
  sourceTemplateItemId?: string
  createdAt?: string
  updatedAt?: string
}
export type PlanGoalInput = Omit<PlanGoal, 'clinicId' | 'planId' | 'createdAt' | 'updatedAt'>

export type GoalCatalogValueType = 'integer' | 'decimal'
export type GoalCatalogItem = {
  id: string
  name: string
  unit?: string
  valueType: GoalCatalogValueType
  decimals: number
  minValue?: number
  maxValue?: number
  defaultDirection: GoalDirection
  sortOrder: number
  active: boolean
}
export type SalesScriptPhase = 'rapport' | 'situacao' | 'problema' | 'implicacao' | 'necessidade' | 'apresentacao' | 'encaminhamento'
export type SalesScriptItemType = 'check' | 'answer' | 'script' | 'attention'
export type ConsultationStatus = 'em_andamento' | 'concluida' | 'abandonada'

export type SalesScriptItem = {
  id: string
  phase: SalesScriptPhase
  phaseLabel: string
  sectionLabel?: string
  timeHint?: string
  itemType: SalesScriptItemType
  label: string
  sortOrder: number
}
export type SalesScriptItemInput = Omit<SalesScriptItem, 'id'> & { id?: string }

export type SalesScript = {
  id: string
  clinicId?: string
  name: string
  version: number
  isDefault: boolean
  items: SalesScriptItem[]
}
export type SalesScriptInput = { name: string; items: SalesScriptItemInput[] }

export type ConsultationEntry = {
  id: string
  consultationId: string
  itemId?: string
  itemType: SalesScriptItemType
  phase: SalesScriptPhase
  itemLabel: string
  answerText?: string
  checked?: boolean
  updatedAt: string
}
export type ConsultationEntryInput = { itemId?: string; itemType: SalesScriptItemType; phase: SalesScriptPhase; itemLabel: string; answerText?: string; checked?: boolean }

export type Consultation = {
  id: string
  clinicId: string
  patientId: string
  planId?: string
  salesScriptId?: string
  status: ConsultationStatus
  currentPhase: SalesScriptPhase
  startedAt: string
  finishedAt?: string
  freeNotes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
export type ConsultationFull = Consultation & { entries: ConsultationEntry[] }

export type ClinicProfile = {
  id: string
  name: string
  plan: string
  legalName: string
  cnpj: string
  phone: string
  email: string
  address: string
  zipCode: string
  city: string
  state: string
  doctorName: string
  doctorEmail: string
  crm: string
  logo: string
  brandPrimary?: string
  brandSecondary?: string
}

export type BillingStatus = 'trial' | 'adimplente' | 'inadimplente' | 'cancelada'

export type AdminClinicOverview = {
  id: string
  name: string
  createdAt: string
  billingStatus?: BillingStatus
  planLabel?: string
  nextDueAt?: string
  lastPaymentAt?: string
  members: number
  patients: number
  plans: number
  sales: number
  lastSeenAt?: string
}

export type AdminClinicDetail = {
  id: string
  legalName: string
  cnpj: string
  phone: string
  email: string
  address: string
  zipCode: string
  city: string
  state: string
}

export type AdminMemberContact = { userId: string; fullName: string; email: string; crm: string; lastSeenAt?: string; emailConfirmedAt?: string; lastSignInAt?: string; createdAt?: string }
export type AdminCreateUserInput = { email: string; password: string; fullName: string; confirmNow: boolean; clinicId?: string; newClinicName?: string }

export type ClinicBillingInput = { status: BillingStatus; planLabel?: string; dueDay?: number; lastPaymentAt?: string; nextDueAt?: string; notes?: string }

export type ClinicBillingHistoryEntry = { id: string; oldStatus?: BillingStatus; newStatus: BillingStatus; notes?: string; changedByEmail?: string; changedAt: string }
