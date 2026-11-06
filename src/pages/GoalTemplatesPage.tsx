import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Target, Trash2, X } from 'lucide-react'
import { createGoalTemplate, deleteGoalTemplate, listGoalCatalog, listGoalTemplates, updateGoalTemplate } from '../repository'
import { clampDecimalInput, formatDecimalInput, parseDecimalInput, sanitizeConstrainedInput } from '../lib/decimal'
import type { GoalCatalogItem, GoalDirection, GoalTemplate, GoalTemplateInput, GoalTemplateItem, GoalValueType } from '../types'
import { errorMessage } from '../lib/format'
import { directionLabels, findCatalogMatch, valueTypeLabels } from '../lib/goalLabels'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

type ItemDraft = { id?: string; name: string; unit: string; direction: GoalDirection; valueType: GoalValueType; currentInput: string; targetInput: string; notes: string; sortOrder: number; catalogDecimals?: number; catalogMin?: number; catalogMax?: number }
type FormDraft = { name: string; description?: string; items: ItemDraft[] }
type EditingState = { id?: string; form: FormDraft }

const emptyItem = (sortOrder: number): ItemDraft => ({ name: '', unit: '', direction: 'decrease', valueType: 'number', currentInput: '', targetInput: '', notes: '', sortOrder })
const emptyForm = (): FormDraft => ({ name: '', description: '', items: [emptyItem(0)] })
const toItemDraft = (item: GoalTemplateItem, catalog: GoalCatalogItem[] | null): ItemDraft => {
  const match = findCatalogMatch(item.name, catalog)
  return { id: item.id, name: item.name, unit: item.unit ?? '', direction: item.direction, valueType: item.valueType, currentInput: item.valueType === 'number' ? formatDecimalInput(item.defaultCurrent) : '', targetInput: item.valueType === 'number' ? formatDecimalInput(item.defaultTarget) : '', notes: item.notes ?? '', sortOrder: item.sortOrder, catalogDecimals: match?.decimals, catalogMin: match?.minValue, catalogMax: match?.maxValue }
}
const toItemInput = (draft: ItemDraft) => ({
  id: draft.id,
  name: draft.name.trim(),
  unit: draft.unit.trim() || undefined,
  direction: draft.direction,
  valueType: draft.valueType,
  notes: draft.notes.trim() || undefined,
  sortOrder: draft.sortOrder,
  defaultCurrent: draft.valueType === 'number' ? parseDecimalInput(draft.currentInput) : undefined,
  defaultTarget: draft.valueType === 'number' ? parseDecimalInput(draft.targetInput) : undefined,
})

export function GoalTemplatesPage({ clinicId, notify }: { clinicId: string; notify: (s: string) => void }) {
  const [templates, setTemplates] = useState<GoalTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<GoalCatalogItem[] | null>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [deleting, setDeleting] = useState<GoalTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = () => { setLoading(true); listGoalTemplates(clinicId).then(setTemplates).catch(error => notify(errorMessage(error))).finally(() => setLoading(false)) }
  useEffect(() => { reload() }, [clinicId])
  useEffect(() => { listGoalCatalog().then(setCatalog).catch(error => notify(errorMessage(error))) }, [])

  const openCreate = () => setEditing({ form: emptyForm() })
  const openEdit = (template: GoalTemplate) => setEditing({ id: template.id, form: { name: template.name, description: template.description ?? '', items: template.items.map(item => toItemDraft(item, catalog)) } })

  const duplicate = async (template: GoalTemplate) => {
    try {
      await createGoalTemplate(clinicId, { name: `${template.name} (cópia)`, description: template.description, items: template.items.map(({ id, ...item }) => item) })
      notify('Template duplicado'); reload()
    } catch (error) { notify(errorMessage(error)) }
  }
  const confirmDelete = async () => {
    if (!deleting) return
    const id = deleting.id; setDeleting(null)
    try { await deleteGoalTemplate(id); notify('Template excluído'); reload() } catch (error) { notify(errorMessage(error)) }
  }

  const updateForm = (patch: Partial<FormDraft>) => setEditing(current => current ? { ...current, form: { ...current.form, ...patch } } : current)
  const updateItem = (index: number, patch: Partial<ItemDraft>) => setEditing(current => current ? { ...current, form: { ...current.form, items: current.form.items.map((item, i) => i === index ? { ...item, ...patch } : item) } } : current)
  const addItem = () => setEditing(current => current ? { ...current, form: { ...current.form, items: [...current.form.items, emptyItem(current.form.items.length)] } } : current)
  const removeItem = (index: number) => setEditing(current => current ? { ...current, form: { ...current.form, items: current.form.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i })) } } : current)
  const moveItem = (index: number, dir: -1 | 1) => setEditing(current => {
    if (!current) return current
    const target = index + dir
    if (target < 0 || target >= current.form.items.length) return current
    const items = [...current.form.items]
    ;[items[index], items[target]] = [items[target], items[index]]
    return { ...current, form: { ...current.form, items: items.map((item, i) => ({ ...item, sortOrder: i })) } }
  })
  const chooseIndicatorName = (index: number, name: string) => {
    const match = findCatalogMatch(name, catalog)
    updateItem(index, match
      ? { name, unit: match.unit ?? '', direction: match.defaultDirection, valueType: 'number', currentInput: '', targetInput: '', catalogDecimals: match.decimals, catalogMin: match.minValue, catalogMax: match.maxValue }
      : { name, catalogDecimals: undefined, catalogMin: undefined, catalogMax: undefined })
  }

  const save = async () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { notify('Informe o nome do template'); return }
    const items = editing.form.items.map(toItemInput).filter(item => item.name)
    if (!items.length) { notify('Adicione pelo menos um indicador'); return }
    setSaving(true)
    try {
      const payload: GoalTemplateInput = { name, description: editing.form.description?.trim() || undefined, items }
      if (editing.id) await updateGoalTemplate(editing.id, payload)
      else await createGoalTemplate(clinicId, payload)
      notify(editing.id ? 'Template atualizado' : 'Template criado')
      setEditing(null); reload()
    } catch (error) { notify(errorMessage(error)) } finally { setSaving(false) }
  }

  return <div className="page">
    <PageHeader kicker="CADASTROS" title="Templates de objetivos" subtitle="Pré-configure os indicadores que você costuma acompanhar, para não redigitar a cada consulta." action={<Button variant="primary" onClick={openCreate}><Plus size={17}/> Novo template</Button>}/>
    {!loading && !templates.length && <EmptyState>
      <strong>Nenhum template de objetivos ainda.</strong>
      <p>Um template agrupa os indicadores que você acompanha num tipo de tratamento — não é específico de uma especialidade. Alguns exemplos:</p>
      <ul>
        <li><b>Endocrinologia:</b> TSH, T4 livre, HbA1c</li>
        <li><b>Nutrologia:</b> peso, % de gordura corporal, vitamina D</li>
        <li><b>Psiquiatria:</b> escala de humor, horas de sono, adesão à medicação</li>
      </ul>
    </EmptyState>}
    <div className="cards-list">
      {templates.map(template => <div className="goal-template-card card" key={template.id}>
        <div className="file-icon"><Target size={17}/></div>
        <div className="grow"><strong>{template.name}</strong><span>{template.items.length} indicador{template.items.length === 1 ? '' : 'es'}{template.description ? ` · ${template.description}` : ''}</span></div>
        <div className="row-actions">
          <button className="icon-button" title="Duplicar" onClick={() => duplicate(template)}><Copy size={16}/></button>
          <button className="icon-button" title="Editar" onClick={() => openEdit(template)}><Pencil size={16}/></button>
          <button className="icon-button danger" title="Excluir" onClick={() => setDeleting(template)}><Trash2 size={16}/></button>
        </div>
      </div>)}
    </div>

    {editing && <Modal className="goal-modal" onClose={() => setEditing(null)}>
      <div className="modal-title"><div><span className="eyebrow">TEMPLATE DE OBJETIVOS</span><h3>{editing.id ? 'Editar template' : 'Novo template'}</h3></div><button className="icon-button" onClick={() => setEditing(null)}><X size={18}/></button></div>
      <datalist id="goal-catalog-datalist">{catalog?.map(c => <option key={c.id} value={c.name}/>)}</datalist>
      <div className="form-grid">
        <Field label="Nome do template" full><input value={editing.form.name} onChange={e => updateForm({ name: e.target.value })} placeholder="Ex.: Protocolo de acompanhamento tireoidiano"/></Field>
        <Field label="Descrição (opcional)" full><input value={editing.form.description ?? ''} onChange={e => updateForm({ description: e.target.value })}/></Field>
      </div>
      <div className="goal-items-head"><span>INDICADORES</span><Button variant="soft" onClick={addItem}><Plus size={15}/> Adicionar indicador</Button></div>
      <div className="goal-items-list">
        {editing.form.items.map((item, index) => {
          const constrained = item.valueType === 'number' && item.catalogDecimals !== undefined
          const rangeHint = item.catalogMin !== undefined || item.catalogMax !== undefined ? `Entre ${item.catalogMin ?? '–'} e ${item.catalogMax ?? '–'}` : undefined
          const sanitize = (value: string) => constrained ? sanitizeConstrainedInput(value, item.catalogDecimals!) : value
          const clamp = (field: 'currentInput' | 'targetInput') => { if (!constrained) return; const clamped = clampDecimalInput(item[field], item.catalogMin, item.catalogMax); if (clamped !== item[field]) updateItem(index, { [field]: clamped }) }
          return <div className="goal-item-card" key={index}>
          <div className="goal-item-head">
            <div className="goal-item-order"><button disabled={index === 0} onClick={() => moveItem(index, -1)}><ChevronUp size={15}/></button><span>{index + 1}</span><button disabled={index === editing.form.items.length - 1} onClick={() => moveItem(index, 1)}><ChevronDown size={15}/></button></div>
            <button className="icon-button danger" title="Remover indicador" onClick={() => removeItem(index)}><Trash2 size={14}/></button>
          </div>
          <div className="form-grid">
            <Field label="Indicador" full help="Escolha da lista do catálogo ou digite um indicador novo."><input list="goal-catalog-datalist" value={item.name} onChange={e => chooseIndicatorName(index, e.target.value)} placeholder="Ex.: Peso, TSH, Escala de humor"/></Field>
            <Field label="Unidade (opcional)"><input value={item.unit} disabled={constrained} onChange={e => updateItem(index, { unit: e.target.value })} placeholder="kg, ng/mL, pontos..."/></Field>
            <Field label="Tipo de valor"><select value={item.valueType} disabled={constrained} onChange={e => updateItem(index, { valueType: e.target.value as GoalValueType, currentInput: '', targetInput: '' })}>{Object.entries(valueTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Direção da melhora" full><select value={item.direction} onChange={e => updateItem(index, { direction: e.target.value as GoalDirection })}>{Object.entries(directionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            {item.valueType === 'number' && <>
              <Field label="Valor atual padrão (opcional)"><input value={item.currentInput} title={rangeHint} inputMode="decimal" onChange={e => updateItem(index, { currentInput: sanitize(e.target.value) })} onBlur={() => clamp('currentInput')}/></Field>
              <Field label="Meta padrão (opcional)"><input value={item.targetInput} title={rangeHint} inputMode="decimal" onChange={e => updateItem(index, { targetInput: sanitize(e.target.value) })} onBlur={() => clamp('targetInput')}/></Field>
            </>}
            <Field label="Observação (opcional)" full><input value={item.notes} onChange={e => updateItem(index, { notes: e.target.value })} placeholder="Ex.: ruim → boa"/></Field>
          </div>
        </div>})}
        {!editing.form.items.length && <EmptyState>Nenhum indicador adicionado ainda.</EmptyState>}
      </div>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar template'}</Button></div>
    </Modal>}

    {deleting && <ConfirmDialog title="Excluir template de objetivos" message={`Tem certeza que deseja excluir "${deleting.name}"? Essa ação não pode ser desfeita.`} confirmLabel="Excluir template" onCancel={() => setDeleting(null)} onConfirm={confirmDelete}/>}
  </div>
}
