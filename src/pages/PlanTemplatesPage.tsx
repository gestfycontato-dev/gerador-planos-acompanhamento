import { useState } from 'react'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Plan } from '../types'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

export function PlanTemplatesPage({ templates, openTemplate, createTemplate, removeTemplate }: { templates: Plan[]; openTemplate: (p: Plan) => void; createTemplate: () => void; removeTemplate: (id: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const confirmDelete = () => { if (!deleting) return; const id = deleting.id; setDeleting(null); void removeTemplate(id) }
  return <div className="page">
    <PageHeader kicker="CADASTROS" title="Templates de plano" subtitle="Modelos semanais reutilizáveis para montar planos de pacientes mais rápido." action={<Button variant="primary" onClick={createTemplate}><Plus size={17}/> Novo template</Button>}/>
    {!templates.length && <EmptyState>
      <strong>Nenhum template de plano ainda.</strong>
      <p>Um template guarda o cronograma semanal de serviços pronto — ao usá-lo num plano de paciente, o original continua intacto.</p>
    </EmptyState>}
    <div className="cards-list">
      {templates.map(template => <div className="goal-template-card card" key={template.id}>
        <div className="file-icon"><FileText size={17}/></div>
        <div className="grow"><strong>{template.name.replace('Template · ', '')}</strong><span>{template.duration} semanas · {template.weeks.reduce((n, w) => n + w.items.length, 0)} serviços · atualizado {template.updatedAt}</span></div>
        <div className="row-actions">
          <button className="icon-button" title="Editar" onClick={() => openTemplate(template)}><Pencil size={16}/></button>
          <button className="icon-button danger" title="Excluir" onClick={() => setDeleting(template)}><Trash2 size={16}/></button>
        </div>
      </div>)}
    </div>
    {deleting && <ConfirmDialog title="Excluir template" message={`Tem certeza que deseja excluir o template "${deleting.name.replace('Template · ', '')}"? Essa ação não pode ser desfeita e não afeta planos de pacientes já criados a partir dele.`} confirmLabel="Excluir template" onCancel={() => setDeleting(null)} onConfirm={confirmDelete}/>}
  </div>
}
