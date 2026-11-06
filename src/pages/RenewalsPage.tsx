import { useMemo, useState } from 'react'
import { addDays, addWeeks, format, parseISO, startOfDay } from 'date-fns'
import { Check, ClipboardList, X } from 'lucide-react'
import { formatDecimalInput, parseDecimalInput } from '../lib/decimal'
import type { Patient, Plan, SaleSnapshotGoal } from '../types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

export function RenewalControl({ plans, patients, completed, finish, startRenewal }: { plans: Plan[]; patients: Patient[]; completed: string[]; finish: (id: string) => Promise<void>; startRenewal: (patientId: string, carryGoals: SaleSnapshotGoal[]) => void }) {
  const [onlyActions, setOnlyActions] = useState(false)
  const [goalsPlan, setGoalsPlan] = useState<Plan | null>(null)
  const completedSet = useMemo(() => new Set(completed), [completed])
  const today = startOfDay(new Date())
  const rows = plans.filter(p => p.patientId && p.status === 'Plano vendido' && !completedSet.has(p.id)).map(p => {
    const expiration = startOfDay(addWeeks(parseISO(p.startDate), p.duration))
    const contactDate = addDays(expiration, -15)
    return { ...p, expiration, contactDate, needsAction: today >= contactDate }
  }).filter(p => !onlyActions || p.needsAction).sort((a, b) => a.expiration.getTime() - b.expiration.getTime())
  const pending = rows.filter(p => p.needsAction).length
  return <div className="page wide">
    <PageHeader kicker="CONTROLE" title="Renovações" subtitle="Todos os planos, ordenados do vencimento mais próximo ao mais distante."/>
    <div className="renewal-toolbar"><label><input type="checkbox" checked={onlyActions} onChange={e => setOnlyActions(e.target.checked)}/><span>Mostrar somente atividades a realizar</span></label><small>{pending} contato(s) pendente(s)</small></div>
    <div className="table-card renew-table renewal-all"><table><thead><tr><th>PACIENTE</th><th>PLANO CRIADO</th><th>DATA DE INÍCIO</th><th>DATA DE VENCIMENTO</th><th>INICIAR CONTATOS</th><th>AÇÃO</th></tr></thead><tbody>
      {rows.map(p => { const patient = patients.find(x => x.id === p.patientId); return <tr key={p.id}><td><strong>{patient?.name ?? 'Paciente não encontrado'}</strong></td><td>{p.name}</td><td className="muted">{format(parseISO(p.startDate), 'dd/MM/yyyy')}</td><td><strong>{format(p.expiration, 'dd/MM/yyyy')}</strong></td><td>{format(p.contactDate, 'dd/MM/yyyy')}</td><td><div className="renewal-action">{p.needsAction ? <span className="renew-status urgent">Entrar em contato para renovar</span> : <span className="renew-status quiet">Nada a realizar</span>}<button className="check-action objetivos" onClick={() => setGoalsPlan(p)} title="Ver objetivos do ciclo e preparar a renovação"><ClipboardList size={16}/></button>{p.needsAction && <button className="check-action" onClick={() => finish(p.id)} title="Marcar contato como realizado"><Check size={16}/></button>}</div></td></tr> })}
      {!rows.length && <tr><td colSpan={6}><EmptyState tone="panel">{onlyActions ? 'Nenhuma atividade de renovação pendente.' : 'Nenhum plano disponível para acompanhamento.'}</EmptyState></td></tr>}
    </tbody></table></div>
    {goalsPlan && <RenewalGoalsModal plan={goalsPlan} patient={patients.find(x => x.id === goalsPlan.patientId)} onClose={() => setGoalsPlan(null)} startRenewal={startRenewal}/>}
  </div>
}

function RenewalGoalsModal({ plan, patient, onClose, startRenewal }: { plan: Plan; patient: Patient | undefined; onClose: () => void; startRenewal: (patientId: string, carryGoals: SaleSnapshotGoal[]) => void }) {
  const previousGoals = plan.soldSnapshot?.goals ?? []
  const [newValues, setNewValues] = useState<Record<number, string>>({})

  const confirm = () => {
    if (!plan.patientId) return
    const carryGoals: SaleSnapshotGoal[] = previousGoals.map((goal, i) => {
      const typed = newValues[i]?.trim()
      if (goal.valueType === 'number') return { ...goal, currentValue: typed ? parseDecimalInput(typed) : goal.targetValue ?? goal.currentValue }
      return { ...goal, currentText: typed || goal.targetText || goal.currentText }
    })
    startRenewal(plan.patientId, carryGoals)
    onClose()
  }

  return <Modal className="renewal-goals-modal" onClose={onClose}>
    <div className="modal-title"><div><span className="eyebrow">RENOVAÇÃO</span><h3>Objetivos do ciclo anterior — {patient?.name ?? 'paciente'}</h3></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>
    {previousGoals.length ? <>
      <p className="documents-intro">Confira com o paciente onde cada indicador chegou e registre o novo valor atual antes de montar a renovação.</p>
      <div className="renewal-goals-rows">
        <div className="renewal-goals-row renewal-goals-head"><span>Indicador</span><span>Meta do ciclo anterior</span><span>Novo valor atual</span></div>
        {previousGoals.map((goal, i) => {
          const target = goal.valueType === 'number' ? `${formatDecimalInput(goal.targetValue) || '—'}${goal.unit ? ` ${goal.unit}` : ''}` : (goal.targetText || '—')
          return <div className="renewal-goals-row" key={i}>
            <span>{goal.name}</span>
            <span className="muted">{target}</span>
            <input value={newValues[i] ?? ''} onChange={e => setNewValues(current => ({ ...current, [i]: e.target.value }))} placeholder={goal.valueType === 'number' ? formatDecimalInput(goal.targetValue) : goal.targetText} inputMode={goal.valueType === 'number' ? 'decimal' : 'text'}/>
          </div>
        })}
      </div>
    </> : <p className="documents-intro">Este ciclo foi vendido sem objetivos cadastrados — a renovação pode ser iniciada do zero.</p>}
    <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={confirm}>Iniciar plano de renovação</Button></div>
  </Modal>
}
