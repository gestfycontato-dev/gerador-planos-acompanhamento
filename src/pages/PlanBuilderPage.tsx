import { useEffect, useMemo, useRef, useState } from 'react'
import { addWeeks, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, BookOpen, CalendarCheck, CalendarDays, Check, Copy, FileText, Handshake, Library, Lightbulb, ListChecks, MoreHorizontal, Plus, Quote, RefreshCw, Search, Stethoscope, Target, Trash2, X } from 'lucide-react'
import { money } from '../data'
import { consultationPhases, durationOptions } from '../lib/constants'
import { errorMessage } from '../lib/format'
import { clampDecimalInput, formatDecimalInput, parseDecimalInput, sanitizeConstrainedInput } from '../lib/decimal'
import { directionLabels, findCatalogMatch, valueTypeLabels } from '../lib/goalLabels'
import { phaseNames } from '../lib/salesScriptLabels'
import { buildRecordText, formatGoalLine } from '../lib/recordSummary'
import { downloadContractDocx, printPlanDocument, printPresentationDocument } from '../lib/documents'
import type { PresentationGoal } from '../lib/documents'
import { deletePlanGoal, finishConsultation, getConsultationByPlan, getConsultationFull, getGoalTemplate, getSalesScript, linkConsultationToPlan, listGoalCatalog, listGoalTemplates, listPlanGoals, saveEntry, startConsultation, upsertPlanGoals } from '../repository'
import type { ClinicProfile, Consultation, Discount, GoalCatalogItem, GoalDirection, GoalTemplate, GoalValueType, Patient, PaymentMethod, Plan, PlanGoalInput, SalesScript, SalesScriptItem, SalesScriptPhase, SaleSnapshotGoal, SaleStatus, Service, Week, WeekItem } from '../types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PlanPresentationView } from '../components/PlanPresentationView'
import { RecordSummaryModal } from '../components/RecordSummaryModal'

type GoalRowDraft = {
  id: string
  name: string
  unit: string
  direction: GoalDirection
  valueType: GoalValueType
  currentInput: string
  targetInput: string
  notes: string
  sortOrder: number
  sourceTemplateItemId?: string
  catalogDecimals?: number
  catalogMin?: number
  catalogMax?: number
}

type FlowStep = 'patient' | 'start' | 'questions' | 'goals' | 'schedule' | 'presentation' | 'name' | 'documents' | SalesScriptPhase
const preBuildPhases: SalesScriptPhase[] = consultationPhases.filter(p => p !== 'apresentacao' && p !== 'encaminhamento')
const isPhaseStep = (s: FlowStep): s is SalesScriptPhase => (consultationPhases as string[]).includes(s)
const phaseTabLabel: Partial<Record<SalesScriptPhase, string>> = { apresentacao: 'Preparação p/ venda', encaminhamento: 'Fechamento' }
const stepLabel = (s: FlowStep): string => {
  if (isPhaseStep(s)) return phaseTabLabel[s] ?? phaseNames[s]
  return { patient: 'Paciente', start: 'Data de início', questions: 'Perguntas', goals: 'Objetivos', schedule: 'Calendário', presentation: 'Apresentação', name: 'Nome do plano', documents: 'Documentos' }[s]
}

const blankGoalRow = (sortOrder: number): GoalRowDraft => ({ id: crypto.randomUUID(), name: '', unit: '', direction: 'decrease', valueType: 'number', currentInput: '', targetInput: '', notes: '', sortOrder })
const isGoalRowEmpty = (row: GoalRowDraft) => !row.name.trim() && !row.unit.trim() && !row.currentInput.trim() && !row.targetInput.trim() && !row.notes.trim()
const goalRowToInput = (row: GoalRowDraft): PlanGoalInput => {
  const base = { id: row.id, name: row.name.trim(), unit: row.unit.trim() || undefined, direction: row.direction, valueType: row.valueType, notes: row.notes.trim() || undefined, sortOrder: row.sortOrder, sourceTemplateItemId: row.sourceTemplateItemId }
  return row.valueType === 'number'
    ? { ...base, currentValue: parseDecimalInput(row.currentInput), targetValue: parseDecimalInput(row.targetInput) }
    : { ...base, currentText: row.currentInput.trim() || undefined, targetText: row.targetInput.trim() || undefined }
}

export function Builder({ kind, plan, update, save, saved, back, notify, patients, services, clinic, discounts, paymentMethods, planTemplates, initialCarryGoals, userId, assistantMode, reopening, finish, openConsultation, openConsultationById }: { kind: 'template' | 'patient'; plan: Plan; update: (p: Plan) => void; save: (p: Plan) => Promise<void>; saved: boolean; back: () => void; notify: (s: string) => void; patients: Patient[]; services: Service[]; clinic: ClinicProfile; discounts: Discount[]; paymentMethods: PaymentMethod[]; planTemplates: Plan[]; initialCarryGoals?: SaleSnapshotGoal[]; userId: string; assistantMode?: 'with' | 'without'; reopening?: boolean; finish: () => void; openConsultation: (patientId?: string) => void; openConsultationById: (id: string) => void }) {
  const isNewFlow = kind === 'patient' && assistantMode !== undefined
  const scheduleTemplates = planTemplates.filter(t => t.id !== plan.id)
  const [servicePicker, setServicePicker] = useState<number | null>(null)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [scheduleTemplateOpen, setScheduleTemplateOpen] = useState(false)
  const [repeatService, setRepeatService] = useState(services[0]?.id ?? '')
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [range, setRange] = useState({ from: 1, to: plan.duration })
  const [saveOpen, setSaveOpen] = useState(false)
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [customPayment, setCustomPayment] = useState(false)
  const [saveName, setSaveName] = useState(plan.name)
  const [savePatient, setSavePatient] = useState(plan.patientId ?? patients[0]?.id ?? '')
  const [patientQuery, setPatientQuery] = useState(patients.find(p => p.id === plan.patientId)?.name ?? '')
  const [savePatientQuery, setSavePatientQuery] = useState(patients.find(p => p.id === (plan.patientId ?? patients[0]?.id))?.name ?? '')
  const [customDurationOpen, setCustomDurationOpen] = useState(false)
  const [customDurationValue, setCustomDurationValue] = useState(String(plan.duration))
  const [goals, setGoals] = useState<GoalRowDraft[]>([])
  const [originalGoalIds, setOriginalGoalIds] = useState<Set<string>>(new Set())
  const [openGoalMenu, setOpenGoalMenu] = useState<string | null>(null)
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[] | null>(null)
  const [templatePicker, setTemplatePicker] = useState<{ template: GoalTemplate | null; checked: Set<string> } | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogItems, setCatalogItems] = useState<GoalCatalogItem[] | null>(null)
  const [catalogChecked, setCatalogChecked] = useState<Set<string>>(new Set())
  const [sourceConsultation, setSourceConsultation] = useState<Consultation | null>(null)
  const [recordText, setRecordText] = useState<string | null>(null)
  const patient = patients.find(p => p.id === plan.patientId)
  useEffect(() => { if (!paymentMethods.length) setCustomPayment(true) }, [paymentMethods.length])

  // --- fluxo novo (com/sem assistente de vendas) ---
  const [salesScript, setSalesScript] = useState<SalesScript | null | undefined>(isNewFlow ? undefined : null)
  const [flowConsultation, setFlowConsultation] = useState<Consultation | null>(null)
  const [entries, setEntries] = useState<Record<string, { checked: boolean; answerText: string }>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [nameInput, setNameInput] = useState(plan.name)
  const [finishing, setFinishing] = useState(false)
  const answerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const answerItems = useMemo(() => (salesScript?.items ?? []).filter(i => i.itemType === 'answer').sort((a, b) => a.sortOrder - b.sortOrder), [salesScript])
  const phaseItems = (phase: SalesScriptPhase) => (salesScript?.items ?? []).filter(i => i.phase === phase).sort((a, b) => (a.itemType === 'attention' ? 0 : 1) - (b.itemType === 'attention' ? 0 : 1) || a.sortOrder - b.sortOrder)

  const flowSteps: FlowStep[] = useMemo(() => {
    if (!isNewFlow) return ['patient', 'start', 'goals', 'schedule']
    const steps: FlowStep[] = ['patient']
    if (assistantMode === 'with') steps.push(...preBuildPhases)
    steps.push('start')
    if (assistantMode === 'without' && answerItems.length) steps.push('questions')
    steps.push('goals', 'schedule')
    if (assistantMode === 'with') steps.push('apresentacao')
    steps.push('presentation')
    if (assistantMode === 'with') steps.push('encaminhamento')
    steps.push('name', 'documents')
    return steps
  }, [isNewFlow, assistantMode, answerItems.length])

  const [step, setStep] = useState<FlowStep>('patient')
  const [maxStep, setMaxStep] = useState(0)
  useEffect(() => {
    if (reopening) { setStep('schedule'); setMaxStep(flowSteps.length - 1) }
    // dependência intencionalmente restrita: só na montagem, pra não reabrir sempre em Calendário se o array de passos mudar depois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isNewFlow) { setSalesScript(null); return }
    let cancelled = false
    getSalesScript(clinic.id).then(script => { if (!cancelled) setSalesScript(script) }).catch(error => { if (!cancelled) { notify(errorMessage(error)); setSalesScript(null) } })
    return () => { cancelled = true }
  }, [isNewFlow, clinic.id])

  useEffect(() => {
    if (kind !== 'patient') { setSourceConsultation(null); return }
    let cancelled = false
    getConsultationByPlan(plan.id).then(consultation => { if (!cancelled) setSourceConsultation(consultation) }).catch(() => {})
    return () => { cancelled = true }
  }, [plan.id, kind])

  useEffect(() => {
    if (kind !== 'patient') return
    let cancelled = false
    if (initialCarryGoals) {
      setGoals(initialCarryGoals.map((goal, i) => ({ id: crypto.randomUUID(), name: goal.name, unit: goal.unit ?? '', direction: goal.direction, valueType: goal.valueType, currentInput: goal.valueType === 'number' ? formatDecimalInput(goal.currentValue) : (goal.currentText ?? ''), targetInput: goal.valueType === 'number' ? formatDecimalInput(goal.targetValue) : (goal.targetText ?? ''), notes: '', sortOrder: i })))
      setOriginalGoalIds(new Set())
      return
    }
    listPlanGoals(plan.id).then(rows => {
      if (cancelled) return
      const drafts = rows.map(row => ({ id: row.id, name: row.name, unit: row.unit ?? '', direction: row.direction, valueType: row.valueType, currentInput: row.valueType === 'number' ? formatDecimalInput(row.currentValue) : (row.currentText ?? ''), targetInput: row.valueType === 'number' ? formatDecimalInput(row.targetValue) : (row.targetText ?? ''), notes: row.notes ?? '', sortOrder: row.sortOrder, sourceTemplateItemId: row.sourceTemplateItemId }))
      setGoals(drafts)
      setOriginalGoalIds(new Set(drafts.map(d => d.id)))
    }).catch(error => !cancelled && notify(errorMessage(error)))
    return () => { cancelled = true }
    // dependências intencionalmente restritas: notify muda de referência a cada render do App e recarregaria (zerando edições locais) a cada digitação
  }, [plan.id, kind, initialCarryGoals])

  const subtotal = useMemo(() => plan.weeks.flatMap(w => w.items).reduce((sum, item) => sum + (services.find(s => s.id === item.serviceId)?.price ?? 0) * (item.quantity ?? 1), 0), [plan.weeks, services])
  const baseDiscount = discounts.find(d => d.duration === plan.duration)?.percent ?? 0
  const discount = kind === 'patient' && plan.applyDiscount === false ? 0 : baseDiscount
  const total = subtotal * (1 - discount / 100)
  const goalsLocked = kind === 'patient' && plan.status === 'Plano vendido'
  const renewal = plan.startDate ? format(addWeeks(parseISO(plan.startDate), plan.duration), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Defina a data de início'

  const presentationGoals = (): PresentationGoal[] => goals.filter(row => !isGoalRowEmpty(row)).map(row => ({
    name: row.name,
    unit: row.unit || undefined,
    valueType: row.valueType,
    current: row.valueType === 'number' ? parseDecimalInput(row.currentInput) : undefined,
    target: row.valueType === 'number' ? parseDecimalInput(row.targetInput) : undefined,
    currentText: row.valueType === 'text' ? row.currentInput : undefined,
    targetText: row.valueType === 'text' ? row.targetInput : undefined,
    decimals: row.catalogDecimals,
  }))

  const copyPlanRecord = async () => {
    try {
      let consultationPart: Parameters<typeof buildRecordText>[1]
      const consultationForRecord = sourceConsultation ?? flowConsultation
      if (consultationForRecord) {
        const [full, script] = await Promise.all([getConsultationFull(consultationForRecord.id), salesScript ?? getSalesScript(clinic.id)])
        if (full && script) {
          const entriesMap: Record<string, { checked?: boolean; answerText?: string }> = {}
          for (const entry of full.entries) if (entry.itemId) entriesMap[entry.itemId] = { checked: entry.checked, answerText: entry.answerText }
          consultationPart = { startedAt: full.startedAt, freeNotes: full.freeNotes, scriptItems: script.items, entries: entriesMap }
        }
      }
      const goalLines = goals.filter(row => !isGoalRowEmpty(row)).map(row => formatGoalLine({ name: row.name, unit: row.unit || undefined, current: row.currentInput, target: row.targetInput }))
      const text = buildRecordText(patient?.name ?? 'não informado', consultationPart, { plan, goalLines, services, discountPercent: discount })
      setRecordText(text)
    } catch (error) { notify(errorMessage(error)) }
  }
  const stepIndex = flowSteps.indexOf(step)

  const resize = (duration: number) => update({ ...plan, duration, weeks: Array.from({ length: duration }, (_, i) => plan.weeks[i] ?? { number: i + 1, items: [] }) })
  const addService = (weekNumber: number, serviceId: string) => {
    update({ ...plan, weeks: plan.weeks.map(w => w.number === weekNumber ? { ...w, items: [...w.items, { id: crypto.randomUUID(), serviceId, quantity: 1 }] } : w) }); setServicePicker(null)
  }
  const removeItem = (weekNumber: number, id: string) => update({ ...plan, weeks: plan.weeks.map(w => w.number === weekNumber ? { ...w, items: w.items.filter(i => i.id !== id) } : w) })
  const setQuantity = (weekNumber: number, id: string, quantity: number) => update({ ...plan, weeks: plan.weeks.map(w => w.number === weekNumber ? { ...w, items: w.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, Math.min(99, quantity || 1)) } : i) } : w) })
  const duplicateWeek = (weekNumber: number) => {
    const source = plan.weeks.find(w => w.number === weekNumber); if (!source || weekNumber === plan.duration) return
    update({ ...plan, weeks: plan.weeks.map(w => w.number === weekNumber + 1 ? { ...w, items: source.items.map(i => ({ ...i, id: crypto.randomUUID() })) } : w) }); notify(`Semana ${weekNumber} copiada para a próxima`)
  }
  const applyRepeat = () => {
    const from = Math.max(1, range.from), to = Math.min(plan.duration, range.to)
    update({ ...plan, weeks: plan.weeks.map(w => {
      const eligible = w.number >= from && w.number <= to && (w.number - from) % Math.max(1, repeatInterval) === 0
      return eligible ? { ...w, items: [...w.items, { id: crypto.randomUUID(), serviceId: repeatService, quantity: 1 }] } : w
    }) }); setRepeatOpen(false); notify('Serviço aplicado ao cronograma')
  }
  const applyScheduleTemplate = (template: Plan) => {
    update({ ...plan, duration: template.duration, weeks: template.weeks.map(week => ({ ...week, items: week.items.map(item => ({ ...item, id: crypto.randomUUID() })) })) })
    setScheduleTemplateOpen(false)
    notify(`Cronograma do template "${template.name.replace('Template · ', '')}" aplicado`)
  }
  const applyCustomDuration = () => {
    const value = Number(customDurationValue)
    if (value > 0 && value <= 104) { resize(value); setCustomDurationOpen(false) }
  }

  const ensureFlowConsultation = async () => {
    if (flowConsultation || !plan.patientId) return flowConsultation
    try {
      const created = await startConsultation(clinic.id, plan.patientId, userId, { salesScriptId: salesScript?.id })
      setFlowConsultation(created)
      return created
    } catch (error) { notify(errorMessage(error)); return null }
  }

  const persistPlanAndGoals = async (): Promise<boolean> => {
    const cleanGoals = goals.filter(row => !isGoalRowEmpty(row))
    if (!goalsLocked && cleanGoals.some(row => !row.name.trim())) { notify('Preencha o nome de todos os objetivos ou remova as linhas em branco'); return false }
    if (!goalsLocked) for (const row of cleanGoals) {
      if (row.valueType !== 'number' || (row.catalogMin === undefined && row.catalogMax === undefined)) continue
      const outOfRange = (raw: string) => { const value = parseDecimalInput(raw); return value !== undefined && ((row.catalogMin !== undefined && value < row.catalogMin) || (row.catalogMax !== undefined && value > row.catalogMax)) }
      if (outOfRange(row.currentInput) || outOfRange(row.targetInput)) { notify(`"${row.name}" deve ficar entre ${row.catalogMin ?? '–'} e ${row.catalogMax ?? '–'}`); return false }
    }
    try {
      await save(plan)
      if (!goalsLocked) {
        const currentIds = new Set(cleanGoals.map(row => row.id))
        const removedIds = [...originalGoalIds].filter(id => !currentIds.has(id))
        await Promise.all(removedIds.map(id => deletePlanGoal(id)))
        if (cleanGoals.length) await upsertPlanGoals(clinic.id, plan.id, cleanGoals.map(goalRowToInput))
        setGoals(cleanGoals); setOriginalGoalIds(currentIds)
      }
      return true
    } catch (error) { notify(errorMessage(error)); return false }
  }
  const quickSave = async () => { if (await persistPlanAndGoals()) notify('Plano salvo') }

  const goToStep = (s: FlowStep) => { if (flowSteps.indexOf(s) <= maxStep) setStep(s) }
  const goNext = async () => {
    if (step === 'patient') {
      if (!plan.patientId) { notify('Selecione um paciente para continuar'); return }
      if (isNewFlow && (assistantMode === 'with' || answerItems.length)) await ensureFlowConsultation()
    }
    const nextIndex = Math.min(stepIndex + 1, flowSteps.length - 1)
    const nextKey = flowSteps[nextIndex]
    if (nextKey === 'name' && isNewFlow) {
      setFinishing(true)
      const ok = await persistPlanAndGoals()
      if (ok && flowConsultation) {
        try { await finishConsultation(flowConsultation.id); await linkConsultationToPlan(flowConsultation.id, plan.id) } catch (error) { notify(errorMessage(error)) }
      }
      setFinishing(false)
      if (!ok) return
      setNameInput(plan.name)
    }
    setMaxStep(m => Math.max(m, nextIndex)); setStep(nextKey)
  }
  const goBack = () => setStep(flowSteps[Math.max(stepIndex - 1, 0)])

  const confirmNameStep = async () => {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== plan.name) {
      try { await save({ ...plan, name: trimmed }) } catch (error) { notify(errorMessage(error)); return }
    }
    const nextIndex = flowSteps.indexOf('documents')
    setMaxStep(m => Math.max(m, nextIndex)); setStep('documents')
  }

  const saveEntryImmediately = async (item: SalesScriptItem, draft: { checked: boolean; answerText: string }) => {
    const consultation = flowConsultation
    if (!consultation) return
    setSavingIds(current => new Set(current).add(item.id))
    try {
      await saveEntry(consultation.id, { itemId: item.id, itemType: item.itemType, phase: item.phase, itemLabel: item.label, checked: item.itemType === 'check' ? draft.checked : undefined, answerText: item.itemType === 'answer' ? draft.answerText : undefined })
      setSavedIds(current => new Set(current).add(item.id))
      window.setTimeout(() => setSavedIds(current => { const next = new Set(current); next.delete(item.id); return next }), 1800)
    } catch (error) { notify(errorMessage(error)) } finally { setSavingIds(current => { const next = new Set(current); next.delete(item.id); return next }) }
  }
  const toggleEntryCheck = (item: SalesScriptItem) => {
    const next = !entries[item.id]?.checked
    setEntries(current => ({ ...current, [item.id]: { checked: next, answerText: current[item.id]?.answerText ?? '' } }))
    void saveEntryImmediately(item, { checked: next, answerText: entries[item.id]?.answerText ?? '' })
  }
  const changeEntryAnswer = (item: SalesScriptItem, value: string) => {
    setEntries(current => ({ ...current, [item.id]: { checked: current[item.id]?.checked ?? false, answerText: value } }))
    clearTimeout(answerTimers.current[item.id])
    answerTimers.current[item.id] = setTimeout(() => { void saveEntryImmediately(item, { checked: entries[item.id]?.checked ?? false, answerText: value }) }, 600)
  }

  const addBlankGoal = () => setGoals(current => [...current, blankGoalRow(current.length)])
  const updateGoalRow = (id: string, patch: Partial<GoalRowDraft>) => setGoals(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  const removeGoalRow = (id: string) => { setGoals(current => current.filter(row => row.id !== id).map((row, i) => ({ ...row, sortOrder: i }))); setOpenGoalMenu(null) }
  const toggleGoalMenu = (id: string) => setOpenGoalMenu(current => current === id ? null : id)

  const openTemplatePicker = () => {
    setTemplatePicker({ template: null, checked: new Set() })
    if (!goalTemplates) listGoalTemplates(clinic.id).then(setGoalTemplates).catch(error => notify(errorMessage(error)))
  }
  const chooseTemplate = (template: GoalTemplate) => setTemplatePicker({ template, checked: new Set(template.items.map(item => item.id)) })
  const toggleImportItem = (itemId: string) => setTemplatePicker(current => {
    if (!current) return current
    const checked = new Set(current.checked)
    checked.has(itemId) ? checked.delete(itemId) : checked.add(itemId)
    return { ...current, checked }
  })
  const confirmImport = () => {
    if (!templatePicker?.template) return
    const selected = templatePicker.template.items.filter(item => templatePicker.checked.has(item.id))
    if (!selected.length) { notify('Selecione ao menos um indicador para importar'); return }
    setGoals(current => [...current, ...selected.map((item, i) => ({ id: crypto.randomUUID(), name: item.name, unit: item.unit ?? '', direction: item.direction, valueType: item.valueType, currentInput: item.valueType === 'number' ? formatDecimalInput(item.defaultCurrent) : '', targetInput: item.valueType === 'number' ? formatDecimalInput(item.defaultTarget) : '', notes: item.notes ?? '', sortOrder: current.length + i, sourceTemplateItemId: item.id }))])
    notify(`${selected.length} indicador${selected.length === 1 ? '' : 'es'} importado${selected.length === 1 ? '' : 's'} do template`)
    setTemplatePicker(null)
  }

  useEffect(() => {
    if (kind !== 'patient') return
    listGoalCatalog().then(setCatalogItems).catch(error => notify(errorMessage(error)))
    // dependência intencionalmente restrita: catálogo só muda ao editar em Cadastros > Objetivos, não precisa recarregar durante a edição do plano
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const chooseGoalIndicatorName = (id: string, name: string) => {
    const match = findCatalogMatch(name, catalogItems)
    updateGoalRow(id, match
      ? { name, unit: match.unit ?? '', direction: match.defaultDirection, valueType: 'number', currentInput: '', targetInput: '', catalogDecimals: match.decimals, catalogMin: match.minValue, catalogMax: match.maxValue }
      : { name, catalogDecimals: undefined, catalogMin: undefined, catalogMax: undefined })
  }

  const openCatalogPicker = () => { setCatalogOpen(true); setCatalogChecked(new Set()) }
  const toggleCatalogItem = (id: string) => setCatalogChecked(current => {
    const next = new Set(current)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const confirmCatalogImport = () => {
    if (!catalogItems) return
    const selected = catalogItems.filter(item => catalogChecked.has(item.id))
    if (!selected.length) { notify('Selecione ao menos um indicador do catálogo'); return }
    setGoals(current => [...current, ...selected.map((item, i) => ({ id: crypto.randomUUID(), name: item.name, unit: item.unit ?? '', direction: item.defaultDirection, valueType: 'number' as GoalValueType, currentInput: '', targetInput: '', notes: '', sortOrder: current.length + i, catalogDecimals: item.decimals, catalogMin: item.minValue, catalogMax: item.maxValue }))])
    notify(`${selected.length} indicador${selected.length === 1 ? '' : 'es'} adicionado${selected.length === 1 ? '' : 's'} do catálogo`)
    setCatalogOpen(false)
  }

  const confirmSave = async () => {
    if (kind === 'patient' && !savePatient) { notify('Selecione um paciente antes de salvar o plano'); return }
    const cleanGoals = goals.filter(row => !isGoalRowEmpty(row))
    if (kind === 'patient' && !goalsLocked && cleanGoals.some(row => !row.name.trim())) { notify('Preencha o nome de todos os objetivos ou remova as linhas em branco'); return }
    if (!goalsLocked) for (const row of cleanGoals) {
      if (row.valueType !== 'number' || (row.catalogMin === undefined && row.catalogMax === undefined)) continue
      const outOfRange = (raw: string) => { const value = parseDecimalInput(raw); return value !== undefined && ((row.catalogMin !== undefined && value < row.catalogMin) || (row.catalogMax !== undefined && value > row.catalogMax)) }
      if (outOfRange(row.currentInput) || outOfRange(row.targetInput)) { notify(`"${row.name}" deve ficar entre ${row.catalogMin ?? '–'} e ${row.catalogMax ?? '–'}`); return }
    }
    const next = { ...plan, name: saveName.trim() || plan.name, patientId: kind === 'patient' ? savePatient : undefined, status: kind === 'patient' ? plan.status : 'Plano criado' as SaleStatus, updatedAt: 'Agora' }
    try { await save(next) } catch (error) { notify(errorMessage(error)); return }
    if (kind === 'patient' && !goalsLocked) {
      try {
        const currentIds = new Set(cleanGoals.map(row => row.id))
        const removedIds = [...originalGoalIds].filter(id => !currentIds.has(id))
        await Promise.all(removedIds.map(id => deletePlanGoal(id)))
        if (cleanGoals.length) await upsertPlanGoals(clinic.id, next.id, cleanGoals.map(goalRowToInput))
        setGoals(cleanGoals)
        setOriginalGoalIds(currentIds)
      } catch (error) { notify(`Plano salvo, mas houve um problema ao salvar os objetivos: ${errorMessage(error)}`) }
    }
    setSaveOpen(false)
    notify(kind === 'patient' ? 'Plano do paciente salvo' : 'Template salvo na biblioteca')
  }

  const patientPicker = <div className="patient-select big"><div className="avatar pale">{patient?.initials ?? '—'}</div><input list="builder-patients" value={patientQuery} placeholder="Buscar paciente pelo nome" onChange={e => { setPatientQuery(e.target.value); const found = patients.find(p => p.name.toLowerCase() === e.target.value.toLowerCase()); update({ ...plan, patientId: found?.id }) }}/><datalist id="builder-patients">{patients.map(p => <option key={p.id} value={p.name}/>)}</datalist></div>
  const durationPicker = <div className="segments big">{durationOptions.map(d => <button key={d} className={plan.duration === d ? 'selected' : ''} onClick={() => resize(d)}>{d}</button>)}<button className={!durationOptions.includes(plan.duration) ? 'selected' : ''} onClick={() => { setCustomDurationValue(String(plan.duration)); setCustomDurationOpen(true) }}>Outro</button></div>
  const scheduleSection = <>
    <section className="timeline-head"><div><h2>Cronograma semana a semana</h2><p>Organize os serviços que fazem parte da jornada do paciente.</p></div><div className="timeline-head-actions"><Button variant="soft" onClick={() => scheduleTemplates.length ? setScheduleTemplateOpen(true) : notify('Nenhum template de plano cadastrado ainda')}><Library size={17}/> Usar template</Button><Button variant="soft" onClick={() => services.length ? setRepeatOpen(true) : notify('Cadastre um serviço primeiro')}><RefreshCw size={17}/> Repetir serviço</Button></div></section>
    {kind === 'patient' && <div className="schedule-duration-picker"><label>Duração (se estiver começando do zero)</label>{durationPicker}</div>}
    {!services.length && <div className="builder-warning"><Stethoscope size={18}/><span>Cadastre pelo menos um serviço para começar a preencher o cronograma.</span></div>}
    <div className="week-grid">{plan.weeks.map(w => <WeekCard key={w.number} week={w} services={services} picker={servicePicker === w.number} togglePicker={() => services.length ? setServicePicker(servicePicker === w.number ? null : w.number) : notify('Cadastre um serviço primeiro')} add={id => addService(w.number, id)} remove={id => removeItem(w.number, id)} setQuantity={(id, q) => setQuantity(w.number, id, q)} duplicate={() => duplicateWeek(w.number)} last={w.number === plan.duration}/>)}</div>
    <section className="renewal card"><div className="renew-icon"><RefreshCw size={20}/></div><div><span>RENOVAÇÃO PREVISTA</span><strong>{renewal}</strong><p>Calculada automaticamente a partir da data de início e da duração.</p></div>{kind === 'patient' && <div className="schedule-bottom-actions">{isNewFlow && assistantMode === 'without' && <Button variant="ghost" onClick={() => setChecklistOpen(true)}><ListChecks size={16}/> Ver roteiro</Button>}<Button variant="primary" onClick={() => isNewFlow ? quickSave() : (setSaveName(plan.name), setSaveOpen(true))}>Salvar plano</Button></div>}</section>
  </>

  const isDocButtonsStep = kind === 'template' || !isNewFlow

  return <>
    <header className="builder-top">
      <div className="top-left"><button className="icon-button" onClick={back}><ArrowLeft size={19}/></button><div><span className="eyebrow">CONSTRUTOR DE PLANO</span><div className="title-edit"><input value={plan.name} onChange={e => update({ ...plan, name: e.target.value })}/><span className={`save-state ${saved ? '' : 'pending'}`}>{saved ? 'Salvo' : 'Alterações não salvas'}</span></div></div></div>
      <div className="top-actions">
        {sourceConsultation && <Button variant="ghost" onClick={() => openConsultationById(sourceConsultation.id)}><Stethoscope size={16}/> Consulta de origem</Button>}
        {!isNewFlow && kind === 'patient' && plan.patientId && <Button variant="ghost" onClick={() => openConsultation(plan.patientId)}><Handshake size={16}/> Assistente de vendas</Button>}
        {isDocButtonsStep && <Button variant="ghost" onClick={() => setDocumentsOpen(true)}><FileText size={16}/> Documentos</Button>}
        {isDocButtonsStep && <Button variant="primary" onClick={() => { setSaveName(plan.name); setSaveOpen(true) }}>Salvar plano</Button>}
        {isNewFlow && <span className="flow-mode-badge">{assistantMode === 'with' ? <><Handshake size={13}/> Com assistente</> : 'Sem assistente'}</span>}
      </div>
    </header>
    <div className="builder-body">
      {kind === 'template' ? <>
        <section className="plan-summary card">
          <div className="field patient-field"><label>TIPO DE CONTEÚDO</label><div className="template-indicator"><Library size={16}/> Template reutilizável</div></div>
          <div className="field"><label>INÍCIO DO PLANO</label><div className="date-input"><input type="date" value={plan.startDate} onChange={e => update({ ...plan, startDate: e.target.value })}/></div></div>
          <div className="field duration"><label>DURAÇÃO</label><div className="segments">{durationOptions.map(d => <button key={d} className={plan.duration === d ? 'selected' : ''} onClick={() => resize(d)}>{d}</button>)}<button className={!durationOptions.includes(plan.duration) ? 'selected' : ''} onClick={() => { setCustomDurationValue(String(plan.duration)); setCustomDurationOpen(true) }}>Outro</button></div></div>
          <div className="summary-metric"><span>INVESTIMENTO</span><strong>{money(total)}</strong><small>{plan.weeks.reduce((n, w) => n + w.items.reduce((q, i) => q + (i.quantity ?? 1), 0), 0)} aplicações{discount > 0 ? ` · ${discount}% de desconto` : ''}</small></div>
        </section>
        {scheduleSection}
      </> : (isNewFlow && salesScript === undefined) ? <p className="documents-intro">Carregando roteiro do assistente de vendas...</p> : <>
        <div className="wizard-summary">
          <div><span>PACIENTE</span><strong>{patient?.name ?? 'Selecione'}</strong></div>
          <div><span>INÍCIO</span><strong>{plan.startDate ? format(parseISO(plan.startDate), 'dd/MM/yyyy') : '—'}</strong></div>
          <div><span>DURAÇÃO</span><strong>{plan.duration} semanas</strong></div>
          <div><span>OBJETIVOS</span><strong>{goals.length}</strong></div>
          <div><span>INVESTIMENTO</span><strong>{money(total)}</strong>{baseDiscount > 0 && <label className="discount-toggle"><input type="checkbox" checked={plan.applyDiscount !== false} onChange={e => update({ ...plan, applyDiscount: e.target.checked })}/> Aplicar desconto de {baseDiscount}%</label>}</div>
        </div>
        <div className="wizard-steps">{flowSteps.map((s, i) => <button key={s} className={step === s ? 'active' : ''} disabled={i > maxStep} onClick={() => goToStep(s)}>{i + 1}. {stepLabel(s)}</button>)}</div>

        {step === 'patient' && <section className="wizard-step card">
          <h2>Para qual paciente é este plano?</h2><p>Busque pelo nome já cadastrado. Você pode ajustar isso depois.</p>
          {patientPicker}
          <div className="wizard-nav"><span/><Button variant="primary" onClick={goNext}>Próximo</Button></div>
        </section>}

        {isPhaseStep(step) && <section className="wizard-step card consultation-phase-step">
          <div className="consultation-phase-head">
            <span className="eyebrow">{phaseItems(step)[0]?.phaseLabel ?? phaseNames[step]}</span>
            <h1>{phaseItems(step)[0]?.sectionLabel ?? phaseNames[step]}</h1>
            {phaseItems(step)[0]?.timeHint && <span className="consultation-time">{phaseItems(step)[0].timeHint}</span>}
          </div>
          {!phaseItems(step).length && <EmptyState>Nenhum item cadastrado nesta fase do roteiro.</EmptyState>}
          <div className="consultation-items">{phaseItems(step).map(item => <FlowScriptItemRow key={item.id} item={item} entry={entries[item.id]} saving={savingIds.has(item.id)} saved={savedIds.has(item.id)} onToggle={() => toggleEntryCheck(item)} onAnswer={v => changeEntryAnswer(item, v)}/>)}</div>
          <div className="wizard-nav"><Button variant="ghost" onClick={goBack}>Voltar</Button><Button variant="primary" disabled={finishing} onClick={goNext}>{finishing ? 'Salvando...' : 'Próximo'}</Button></div>
        </section>}

        {step === 'start' && <section className="wizard-step card">
          <h2>Quando o plano começa?</h2><p>A data de início define o cálculo das semanas do cronograma e a renovação prevista.</p>
          <div className="date-input big"><input type="date" value={plan.startDate} onChange={e => update({ ...plan, startDate: e.target.value })}/></div>
          <div className="wizard-nav"><Button variant="ghost" onClick={goBack}>Voltar</Button><Button variant="primary" onClick={goNext}>Próximo</Button></div>
        </section>}

        {step === 'questions' && <section className="wizard-step card">
          <h2>Perguntas do roteiro</h2><p>Registre o que o paciente respondeu. Todas são opcionais.</p>
          <div className="consultation-items">{answerItems.map(item => <FlowScriptItemRow key={item.id} item={item} entry={entries[item.id]} saving={savingIds.has(item.id)} saved={savedIds.has(item.id)} onToggle={() => {}} onAnswer={v => changeEntryAnswer(item, v)}/>)}</div>
          <div className="wizard-nav"><Button variant="ghost" onClick={goBack}>Voltar</Button><Button variant="primary" onClick={goNext}>Próximo</Button></div>
        </section>}

        {step === 'goals' && <>
          <section className="goals-toolbar"><div><h2>Objetivos do plano</h2><p>{goalsLocked ? 'Este plano já foi vendido — os objetivos ficam travados para preservar o histórico.' : 'Indicadores que serão acompanhados ao longo do tratamento. Totalmente opcional.'}</p></div>
            <div className="goals-toolbar-actions"><Button variant="soft" disabled={goalsLocked} onClick={openCatalogPicker}><BookOpen size={16}/> Do catálogo</Button><Button variant="soft" disabled={goalsLocked} onClick={openTemplatePicker}><Library size={16}/> Meus templates</Button><Button variant="ghost" disabled={goalsLocked} onClick={addBlankGoal}><Plus size={16}/> Criar do zero</Button></div>
          </section>
          {!goals.length && <EmptyState>Nenhum objetivo adicionado ainda. Escolha um indicador do catálogo, importe de um dos seus templates, ou crie um do zero — não é obrigatório para salvar o plano.</EmptyState>}
          <datalist id="goal-catalog-datalist">{catalogItems?.map(c => <option key={c.id} value={c.name}/>)}</datalist>
          <div className="goal-rows">{goals.map(row => <GoalPlanRow key={row.id} row={row} locked={goalsLocked} menuOpen={openGoalMenu === row.id} onToggleMenu={() => toggleGoalMenu(row.id)} onChange={patch => updateGoalRow(row.id, patch)} onRemove={() => removeGoalRow(row.id)} onChooseName={name => chooseGoalIndicatorName(row.id, name)}/>)}</div>
          <div className="wizard-nav"><Button variant="ghost" onClick={goBack}>Voltar</Button><Button variant="primary" onClick={goNext}>Ir para o calendário</Button></div>
        </>}

        {step === 'schedule' && <>
          {scheduleSection}
          <div className="wizard-nav"><Button variant="ghost" onClick={goBack}>Voltar</Button>{isNewFlow ? <Button variant="primary" disabled={finishing} onClick={goNext}>{finishing ? 'Salvando...' : 'Próximo'}</Button> : <span/>}</div>
        </>}

        {step === 'presentation' && <section className="wizard-step card presentation-step">
          <h2>Apresentação do plano</h2><p>Use esta tela para apresentar o plano ao paciente durante a consulta.</p>
          <PlanPresentationView plan={plan} patient={patient} services={services} clinic={clinic} discount={discount} goals={presentationGoals()}/>
          <div className="wizard-nav"><Button variant="ghost" onClick={goBack}>Voltar</Button><Button variant="primary" disabled={finishing} onClick={goNext}>{finishing ? 'Salvando...' : 'Próximo'}</Button></div>
        </section>}

        {step === 'name' && <section className="wizard-step card">
          <h2>Como você quer chamar esse plano?</h2><p>Esse nome aparece na lista de planos e nos documentos gerados.</p>
          <div className="date-input big"><input value={nameInput} onChange={e => setNameInput(e.target.value)} autoFocus/></div>
          <div className="wizard-nav"><span/><Button variant="primary" onClick={confirmNameStep}>Continuar</Button></div>
        </section>}

        {step === 'documents' && <section className="wizard-step card documents-step">
          <h2>Documentos do plano</h2>
          <p className="documents-intro">Gere os documentos que quiser agora, ou pule direto para finalizar.</p>
          <label className="document-field">Forma de pagamento (para o contrato)
            <select value={customPayment ? '__custom__' : paymentMethod} onChange={e => { const v = e.target.value; if (v === '__custom__') { setCustomPayment(true); setPaymentMethod('') } else { setCustomPayment(false); setPaymentMethod(v) } }}>
              <option value="" disabled>Selecione um modelo</option>
              {paymentMethods.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
              <option value="__custom__">Outro (digitar)</option>
            </select>
            {customPayment && <input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Digite a forma de pagamento" autoFocus/>}
          </label>
          <div className="document-options">
            <button onClick={() => printPlanDocument('calendar', plan, patient, services, clinic, discount, paymentMethod)}><CalendarDays size={22}/><div><strong>Calendário semanal do paciente</strong><span>Visão amigável do plano exatamente como o médico organizou por semanas.</span></div></button>
            <button onClick={() => printPresentationDocument(plan, patient, services, clinic, discount, presentationGoals())}><Target size={22}/><div><strong>Apresentação do plano (PDF)</strong><span>Mesmo conteúdo da etapa anterior, pronto para imprimir ou salvar.</span></div></button>
            <button onClick={() => printPlanDocument('schedule', plan, patient, services, clinic, discount, paymentMethod)}><CalendarCheck size={22}/><div><strong>Controle de plano terapêutico</strong><span>Modelo com uma linha para cada aplicação e assinaturas.</span></div></button>
            <button onClick={() => void copyPlanRecord()}><FileText size={22}/><div><strong>Copiar para o prontuário</strong><span>{(sourceConsultation ?? flowConsultation) ? 'Anamnese da consulta, objetivos e cronograma do plano, com prévia editável.' : 'Objetivos e cronograma do plano, com prévia editável antes de copiar.'}</span></div></button>
            <button onClick={() => downloadContractDocx(plan, patient, services, clinic, discount, paymentMethod, presentationGoals())}><FileText size={22}/><div><strong>Baixar contrato em Word (.docx)</strong><span>Contrato integral e editável, com os campos manuais destacados para a secretária{goals.filter(row => !isGoalRowEmpty(row)).length ? ' e a seção de objetivos do acompanhamento' : ''}.</span></div></button>
          </div>
          <small className="legal-note">Confira os campos destacados no Word antes de finalizar o contrato.</small>
          <div className="wizard-nav"><span/><Button variant="primary" onClick={finish}>Finalizar</Button></div>
        </section>}
      </>}
    </div>
    {customDurationOpen && <Modal onClose={() => setCustomDurationOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">DURAÇÃO PERSONALIZADA</span><h3>Quantas semanas terá o plano?</h3></div><button className="icon-button" onClick={() => setCustomDurationOpen(false)}><X size={19}/></button></div>
      <Field label="Número de semanas (1 a 104)"><input type="number" min={1} max={104} value={customDurationValue} onChange={e => setCustomDurationValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyCustomDuration() }} autoFocus/></Field>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setCustomDurationOpen(false)}>Cancelar</Button><Button variant="primary" onClick={applyCustomDuration}>Aplicar</Button></div>
    </Modal>}
    {catalogOpen && <Modal onClose={() => setCatalogOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">OBJETIVOS</span><h3>Catálogo de indicadores</h3></div><button className="icon-button" onClick={() => setCatalogOpen(false)}><X size={19}/></button></div>
      {catalogItems === null && <p className="documents-intro">Carregando catálogo...</p>}
      {catalogItems !== null && !catalogItems.length && <EmptyState>Catálogo ainda sem indicadores cadastrados.</EmptyState>}
      <div className="goal-import-items">{catalogItems?.map(item => <label className="goal-import-item" key={item.id}><input type="checkbox" checked={catalogChecked.has(item.id)} onChange={() => toggleCatalogItem(item.id)}/><span><strong>{item.name}</strong><small>{item.unit ? `${item.unit} · ` : ''}{directionLabels[item.defaultDirection]}</small></span></label>)}</div>
      {!!catalogItems?.length && <div className="modal-actions"><Button variant="ghost" onClick={() => setCatalogOpen(false)}>Cancelar</Button><Button variant="primary" onClick={confirmCatalogImport}>Adicionar selecionados</Button></div>}
    </Modal>}
    {templatePicker && <Modal onClose={() => setTemplatePicker(null)}>
      {!templatePicker.template ? <>
        <div className="modal-title"><div><span className="eyebrow">OBJETIVOS</span><h3>Escolha um template</h3></div><button className="icon-button" onClick={() => setTemplatePicker(null)}><X size={19}/></button></div>
        {goalTemplates === null && <p className="documents-intro">Carregando templates...</p>}
        {goalTemplates !== null && !goalTemplates.length && <EmptyState>Nenhum template de objetivos cadastrado ainda.</EmptyState>}
        <div className="modal-template-list">{goalTemplates?.map(template => <button key={template.id} onClick={() => chooseTemplate(template)}><Target size={17}/><span><strong>{template.name}</strong><small>{template.items.length} indicador{template.items.length === 1 ? '' : 'es'}</small></span></button>)}</div>
      </> : <>
        <div className="modal-title"><div><span className="eyebrow">OBJETIVOS</span><h3>{templatePicker.template.name}</h3></div><button className="icon-button" onClick={() => setTemplatePicker(null)}><X size={19}/></button></div>
        <button className="back-link" onClick={() => setTemplatePicker({ template: null, checked: new Set() })}>← Voltar</button>
        <div className="goal-import-items">{templatePicker.template.items.map(item => <label className="goal-import-item" key={item.id}><input type="checkbox" checked={templatePicker.checked.has(item.id)} onChange={() => toggleImportItem(item.id)}/><span><strong>{item.name}</strong><small>{item.unit ? `${item.unit} · ` : ''}{directionLabels[item.direction]}</small></span></label>)}</div>
        <div className="modal-actions"><Button variant="ghost" onClick={() => setTemplatePicker(null)}>Cancelar</Button><Button variant="primary" onClick={confirmImport}>Importar selecionados</Button></div>
      </>}
    </Modal>}
    {scheduleTemplateOpen && <Modal onClose={() => setScheduleTemplateOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">CRONOGRAMA</span><h3>Usar um template de plano</h3></div><button className="icon-button" onClick={() => setScheduleTemplateOpen(false)}><X size={19}/></button></div>
      <p className="documents-intro">Aplica a duração e os serviços do template a este plano, substituindo o cronograma atual.</p>
      <div className="modal-template-list">{scheduleTemplates.map(t => <button key={t.id} onClick={() => applyScheduleTemplate(t)}><Library size={17}/><span><strong>{t.name.replace('Template · ', '')}</strong><small>{t.duration} semanas · {t.weeks.reduce((n, w) => n + w.items.length, 0)} serviços</small></span></button>)}</div>
    </Modal>}
    {repeatOpen && <Modal onClose={() => setRepeatOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">ATALHO DE CRONOGRAMA</span><h3>Repetir um serviço</h3></div><button className="icon-button" onClick={() => setRepeatOpen(false)}><X size={19}/></button></div>
      <label>Serviço</label><select value={repeatService} onChange={e => setRepeatService(e.target.value)}>{services.map(s => <option key={s.id} value={s.id}>{s.name} · {money(s.price)}</option>)}</select>
      <label>Frequência</label>
      <div className="choice-row"><button className={repeatInterval === 1 ? 'active' : ''} onClick={() => setRepeatInterval(1)}>Toda semana</button><button className={repeatInterval === 2 ? 'active' : ''} onClick={() => setRepeatInterval(2)}>A cada 2 semanas</button></div>
      <div className={`range-row custom-interval ${repeatInterval > 2 ? 'active' : ''}`}><span>Ou a cada</span><input type="number" min="1" max="52" value={repeatInterval > 2 ? repeatInterval : ''} placeholder="N" onChange={e => setRepeatInterval(Math.max(1, Number(e.target.value) || 1))}/><span>semanas</span></div>
      <label>Intervalo de semanas</label><div className="range-row"><input type="number" min="1" max={plan.duration} value={range.from} onChange={e => setRange({ ...range, from: Number(e.target.value) })}/><span>até</span><input type="number" min="1" max={plan.duration} value={range.to} onChange={e => setRange({ ...range, to: Number(e.target.value) })}/></div>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setRepeatOpen(false)}>Cancelar</Button><Button variant="primary" onClick={applyRepeat}>Aplicar ao plano</Button></div>
    </Modal>}
    {saveOpen && <Modal className="save-modal" onClose={() => setSaveOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">{kind === 'patient' ? 'SALVAR PLANO DO PACIENTE' : 'SALVAR TEMPLATE'}</span><h3>{kind === 'patient' ? 'Finalizar plano individual' : 'Adicionar à biblioteca'}</h3></div><button className="icon-button" onClick={() => setSaveOpen(false)}><X size={19}/></button></div>
      <label>NOME DO {kind === 'patient' ? 'PLANO' : 'TEMPLATE'}</label><input className="modal-input" value={saveName} onChange={e => setSaveName(e.target.value)}/>
      {kind === 'patient' && <><label>PACIENTE</label><input className="modal-input" list="save-patients" value={savePatientQuery} placeholder="Buscar paciente pelo nome" onChange={e => { setSavePatientQuery(e.target.value); const found = patients.find(p => p.name.toLowerCase() === e.target.value.toLowerCase()); setSavePatient(found?.id ?? '') }}/><datalist id="save-patients">{patients.map(p => <option key={p.id} value={p.name}/>)}</datalist></>}
      <div className="modal-actions"><Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancelar</Button><Button variant="primary" onClick={confirmSave}>Salvar</Button></div>
    </Modal>}
    {documentsOpen && <Modal className="documents-modal" onClose={() => setDocumentsOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">DOCUMENTOS DO PLANO</span><h3>Gerar documentos do plano</h3></div><button className="icon-button" onClick={() => setDocumentsOpen(false)}><X size={18}/></button></div>
      <p className="documents-intro">Escolha o documento conforme o destinatário.</p>
      <label className="document-field">Forma de pagamento (para o contrato)<input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Ex.: 12 parcelas no cartão"/></label>
      <div className="document-options">
        <button onClick={() => printPlanDocument('calendar', plan, patient, services, clinic, discount, paymentMethod)}><CalendarDays size={22}/><div><strong>Calendário semanal do paciente</strong><span>Visão amigável do plano exatamente como o médico organizou por semanas.</span></div></button>
        <button onClick={() => printPresentationDocument(plan, patient, services, clinic, discount, presentationGoals())}><Target size={22}/><div><strong>Apresentação do plano</strong><span>Documento para mostrar ao paciente na consulta: capa, cronograma, objetivos com gráficos e investimento.</span></div></button>
        <button onClick={() => printPlanDocument('schedule', plan, patient, services, clinic, discount, paymentMethod)}><CalendarCheck size={22}/><div><strong>Controle de plano terapêutico</strong><span>Modelo com uma linha para cada aplicação e assinaturas.</span></div></button>
        <button onClick={() => { setDocumentsOpen(false); void copyPlanRecord() }}><FileText size={22}/><div><strong>Copiar para o prontuário</strong><span>{sourceConsultation ? 'Anamnese da consulta de origem, objetivos e cronograma do plano, com prévia editável.' : 'Objetivos e cronograma do plano, com prévia editável antes de copiar.'}</span></div></button>
        <button onClick={() => downloadContractDocx(plan, patient, services, clinic, discount, paymentMethod, presentationGoals())}><FileText size={22}/><div><strong>Baixar contrato em Word (.docx)</strong><span>Contrato integral e editável, com os campos manuais destacados para a secretária{goals.filter(row => !isGoalRowEmpty(row)).length ? ' e a seção de objetivos do acompanhamento' : ''}.</span></div></button>
      </div>
      <small className="legal-note">Confira os campos destacados no Word antes de finalizar o contrato.</small>
    </Modal>}
    {checklistOpen && <Modal className="script-reference-modal" onClose={() => setChecklistOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">ROTEIRO DE VENDAS</span><h3>Conferir o passo a passo</h3></div><button className="icon-button" onClick={() => setChecklistOpen(false)}><X size={18}/></button></div>
      <p className="documents-intro">Referência rápida do roteiro da clínica — use para conferir se cobriu tudo na consulta.</p>
      <div className="script-reference-list">{consultationPhases.map(phase => {
        const items = phaseItems(phase)
        if (!items.length) return null
        return <div className="script-reference-phase" key={phase}>
          <strong>{items[0].sectionLabel ?? items[0].phaseLabel}</strong>
          <ul>{items.map(item => <li key={item.id}>{item.itemType === 'check' && <Check size={13}/>}{item.itemType === 'script' && <Quote size={13}/>}{item.itemType === 'attention' && <Lightbulb size={13}/>}<span>{item.label}</span></li>)}</ul>
        </div>
      })}</div>
    </Modal>}
    {recordText !== null && <RecordSummaryModal text={recordText} onClose={() => setRecordText(null)} notify={notify}/>}
  </>
}

function FlowScriptItemRow({ item, entry, saving, saved, onToggle, onAnswer }: { item: SalesScriptItem; entry?: { checked: boolean; answerText: string }; saving: boolean; saved: boolean; onToggle: () => void; onAnswer: (value: string) => void }) {
  const tag = saving ? <span className="autosave-tag">Salvando...</span> : saved ? <span className="autosave-tag saved">Salvo</span> : null
  if (item.itemType === 'script') return <div className="consultation-script"><Quote size={18}/><p>{item.label}</p></div>
  if (item.itemType === 'attention') return <div className="consultation-attention"><Lightbulb size={20}/><p>{item.label}</p></div>
  if (item.itemType === 'check') return <button className={`consultation-check ${entry?.checked ? 'checked' : ''}`} onClick={onToggle}><span className="consultation-checkbox">{entry?.checked && <Check size={16}/>}</span><span className="consultation-check-label">{item.label}</span>{tag}</button>
  return <div className="consultation-answer"><label>{item.label}</label><FlowAutoGrowTextarea value={entry?.answerText ?? ''} onChange={onAnswer}/>{tag}</div>
}

function FlowAutoGrowTextarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${ref.current.scrollHeight}px` } }, [value])
  return <textarea ref={ref} rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder="Toque para escrever..."/>
}

function WeekCard({ week, services, picker, togglePicker, add, remove, setQuantity, duplicate, last }: { week: Week; services: Service[]; picker: boolean; togglePicker: () => void; add: (id: string) => void; remove: (id: string) => void; setQuantity: (id: string, q: number) => void; duplicate: () => void; last: boolean }) {
  const [filter, setFilter] = useState('')
  const addWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!picker) setFilter('') }, [picker])
  useEffect(() => {
    if (!picker) return
    const handler = (e: MouseEvent) => { if (addWrapRef.current && !addWrapRef.current.contains(e.target as Node)) togglePicker() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [picker, togglePicker])
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(filter.trim().toLowerCase()))
  return <article className={`week-card ${week.items.length ? '' : 'empty'}`}>
    <div className="week-card-head"><div><span>SEMANA</span><strong>{String(week.number).padStart(2, '0')}</strong></div><div><button title="Copiar para a próxima semana" disabled={last} onClick={duplicate}><Copy size={15}/></button></div></div>
    <div className="week-items">{week.items.map(item => <ServicePill key={item.id} item={item} services={services} setQuantity={q => setQuantity(item.id, q)} remove={() => remove(item.id)}/>)}{!week.items.length && <div className="empty-week"><CalendarDays size={20}/><span>Nenhum serviço</span></div>}</div>
    <div className="add-wrap" ref={addWrapRef}><button className="add-service" onClick={togglePicker}><Plus size={16}/> Adicionar serviço</button>{picker && <div className="service-menu"><div className="menu-search"><Search size={14}/><input autoFocus value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar serviço..."/></div>{filteredServices.map(s => <button key={s.id} onClick={() => add(s.id)}><span>{s.name}</span><small>{money(s.price)}</small></button>)}{!filteredServices.length && <div className="service-menu-empty">Nenhum serviço encontrado</div>}</div>}</div>
  </article>
}

function ServicePill({ item, services, setQuantity, remove }: { item: WeekItem; services: Service[]; setQuantity: (q: number) => void; remove: () => void }) {
  const s = services.find(x => x.id === item.serviceId)!; const qty = item.quantity ?? 1
  return <div className="service-pill"><div className="service-dot"/><div><strong>{s.name}</strong><span>{s.category} · {s.duration} min</span></div><div className="quantity-control"><button onClick={() => setQuantity(qty - 1)} disabled={qty <= 1}>−</button><input type="number" min="1" max="99" value={qty} onChange={e => setQuantity(Number(e.target.value))}/><button onClick={() => setQuantity(qty + 1)}>+</button></div><button onClick={remove}><X size={14}/></button></div>
}

function GoalPlanRow({ row, locked, menuOpen, onToggleMenu, onChange, onRemove, onChooseName }: { row: GoalRowDraft; locked?: boolean; menuOpen: boolean; onToggleMenu: () => void; onChange: (patch: Partial<GoalRowDraft>) => void; onRemove: () => void; onChooseName: (name: string) => void }) {
  const constrained = row.valueType === 'number' && row.catalogDecimals !== undefined
  const rangeHint = row.catalogMin !== undefined || row.catalogMax !== undefined ? `Entre ${row.catalogMin ?? '–'} e ${row.catalogMax ?? '–'}` : undefined
  const sanitize = (value: string) => constrained ? sanitizeConstrainedInput(value, row.catalogDecimals!) : value
  const clamp = (field: 'currentInput' | 'targetInput') => { if (!constrained) return; const clamped = clampDecimalInput(row[field], row.catalogMin, row.catalogMax); if (clamped !== row[field]) onChange({ [field]: clamped }) }
  return <div className={`goal-plan-row ${locked ? 'locked' : ''}`}>
    <input className="goal-row-name" list="goal-catalog-datalist" value={row.name} disabled={locked} onChange={e => onChooseName(e.target.value)} placeholder="Nome do indicador (do catálogo ou novo)"/>
    <input className="goal-row-value" value={row.currentInput} disabled={locked} onChange={e => onChange({ currentInput: sanitize(e.target.value) })} onBlur={() => clamp('currentInput')} placeholder="Atual" title={rangeHint} inputMode={row.valueType === 'number' ? 'decimal' : 'text'}/>
    <ArrowRight size={16} className="goal-row-arrow"/>
    <input className="goal-row-value" value={row.targetInput} disabled={locked} onChange={e => onChange({ targetInput: sanitize(e.target.value) })} onBlur={() => clamp('targetInput')} placeholder="Meta" title={rangeHint} inputMode={row.valueType === 'number' ? 'decimal' : 'text'}/>
    <input className="goal-row-unit" value={row.unit} disabled={constrained || locked} onChange={e => onChange({ unit: e.target.value })} placeholder="Unidade"/>
    <div className="goal-row-menu">
      <button title="Mais opções" disabled={locked} onClick={onToggleMenu}><MoreHorizontal size={17}/></button>
      {menuOpen && !locked && <div className="goal-row-menu-panel">
        <label>Tipo de valor<select value={row.valueType} disabled={constrained} onChange={e => onChange({ valueType: e.target.value as GoalValueType, currentInput: '', targetInput: '', catalogDecimals: undefined, catalogMin: undefined, catalogMax: undefined })}>{Object.entries(valueTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Direção da melhora<select value={row.direction} onChange={e => onChange({ direction: e.target.value as GoalDirection })}>{Object.entries(directionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Observação<input value={row.notes} onChange={e => onChange({ notes: e.target.value })}/></label>
        <Button variant="danger" onClick={onRemove}><Trash2 size={14}/> Remover objetivo</Button>
      </div>}
    </div>
  </div>
}
