import { addDays, addWeeks, isSameMonth, parseISO, startOfDay } from 'date-fns'
import { FileText, Plus, Sparkles } from 'lucide-react'
import { money } from '../data'
import { planValue } from '../lib/planMath'
import type { Page } from '../lib/constants'
import type { Discount, Patient, Plan, Service } from '../types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

export function Dashboard({ plans, patients, services, discounts, completed, navigate }: { plans: Plan[]; patients: Patient[]; services: Service[]; discounts: Discount[]; completed: string[]; navigate: (p: Page) => void }) {
  const sold = plans.filter(p => p.status === 'Plano vendido' && p.patientId)
  const negotiating = plans.filter(p => p.status === 'Plano criado' && p.patientId).length
  const today = startOfDay(new Date())
  const renewalCount = sold.filter(p => !completed.includes(p.id) && today >= addDays(startOfDay(addWeeks(parseISO(p.startDate), p.duration)), -15)).length
  const revenueThisMonth = sold.filter(p => p.soldAt && isSameMonth(parseISO(p.soldAt), today)).reduce((sum, p) => sum + planValue(p, services, discounts), 0)
  return <div className="page">
    <PageHeader kicker="BEM-VINDO" title="Sua clínica em movimento" subtitle="Acompanhe planos, vendas e renovações em um só lugar." action={<Button variant="primary" onClick={() => navigate('create')}><Plus size={17}/> Criar plano</Button>}/>
    <div className="metric-grid">
      <button className="metric-card" onClick={() => navigate('plans')}><span>PLANOS VENDIDOS</span><strong>{sold.length}</strong><small><Sparkles size={14}/> jornadas em andamento <b>Ver →</b></small></button>
      <button className="metric-card" onClick={() => navigate('sales')}><span>PLANOS CRIADOS</span><strong>{negotiating}</strong><small>aguardando decisão <b>Ver →</b></small></button>
      <button className="metric-card" onClick={() => navigate('renewals')}><span>RENOVAÇÕES</span><strong>{renewalCount}</strong><small>contatos a realizar <b>Ver →</b></small></button>
      <button className="metric-card" onClick={() => navigate('sales')}><span>RECEITA EM PLANOS</span><strong>{money(revenueThisMonth)}</strong><small>neste mês <b>Ver →</b></small></button>
    </div>
    <div className="dashboard-grid">
      <section className="card panel">
        <div className="panel-head"><div><h3>Planos recentes</h3><p>Últimas jornadas editadas</p></div><button onClick={() => navigate('plans')}>Ver todos</button></div>
        {plans.length ? plans.slice(0, 3).map(p => <div className="recent-row" key={p.id}><div className="file-icon"><FileText size={16}/></div><div className="grow"><strong>{p.name}</strong><span>{patients.find(x => x.id === p.patientId)?.name ?? 'Template'}</span></div><span className="muted">{p.updatedAt}</span></div>) : <EmptyState tone="panel">Nenhum plano criado.</EmptyState>}
      </section>
      <section className="card panel clickable-panel" onClick={() => navigate('renewals')}>
        <div className="panel-head"><div><h3>Próximas renovações</h3><p>Agenda completa de vencimentos</p></div><button>Ver todas</button></div>
        <EmptyState tone="panel">{renewalCount ? `${renewalCount} renovação(ões) requerem contato.` : 'Nenhuma ação de renovação pendente.'}</EmptyState>
      </section>
    </div>
  </div>
}
