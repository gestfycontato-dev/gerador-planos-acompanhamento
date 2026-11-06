import { useState } from 'react'
import { Handshake, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { errorMessage } from '../lib/format'
import { getPatientDeletionSummary } from '../repository'
import type { PatientDeletionSummary } from '../repository'
import type { Patient } from '../types'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

export function PatientsPage({ patients, savePatient, removePatient, archivePatient, notify, openConsultation }: { patients: Patient[]; savePatient: (patient: Patient) => Promise<boolean>; removePatient: (id: string) => Promise<void>; archivePatient: (id: string) => Promise<void>; notify: (s: string) => void; openConsultation: (patientId: string) => void }) {
  const empty: Patient = { id: '', name: '', initials: '', gender: 'Prefere não informar' }
  const [editing, setEditing] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState<Patient | null>(null)
  const [deleteSummary, setDeleteSummary] = useState<PatientDeletionSummary | null>(null)
  const [query, setQuery] = useState('')
  const [gender, setGender] = useState('Todos')
  const visible = patients.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) && (gender === 'Todos' || p.gender === gender))
  const save = async () => { if (!editing?.name.trim()) { notify('Informe o nome do paciente'); return } const initials = editing.name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase(); const next = { ...editing, initials, id: editing.id || crypto.randomUUID() }; if (await savePatient(next)) setEditing(null) }
  const startDelete = async (patient: Patient) => {
    setDeleting(patient)
    try { setDeleteSummary(await getPatientDeletionSummary(patient.id)) }
    catch (error) { notify(errorMessage(error)); setDeleting(null) }
  }
  const cancelDelete = () => { setDeleting(null); setDeleteSummary(null) }
  const confirmRemove = () => { if (!deleting) return; const id = deleting.id; cancelDelete(); void removePatient(id) }
  const confirmArchive = () => { if (!deleting) return; const id = deleting.id; cancelDelete(); void archivePatient(id) }
  const linkedCount = deleteSummary ? deleteSummary.plans + deleteSummary.consultations + deleteSummary.goals : 0
  const deleteMessage = !deleteSummary ? 'Verificando planos e consultas vinculados...'
    : linkedCount === 0 ? `Tem certeza que deseja excluir ${deleting?.name}? Essa ação não pode ser desfeita.`
    : `Excluir ${deleting?.name} também apaga ${deleteSummary.plans} plano(s), ${deleteSummary.consultations} consulta(s) e ${deleteSummary.goals} objetivo(s) vinculados. Essa ação não pode ser desfeita.`
  return <div className="page">
    <PageHeader kicker="CADASTROS" title="Pacientes" subtitle={`${patients.length} pacientes cadastrados para criação de planos.`} action={<Button variant="primary" onClick={() => setEditing({ ...empty })}><Plus size={17}/> Novo paciente</Button>}/>
    <div className="toolbar">
      <div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar paciente pelo nome..."/></div>
      <select className="toolbar-select" value={gender} onChange={e => setGender(e.target.value)}><option>Todos</option><option>Feminino</option><option>Masculino</option><option>Outro</option><option>Prefere não informar</option></select>
    </div>
    <div className="cards-list">
      {visible.map(p => <div className="person-card card" key={p.id}><div className="avatar big pale">{p.initials}</div><div className="grow"><strong>{p.name}</strong><span>{p.gender}</span></div><div className="row-actions"><button className="icon-button" title="Assistente de vendas" onClick={() => openConsultation(p.id)}><Handshake size={16}/></button><button className="icon-button" title="Editar" onClick={() => setEditing({ ...p })}><Pencil size={16}/></button><button className="icon-button danger" title="Excluir" onClick={() => startDelete(p)}><Trash2 size={16}/></button></div></div>)}
      {!visible.length && <EmptyState>Nenhum paciente encontrado.</EmptyState>}
    </div>
    {editing && <Modal onClose={() => setEditing(null)}>
      <div className="modal-title"><div><span className="eyebrow">PACIENTE</span><h3>{editing.id ? 'Editar cadastro' : 'Novo paciente'}</h3></div><button className="icon-button" onClick={() => setEditing(null)}><X size={18}/></button></div>
      <div className="form-grid">
        <Field label="Nome completo" full><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></Field>
        <Field label="Gênero" full><select value={editing.gender} onChange={e => setEditing({ ...editing, gender: e.target.value as Patient['gender'] })}><option>Feminino</option><option>Masculino</option><option>Outro</option><option>Prefere não informar</option></select></Field>
      </div>
      <div className="patient-privacy-note">Os demais dados pessoais serão preenchidos pela recepção diretamente no contrato, evitando duplicidade com o sistema clínico.</div>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" onClick={save}>Salvar paciente</Button></div>
    </Modal>}
    {deleting && deleteSummary?.hasSale && <ConfirmDialog title="Paciente com plano vendido" message={`${deleting.name} tem plano vendido — isso é um registro financeiro e não pode ser apagado. Em vez de excluir, arquive o paciente: ele sai das listas do dia a dia, mas o histórico é preservado.`} confirmLabel="Arquivar paciente" onCancel={cancelDelete} onConfirm={confirmArchive}/>}
    {deleting && !deleteSummary?.hasSale && <ConfirmDialog title="Excluir paciente" message={deleteMessage} confirmLabel="Excluir paciente" onCancel={cancelDelete} onConfirm={confirmRemove}/>}
  </div>
}
