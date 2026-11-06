import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { money } from '../data'
import { durationOptions, statuses } from '../lib/constants'
import { formatDecimalInput } from '../lib/decimal'
import { planValue } from '../lib/planMath'
import type { Discount, Patient, Plan, SaleSnapshotGoal, SaleStatus, Service } from '../types'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

export function SalesPage({ plans, patients, services, discounts, movePlan }: { plans: Plan[]; patients: Patient[]; services: Service[]; discounts: Discount[]; movePlan: (plan: Plan, status: SaleStatus) => Promise<void> }) {
  const salesPlans = plans.filter(p => p.patientId)
  const [query, setQuery] = useState('')
  const [duration, setDuration] = useState('Todas')
  const [openDeal, setOpenDeal] = useState<Plan | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<SaleStatus | null>(null)
  const filtered = salesPlans.filter(p => { const patient = patients.find(x => x.id === p.patientId); return (p.name.toLowerCase().includes(query.toLowerCase()) || patient?.name.toLowerCase().includes(query.toLowerCase())) && (duration === 'Todas' || p.duration === Number(duration)) })
  const move = (id: string, status: SaleStatus) => { const plan = plans.find(item => item.id === id); if (plan && plan.status !== status) void movePlan(plan, status) }
  const valueOf = (p: Plan) => planValue(p, services, discounts)
  const drop = (e: React.DragEvent, status: SaleStatus) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, status); setDraggingId(null); setDragOverStatus(null) }
  return <div className="page wide">
    <PageHeader kicker="CRM DE VENDAS" title="Pipeline comercial" subtitle="Todo plano salvo para um paciente entra automaticamente em Plano criado. Arraste o card entre as colunas para mudar o status."/>
    <div className="toolbar">
      <div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por paciente ou plano..."/></div>
      <select className="toolbar-select" value={duration} onChange={e => setDuration(e.target.value)}><option>Todas</option>{durationOptions.map(d => <option key={d} value={d}>{d} semanas</option>)}</select>
    </div>
    <div className="kanban three-cols">
      {statuses.map(status => <section className={`kanban-col ${dragOverStatus === status ? 'drag-over' : ''}`} key={status} onDragOver={e => { e.preventDefault(); if (dragOverStatus !== status) setDragOverStatus(status) }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(current => current === status ? null : current) }} onDrop={e => drop(e, status)}>
        <header><span className={`status-dot ${status.replaceAll(' ', '-').toLowerCase()}`}/><strong>{status}</strong><b>{filtered.filter(p => p.status === status).length}</b></header>
        {filtered.filter(p => p.status === status).map(p => { const patient = patients.find(x => x.id === p.patientId); return <article className={`deal-card ${draggingId === p.id ? 'dragging' : ''}`} key={p.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDraggingId(p.id) }} onDragEnd={() => { setDraggingId(null); setDragOverStatus(null) }} onClick={() => setOpenDeal(p)}><span>{patient?.name}</span><strong>{p.name}</strong><div><small>{p.duration} semanas</small><b>{money(valueOf(p))}</b></div><select value={p.status} onClick={e => e.stopPropagation()} onChange={e => move(p.id, e.target.value as SaleStatus)}>{statuses.map(s => <option key={s}>{s}</option>)}</select></article> })}
      </section>)}
    </div>
    {openDeal && <DealModal plan={openDeal} patient={patients.find(x => x.id === openDeal.patientId)} onClose={() => setOpenDeal(null)}/>}
  </div>
}

const formatGoalValue = (goal: SaleSnapshotGoal, value?: number, text?: string) => goal.valueType === 'number' ? `${formatDecimalInput(value) || '—'}${goal.unit ? ` ${goal.unit}` : ''}` : (text || '—')

function DealModal({ plan, patient, onClose }: { plan: Plan; patient: Patient | undefined; onClose: () => void }) {
  const goals = plan.soldSnapshot?.goals ?? []
  return <Modal className="deal-modal" onClose={onClose}>
    <div className="modal-title"><div><span className="eyebrow">{plan.status.toUpperCase()}</span><h3>{plan.name}</h3></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <p className="documents-intro">{patient?.name ?? 'Paciente não associado'} · {plan.duration} semanas</p>
    {plan.status === 'Plano vendido' ? (
      goals.length ? <>
        <label className="deal-goals-label">Objetivos no momento da venda</label>
        <div className="deal-goals-table"><table><thead><tr><th>Indicador</th><th>Situação atual</th><th>Meta</th><th>Unidade</th></tr></thead><tbody>
          {goals.map((goal, i) => <tr key={i}><td>{goal.name}</td><td>{formatGoalValue(goal, goal.currentValue, goal.currentText)}</td><td>{formatGoalValue(goal, goal.targetValue, goal.targetText)}</td><td className="muted">{goal.unit ?? '—'}</td></tr>)}
        </tbody></table></div>
      </> : <p className="documents-intro">Este plano foi vendido sem objetivos cadastrados.</p>
    ) : <p className="documents-intro">Os objetivos ficam congelados assim que o plano é marcado como vendido.</p>}
  </Modal>
}
