import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Check, CheckCircle2, Lightbulb, NotebookPen, Quote, Search, X } from 'lucide-react'
import { finishConsultation, getConsultationFull, getSalesScript, listConsultationsByPatient, listPlanGoals, saveEntry, setConsultationPhase, startConsultation, updateConsultationNotes } from '../repository'
import { consultationPhases } from '../lib/constants'
import { errorMessage } from '../lib/format'
import { formatDecimalInput } from '../lib/decimal'
import { buildRecordText, formatGoalLine } from '../lib/recordSummary'
import type { Consultation, Discount, Patient, Plan, SalesScript, SalesScriptItem, SalesScriptPhase, Service } from '../types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { RecordSummaryModal } from '../components/RecordSummaryModal'

type EntryDraft = { checked: boolean; answerText: string }
type Step = 'pick-patient' | 'history' | 'assistant' | 'finished'

const statusLabels: Record<Consultation['status'], string> = { em_andamento: 'Em andamento', concluida: 'Concluída', abandonada: 'Abandonada' }

const buildInitialEntries = (items: SalesScriptItem[], saved: { itemId?: string; checked?: boolean; answerText?: string }[]): Record<string, EntryDraft> => {
  const map: Record<string, EntryDraft> = {}
  for (const item of items) map[item.id] = { checked: false, answerText: '' }
  for (const entry of saved) { if (entry.itemId && map[entry.itemId]) map[entry.itemId] = { checked: entry.checked ?? false, answerText: entry.answerText ?? '' } }
  return map
}

export function ConsultationPage({ clinicId, userId, patients, plans, services, discounts, initialPatientId, initialConsultationId, notify, onExit, onEnterConsultation, onBuildPlan }: { clinicId: string; userId: string; patients: Patient[]; plans: Plan[]; services: Service[]; discounts: Discount[]; initialPatientId?: string; initialConsultationId?: string; notify: (s: string) => void; onExit: () => void; onEnterConsultation: (id: string) => void; onBuildPlan: (patientId: string, consultationId: string) => void }) {
  const [step, setStep] = useState<Step>('pick-patient')
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(initialPatientId)
  const [history, setHistory] = useState<Consultation[]>([])
  const [script, setScript] = useState<SalesScript | null>(null)
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [entries, setEntries] = useState<Record<string, EntryDraft>>({})
  const [currentPhase, setCurrentPhase] = useState<SalesScriptPhase>('rapport')
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [recordText, setRecordText] = useState<string | null>(null)
  const scriptRef = useRef<SalesScript | null>(null)
  const entriesRef = useRef(entries)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { scriptRef.current = script }, [script])
  useEffect(() => { entriesRef.current = entries }, [entries])

  const ensureScript = async () => { if (scriptRef.current) return scriptRef.current; const loaded = await getSalesScript(clinicId); setScript(loaded); return loaded }

  const loadConsultation = async (id: string) => {
    try {
      const [full, defaultScript] = await Promise.all([getConsultationFull(id), ensureScript()])
      if (!full) { notify('Consulta não encontrada'); return }
      if (!defaultScript) { notify('Nenhum roteiro de vendas cadastrado ainda'); return }
      setConsultation(full)
      setSelectedPatientId(full.patientId)
      setEntries(buildInitialEntries(defaultScript.items, full.entries))
      setCurrentPhase(full.currentPhase)
      setNotes(full.freeNotes ?? '')
      setStep(full.status === 'em_andamento' ? 'assistant' : 'finished')
      onEnterConsultation(full.id)
    } catch (error) { notify(errorMessage(error)) }
  }

  const createAndLoad = async (patientId: string) => {
    try {
      const defaultScript = await ensureScript()
      if (!defaultScript) { notify('Nenhum roteiro de vendas cadastrado ainda'); return }
      const created = await startConsultation(clinicId, patientId, userId, { salesScriptId: defaultScript.id })
      setConsultation(created)
      setEntries(buildInitialEntries(defaultScript.items, []))
      setCurrentPhase(created.currentPhase)
      setNotes('')
      setStep('assistant')
      onEnterConsultation(created.id)
    } catch (error) { notify(errorMessage(error)) }
  }

  const resolvePatient = async (patientId: string) => {
    setSelectedPatientId(patientId)
    try {
      const list = await listConsultationsByPatient(patientId)
      const active = list.find(c => c.status === 'em_andamento')
      if (active) { await loadConsultation(active.id); return }
      if (list.length) { setHistory(list); setStep('history'); return }
      await createAndLoad(patientId)
    } catch (error) { notify(errorMessage(error)) }
  }

  const initializedRef = useRef(false)
  useEffect(() => {
    // guarda contra o StrictMode invocando o efeito duas vezes em desenvolvimento — sem isso, entrar
    // já com um paciente definido criava duas consultas em vez de uma
    if (initializedRef.current) return
    initializedRef.current = true
    if (initialConsultationId) { loadConsultation(initialConsultationId); return }
    if (initialPatientId) { resolvePatient(initialPatientId) }
  }, [])

  const saveImmediately = async (item: SalesScriptItem, draft: EntryDraft) => {
    if (!consultation) return
    setSavingIds(current => new Set(current).add(item.id))
    try {
      await saveEntry(consultation.id, { itemId: item.id, itemType: item.itemType, phase: item.phase, itemLabel: item.label, checked: item.itemType === 'check' ? draft.checked : undefined, answerText: item.itemType === 'answer' ? draft.answerText : undefined })
      setSavedIds(current => new Set(current).add(item.id))
      window.setTimeout(() => setSavedIds(current => { const next = new Set(current); next.delete(item.id); return next }), 1800)
    } catch (error) { notify(errorMessage(error)) } finally { setSavingIds(current => { const next = new Set(current); next.delete(item.id); return next }) }
  }

  const toggleCheck = (item: SalesScriptItem) => {
    const next = !entries[item.id]?.checked
    setEntries(current => ({ ...current, [item.id]: { ...current[item.id], checked: next } }))
    void saveImmediately(item, { checked: next, answerText: entries[item.id]?.answerText ?? '' })
  }

  const changeAnswer = (item: SalesScriptItem, value: string) => {
    setEntries(current => ({ ...current, [item.id]: { ...current[item.id], answerText: value } }))
    clearTimeout(saveTimers.current[item.id])
    saveTimers.current[item.id] = setTimeout(() => { void saveImmediately(item, { checked: entriesRef.current[item.id]?.checked ?? false, answerText: value }) }, 600)
  }

  const changePhase = (phase: SalesScriptPhase) => {
    setCurrentPhase(phase)
    if (consultation) setConsultationPhase(consultation.id, phase).catch(error => notify(errorMessage(error)))
  }

  const changeNotes = (value: string) => {
    setNotes(value)
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => { if (consultation) updateConsultationNotes(consultation.id, value).catch(error => notify(errorMessage(error))) }, 600)
  }

  const finish = async () => {
    if (!consultation) return
    try {
      await finishConsultation(consultation.id, 'concluida')
      setConsultation({ ...consultation, status: 'concluida', finishedAt: new Date().toISOString() })
      setStep('finished')
    } catch (error) { notify(errorMessage(error)) }
  }

  const openRecordModal = async () => {
    if (!consultation || !script) return
    const linkedPlan = consultation.planId ? plans.find(p => p.id === consultation.planId) : undefined
    let planPart: { plan: Plan; goalLines: string[]; services: Service[]; discountPercent: number } | undefined
    if (linkedPlan) {
      try {
        const goals = await listPlanGoals(linkedPlan.id)
        const goalLines = goals.map(goal => formatGoalLine({
          name: goal.name,
          unit: goal.unit,
          current: goal.valueType === 'number' ? formatDecimalInput(goal.currentValue) : (goal.currentText ?? ''),
          target: goal.valueType === 'number' ? formatDecimalInput(goal.targetValue) : (goal.targetText ?? ''),
        }))
        const discountPercent = discounts.find(d => d.duration === linkedPlan.duration)?.percent ?? 0
        planPart = { plan: linkedPlan, goalLines, services, discountPercent }
      } catch (error) { notify(errorMessage(error)); return }
    }
    const text = buildRecordText(patient?.name ?? 'não informado', { startedAt: consultation.startedAt, freeNotes: notes, scriptItems: script.items, entries }, planPart)
    setRecordText(text)
  }

  const patient = patients.find(p => p.id === selectedPatientId)

  if (step === 'pick-patient') {
    const filtered = patients.filter(p => p.name.toLowerCase().includes(patientQuery.toLowerCase()))
    return <div className="page consultation-page">
      <PageHeader kicker="ASSISTENTE DE VENDAS" title="Para qual paciente é a consulta?" subtitle="Escolha o paciente para iniciar ou retomar o roteiro de venda consultiva."/>
      <div className="search"><Search size={17}/><input value={patientQuery} onChange={e => setPatientQuery(e.target.value)} placeholder="Buscar paciente pelo nome..." autoFocus/></div>
      <div className="cards-list">
        {filtered.map(p => <button key={p.id} className="goal-template-card card consultation-patient-pick" onClick={() => resolvePatient(p.id)}><div className="avatar pale">{p.initials}</div><div className="grow"><strong>{p.name}</strong></div></button>)}
        {!filtered.length && <EmptyState>Nenhum paciente encontrado.</EmptyState>}
      </div>
    </div>
  }

  if (step === 'history') {
    return <div className="page consultation-page">
      <PageHeader kicker="ASSISTENTE DE VENDAS" title={`Consultas de ${patient?.name ?? 'paciente'}`} subtitle="Retome uma consulta em andamento ou comece uma nova." action={<Button variant="ghost" onClick={() => setStep('pick-patient')}>Trocar paciente</Button>}/>
      <div className="cards-list">
        {history.map(c => <div className="goal-template-card card" key={c.id}>
          <div className="grow"><strong>{format(parseISO(c.startedAt), 'dd/MM/yyyy · HH:mm')}</strong><span>{statusLabels[c.status]}</span></div>
          {c.status === 'em_andamento' && <Button variant="primary" onClick={() => loadConsultation(c.id)}>Retomar</Button>}
        </div>)}
      </div>
      <div className="settings-save"><Button variant="primary" onClick={() => selectedPatientId && createAndLoad(selectedPatientId)}>Iniciar nova consulta</Button></div>
    </div>
  }

  if (step === 'finished') {
    return <div className="page consultation-page"><div className="consultation-finished card">
      <CheckCircle2 size={42}/>
      <h2>Consulta concluída</h2>
      <p>O que você quer fazer agora com {patient?.name ?? 'este paciente'}?</p>
      <div className="consultation-finished-actions">
        <Button variant="primary" onClick={() => selectedPatientId && consultation && onBuildPlan(selectedPatientId, consultation.id)}>Montar plano de acompanhamento</Button>
        <Button variant="ghost" onClick={openRecordModal}>Copiar para o prontuário</Button>
      </div>
      <button className="back-link" onClick={onExit}>Voltar ao início</button>
      {recordText !== null && <RecordSummaryModal text={recordText} onClose={() => setRecordText(null)} notify={notify}/>}
    </div></div>
  }

  if (!consultation || !script) return <div className="page consultation-page"><p className="documents-intro">Carregando...</p></div>

  const phaseIndex = consultationPhases.indexOf(currentPhase)
  const phaseItems = script.items.filter(item => item.phase === currentPhase).sort((a, b) => (a.itemType === 'attention' ? 0 : 1) - (b.itemType === 'attention' ? 0 : 1) || a.sortOrder - b.sortOrder)
  const phaseMeta = phaseItems[0]

  return <div className="consultation-shell">
    <header className="consultation-top">
      <button className="icon-button" onClick={onExit}><ArrowLeft size={19}/></button>
      <div className="consultation-top-patient"><strong>{patient?.name ?? 'Paciente'}</strong><span>Consulta iniciada em {format(parseISO(consultation.startedAt), 'dd/MM/yyyy')}</span></div>
      <div className="consultation-top-actions">
        <Button variant="ghost" onClick={() => setNotesOpen(o => !o)}><NotebookPen size={16}/> Anotações</Button>
        <Button variant="primary" onClick={finish}>Concluir consulta</Button>
      </div>
    </header>
    <div className="consultation-progress">{consultationPhases.map((phase, i) => <button key={phase} className={phase === currentPhase ? 'active' : ''} onClick={() => changePhase(phase)}>{i + 1}</button>)}</div>
    <main className="consultation-body">
      <div className="consultation-phase-head">
        <span className="eyebrow">{phaseMeta?.phaseLabel}</span>
        <h1>{phaseMeta?.sectionLabel ?? phaseMeta?.phaseLabel}</h1>
        {phaseMeta?.timeHint && <span className="consultation-time">{phaseMeta.timeHint}</span>}
      </div>
      <div className="consultation-items">
        {phaseItems.map(item => <ConsultationItemRow key={item.id} item={item} entry={entries[item.id]} saving={savingIds.has(item.id)} saved={savedIds.has(item.id)} onToggle={() => toggleCheck(item)} onAnswer={value => changeAnswer(item, value)}/>)}
      </div>
      <div className="consultation-nav">
        <Button variant="ghost" disabled={phaseIndex === 0} onClick={() => changePhase(consultationPhases[phaseIndex - 1])}>← Fase anterior</Button>
        {phaseIndex < consultationPhases.length - 1
          ? <Button variant="primary" onClick={() => changePhase(consultationPhases[phaseIndex + 1])}>Próxima fase →</Button>
          : <Button variant="primary" onClick={finish}>Concluir consulta</Button>}
      </div>
    </main>
    {notesOpen && <div className="consultation-notes-panel">
      <div className="consultation-notes-head"><label>Anotações livres</label><button className="icon-button" onClick={() => setNotesOpen(false)}><X size={16}/></button></div>
      <textarea value={notes} onChange={e => changeNotes(e.target.value)} placeholder="Qualquer observação que não se encaixe no roteiro..." autoFocus/>
    </div>}
  </div>
}

function ConsultationItemRow({ item, entry, saving, saved, onToggle, onAnswer }: { item: SalesScriptItem; entry?: EntryDraft; saving: boolean; saved: boolean; onToggle: () => void; onAnswer: (value: string) => void }) {
  const tag = saving ? <span className="autosave-tag">Salvando...</span> : saved ? <span className="autosave-tag saved">Salvo</span> : null
  if (item.itemType === 'script') return <div className="consultation-script"><Quote size={18}/><p>{item.label}</p></div>
  if (item.itemType === 'attention') return <div className="consultation-attention"><Lightbulb size={20}/><p>{item.label}</p></div>
  if (item.itemType === 'check') return <button className={`consultation-check ${entry?.checked ? 'checked' : ''}`} onClick={onToggle}><span className="consultation-checkbox">{entry?.checked && <Check size={16}/>}</span><span className="consultation-check-label">{item.label}</span>{tag}</button>
  return <div className="consultation-answer"><label>{item.label}</label><AutoGrowTextarea value={entry?.answerText ?? ''} onChange={onAnswer}/>{tag}</div>
}

function AutoGrowTextarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${ref.current.scrollHeight}px` } }, [value])
  return <textarea ref={ref} rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder="Toque para escrever..."/>
}
