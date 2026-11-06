import { addDays, addWeeks, format, parseISO } from 'date-fns'
import { money } from '../data'
import type { PresentationGoal } from '../lib/documents'
import { planTextData } from '../lib/documents'
import type { ClinicProfile, Patient, Plan, Service } from '../types'

const formatGoalNumber = (value: number, decimals?: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: decimals ?? (Number.isInteger(value) ? 0 : 2), maximumFractionDigits: decimals ?? 2 })

function GoalChart({ current, target, unit, decimals, primary }: { current: number; target: number; unit?: string; decimals?: number; primary: string }) {
  const lo = Math.min(current, target), hi = Math.max(current, target)
  const margin = Math.max(Math.abs(hi), 1) * 0.15
  const axisMin = Math.max(0, lo - margin)
  const axisMax = hi + margin
  const span = axisMax - axisMin || 1
  const W = 300, H = 190, baseY = 156, top = 22, barW = 78, gap = 56
  const xCurrent = 62, xTarget = xCurrent + barW + gap
  const heightFor = (v: number) => ((v - axisMin) / span) * (baseY - top)
  const fmt = (v: number) => `${formatGoalNumber(v, decimals)}${unit ? ` ${unit}` : ''}`
  const bar = (x: number, value: number, fill: string, label: string) => {
    const height = Math.max(heightFor(value), 2)
    const y = baseY - height
    return <g key={label}>
      <rect x={x} y={y} width={barW} height={height} rx={4} fill={fill}/>
      <text x={x + barW / 2} y={y - 9} textAnchor="middle" className="pv-chart-value">{fmt(value)}</text>
      <text x={x + barW / 2} y={baseY + 20} textAnchor="middle" className="pv-chart-label">{label}</text>
    </g>
  }
  return <svg viewBox={`0 0 ${W} ${H}`} className="pv-chart-svg" role="img" aria-label={`${fmt(current)} atual, meta de ${fmt(target)}`}>
    <line x1={28} y1={baseY} x2={W - 16} y2={baseY} className="pv-chart-axis"/>
    {bar(xCurrent, current, '#9aa4b8', 'Atual')}
    {bar(xTarget, target, primary, 'Meta')}
  </svg>
}

export function PlanPresentationView({ plan, patient, services, clinic, discount, goals }: { plan: Plan; patient: Patient | undefined; services: Service[]; clinic: ClinicProfile; discount: number; goals: PresentationGoal[] }) {
  const { start, totals } = planTextData(plan, services)
  const end = addWeeks(start, plan.duration)
  const subtotal = plan.weeks.flatMap(w => w.items).reduce((sum, item) => sum + (services.find(s => s.id === item.serviceId)?.price ?? 0) * (item.quantity ?? 1), 0)
  const total = subtotal * (1 - discount / 100)
  const primary = clinic.brandPrimary || '#293D67'
  const numericGoals = goals.filter((g): g is PresentationGoal & { current: number; target: number } => g.valueType === 'number' && g.current !== undefined && g.target !== undefined)

  return <div className="plan-presentation-view">
    <section className="pv-cover" style={{ borderColor: primary }}>
      <div className="pv-cover-top">{clinic.logo ? <img src={clinic.logo} alt="Logo"/> : <b style={{ color: primary }}>{clinic.name || 'Clínica'}</b>}<span>{clinic.doctorName}{clinic.crm ? ` · ${clinic.crm}` : ''}</span></div>
      <div className="pv-cover-mid">
        <span style={{ color: clinic.brandSecondary || '#667085' }}>Apresentação do plano de acompanhamento</span>
        <h1 style={{ color: primary }}>{patient?.name ?? 'Paciente'}</h1>
        <div className="pv-cover-meta">
          <div><span>Início</span><strong>{format(start, 'dd/MM/yyyy')}</strong></div>
          <div><span>Término previsto</span><strong>{format(end, 'dd/MM/yyyy')}</strong></div>
          <div><span>Duração</span><strong>{plan.duration} semanas</strong></div>
        </div>
      </div>
    </section>

    <section className="pv-section">
      <h2 style={{ color: primary }}>O que será feito</h2>
      <div className="pv-week-grid">{plan.weeks.map(w => {
        const date = addWeeks(start, w.number - 1)
        return <article className={`pv-week ${w.items.length ? '' : 'empty'}`} key={w.number}>
          <span>Semana {String(w.number).padStart(2, '0')}</span>
          <b style={{ color: primary }}>{format(date, 'dd/MM')} a {format(addDays(date, 6), 'dd/MM')}</b>
          {w.items.length ? <ul>{w.items.map(i => <li key={i.id}>{services.find(s => s.id === i.serviceId)?.name ?? 'Serviço'}{(i.quantity ?? 1) > 1 ? ` (${i.quantity}x)` : ''}</li>)}</ul> : <small>Sem aplicações previstas</small>}
        </article>
      })}</div>
    </section>

    {!!goals.length && <section className="pv-section">
      <h2 style={{ color: primary }}>Onde você está hoje → onde queremos chegar</h2>
      <div className="pv-goal-cards">{goals.map((goal, i) => {
        const currentDisplay = goal.valueType === 'number' ? `${formatGoalNumber(goal.current ?? 0, goal.decimals)}${goal.unit ? ` ${goal.unit}` : ''}` : (goal.currentText || '—')
        const targetDisplay = goal.valueType === 'number' ? `${formatGoalNumber(goal.target ?? 0, goal.decimals)}${goal.unit ? ` ${goal.unit}` : ''}` : (goal.targetText || '—')
        return <article className="pv-goal-card" key={i}><h3>{goal.name}</h3><div className="pv-goal-values"><span>{currentDisplay}</span><b>→</b><span className="target" style={{ color: primary }}>{targetDisplay}</span></div></article>
      })}</div>
    </section>}

    {!!numericGoals.length && <section className="pv-section">
      <h2 style={{ color: primary }}>Gráficos</h2>
      <div className="pv-chart-grid">{numericGoals.map((goal, i) => <article className="pv-chart-card" key={i}><h3>{goal.name}</h3><GoalChart current={goal.current} target={goal.target} unit={goal.unit} decimals={goal.decimals} primary={primary}/></article>)}</div>
    </section>}

    <section className="pv-section">
      <h2 style={{ color: primary }}>O que está incluído</h2>
      <div className="pv-included">{totals.length ? totals.map(s => <div className="pv-included-row" key={s.id}><span>{s.name}</span><b style={{ color: primary }}>{s.qty}x</b></div>) : <div className="pv-included-row"><span>Nenhuma aplicação cadastrada</span></div>}</div>
    </section>

    <section className="pv-section">
      <h2 style={{ color: primary }}>Investimento</h2>
      <div className="pv-invest" style={{ borderColor: primary }}>
        <div><span>Valor do plano</span><strong style={{ color: primary }}>{money(total)}</strong>{discount > 0 && <small>Desconto de {discount}% aplicado para {plan.duration} semanas</small>}</div>
      </div>
    </section>
  </div>
}
