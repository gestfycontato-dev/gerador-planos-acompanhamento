import { useState } from 'react'
import { Library, Pencil, Plus, Stethoscope, Trash2, X } from 'lucide-react'
import { money } from '../data'
import { normalizeCategory } from '../repository'
import type { Service } from '../types'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

export function ServicesPage({ services, categories, saveService, removeService, addCategoryRecord, removeCategoryRecord, notify }: { services: Service[]; categories: string[]; saveService: (service: Service) => Promise<boolean>; removeService: (id: string) => Promise<void>; addCategoryRecord: (name: string) => Promise<string | null>; removeCategoryRecord: (name: string) => Promise<void>; notify: (s: string) => void }) {
  const empty = { id: '', name: '', category: 'Consulta', price: 0, duration: 30 }
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const setCategories = (update: React.SetStateAction<string[]>) => { const next = typeof update === 'function' ? update(categories) : update; const removed = categories.find(name => !next.includes(name)); if (removed) void removeCategoryRecord(removed) }
  const save = async () => { if (!editing?.name.trim() || editing.price < 0) return; const next = { ...editing, id: editing.id || crypto.randomUUID() }; if (await saveService(next)) setEditing(null) }
  const confirmRemove = () => { if (!deleting) return; const id = deleting.id; setDeleting(null); void removeService(id) }
  const addCategory = async () => { const clean = newCategory.trim(); if (!clean) return; const existing = categories.find(c => normalizeCategory(c) === normalizeCategory(clean)); if (existing) { setEditing(current => current ? { ...current, category: existing } : current); notify(`Categoria semelhante já existe: ${existing}`); return } const created = await addCategoryRecord(clean); if (created) { setEditing(current => current ? { ...current, category: created } : current); setNewCategory('') } }
  const openNewService = () => { if (categories.length) setEditing({ ...empty, category: categories[0] }); else { notify('Cadastre uma categoria antes de criar o primeiro serviço'); setCategoryOpen(true) } }
  return <div className="page">
    <PageHeader kicker="CATÁLOGO" title="Serviços e preços" subtitle={`${services.length} itens em ${categories.length} categorias padronizadas.`} action={<div className="header-actions"><Button variant="ghost" onClick={() => setCategoryOpen(true)}><Library size={16}/> Categorias</Button><Button variant="primary" onClick={openNewService}><Plus size={17}/> Novo serviço</Button></div>}/>
    {!categories.length && <EmptyState>
      <strong>Comece cadastrando uma categoria.</strong>
      <p>Categorias padronizam os serviços (ex.: "Consulta", "Estética facial") e evitam nomes duplicados. Cadastre a primeira para depois criar seu primeiro serviço.</p>
      <Button variant="primary" onClick={() => setCategoryOpen(true)}><Plus size={16}/> Criar primeira categoria</Button>
    </EmptyState>}
    {!!categories.length && !services.length && <EmptyState>
      <strong>Categorias prontas — agora crie seu primeiro serviço.</strong>
      <p>Cada serviço tem nome, categoria, duração e preço, e poderá ser usado no cronograma dos planos.</p>
      <Button variant="primary" onClick={openNewService}><Plus size={16}/> Criar primeiro serviço</Button>
    </EmptyState>}
    {!!services.length && <div className="service-catalog">{services.map(s => <div className="catalog-card card" key={s.id}><div className="catalog-icon"><Stethoscope size={19}/></div><div className="catalog-actions"><button onClick={() => setEditing({ ...s })}><Pencil size={15}/></button><button className="danger" onClick={() => setDeleting(s)}><Trash2 size={15}/></button></div><span>{s.category.toUpperCase()}</span><h3>{s.name}</h3><p>{s.duration} min</p><strong>{money(s.price)}</strong></div>)}</div>}
    {deleting && <ConfirmDialog title="Excluir serviço" message={`Tem certeza que deseja excluir ${deleting.name}? Essa ação não pode ser desfeita.`} confirmLabel="Excluir serviço" onCancel={() => setDeleting(null)} onConfirm={confirmRemove}/>}
    {editing && <Modal onClose={() => setEditing(null)}>
      <div className="modal-title"><div><span className="eyebrow">SERVIÇO</span><h3>{editing.id ? 'Editar serviço' : 'Novo serviço'}</h3></div><button className="icon-button" onClick={() => setEditing(null)}><X size={18}/></button></div>
      <div className="form-grid">
        <Field label="Nome do serviço" full><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></Field>
        <Field label="Categoria"><div className="select-with-action"><select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select><button type="button" onClick={() => setCategoryOpen(true)} title="Cadastrar categoria"><Plus size={16}/></button></div></Field>
        <Field label="Duração"><div className="masked-field"><input inputMode="numeric" value={`${editing.duration || ''} min`} onFocus={e => e.currentTarget.select()} onChange={e => setEditing({ ...editing, duration: Number(e.target.value.replace(/\D/g, '')) })}/></div></Field>
        <Field label="Preço"><input inputMode="numeric" value={money(editing.price)} onFocus={e => e.currentTarget.select()} onChange={e => { const cents = Number(e.target.value.replace(/\D/g, '')); setEditing({ ...editing, price: cents / 100 }) }}/></Field>
      </div>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" onClick={save}>Salvar serviço</Button></div>
    </Modal>}
    {categoryOpen && <Modal className="category-modal" layerClassName="category-layer" onClose={() => setCategoryOpen(false)}>
      <div className="modal-title"><div><span className="eyebrow">PADRONIZAÇÃO</span><h3>Categorias de serviço</h3></div><button className="icon-button" onClick={() => setCategoryOpen(false)}><X size={18}/></button></div>
      <p className="documents-intro">Cadastre uma vez e selecione nos serviços para evitar nomes duplicados.</p>
      <div className="new-category"><input value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCategory() }} placeholder="Ex.: Implantes"/><Button variant="primary" onClick={addCategory}><Plus size={16}/> Adicionar</Button></div>
      <div className="category-list">{categories.map(c => <div key={c}><span>{c}</span><b>{services.filter(s => s.category === c).length} serviço(s)</b><button disabled={services.some(s => s.category === c)} title={services.some(s => s.category === c) ? 'Categoria em uso' : 'Excluir'} onClick={() => setCategories(cs => cs.filter(x => x !== c))}><Trash2 size={14}/></button></div>)}</div>
    </Modal>}
  </div>
}
