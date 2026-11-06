import { useState } from 'react'
import { FileText, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import type { Patient, Plan } from '../types'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PageHeader } from '../components/ui/PageHeader'

export function PlansPage({ plans, patients, open, create, removeTemplate }: { plans: Plan[]; patients: Patient[]; open: (p: Plan) => void; create: () => void; removeTemplate: (id: string) => Promise<void> }) {
  const [filter, setFilter] = useState<'all' | 'history' | 'templates'>('all')
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const visible = plans.filter(p => (filter === 'all' || (filter === 'history' && p.patientId) || (filter === 'templates' && !p.patientId)) && (p.name.toLowerCase().includes(query.toLowerCase()) || patients.find(x => x.id === p.patientId)?.name.toLowerCase().includes(query.toLowerCase())))
  const confirmDelete = () => { if (!deleting) return; const template = deleting; setDeleting(null); void removeTemplate(template.id) }
  return <div className="page" onClick={() => setMenuOpen(null)}>
    <PageHeader kicker="BIBLIOTECA" title="Planos criados" subtitle="Consulte o histórico dos pacientes e os templates reutilizáveis." action={<Button variant="primary" onClick={create}><Plus size={17}/> Criar plano</Button>}/>
    <div className="toolbar">
      <div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por plano ou paciente..."/></div>
      <div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button><button className={filter === 'history' ? 'active' : ''} onClick={() => setFilter('history')}>Histórico</button><button className={filter === 'templates' ? 'active' : ''} onClick={() => setFilter('templates')}>Templates</button></div>
    </div>
    <div className="table-card"><table><thead><tr><th>PLANO</th><th>PACIENTE</th><th>DURAÇÃO</th><th>STATUS</th><th>ATUALIZADO</th><th></th></tr></thead><tbody>
      {visible.map(p => { const patient = patients.find(x => x.id === p.patientId); const isTemplate = !p.patientId; return <tr key={p.id} onClick={() => open(p)}><td><div className="table-main"><div className="file-icon"><FileText size={17}/></div><strong>{p.name}</strong></div></td><td>{patient?.name ?? <span className="muted">Template reutilizável</span>}</td><td>{p.duration} semanas</td><td>{p.patientId ? <span className={`status s-${p.status.replaceAll(' ', '-').toLowerCase()}`}>{p.status}</span> : <span className="status">Template</span>}</td><td className="muted">{p.updatedAt}</td><td className="row-menu-cell" onClick={e => e.stopPropagation()}>
        <button className="icon-button" title="Mais opções" onClick={() => setMenuOpen(current => current === p.id ? null : p.id)}><MoreHorizontal size={18}/></button>
        {menuOpen === p.id && <div className="row-menu-panel">
          <button onClick={() => { setMenuOpen(null); open(p) }}><FileText size={14}/> Abrir</button>
          {isTemplate && <button className="danger" onClick={() => { setMenuOpen(null); setDeleting(p) }}><Trash2 size={14}/> Excluir template</button>}
        </div>}
      </td></tr> })}
      {!visible.length && <tr><td colSpan={6}><span className="muted">Nenhum plano encontrado.</span></td></tr>}
    </tbody></table></div>
    {deleting && <ConfirmDialog title="Excluir template" message={`Tem certeza que deseja excluir o template "${deleting.name}"? Essa ação não pode ser desfeita e não afeta planos de pacientes já criados a partir dele.`} confirmLabel="Excluir template" onCancel={() => setDeleting(null)} onConfirm={confirmDelete}/>}
  </div>
}
