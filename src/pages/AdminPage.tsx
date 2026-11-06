import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, KeyRound, Mail, Search, UserPlus, Users, Wallet, X } from 'lucide-react'
import { adminConfirmUser, adminCreateUser, adminSetUserPassword, getAdminUsersWithoutClinic, getAdminClinicDetail, getAdminClinicMembers, getClinicBillingHistory, listAdminClinics, saveClinicBilling } from '../repository'
import { auth } from '../supabase'
import { errorMessage } from '../lib/format'
import { isStrongPassword } from '../lib/password'
import type { AdminClinicDetail, AdminClinicOverview, AdminMemberContact, BillingStatus, ClinicBillingHistoryEntry } from '../types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { PasswordField } from '../components/ui/PasswordField'

const statusLabels: Record<BillingStatus, string> = { trial: 'Trial', adimplente: 'Adimplente', inadimplente: 'Inadimplente', cancelada: 'Cancelada' }
const statusOptions: BillingStatus[] = ['trial', 'adimplente', 'inadimplente', 'cancelada']
const PAGE_SIZE = 20
const CHURN_DAYS = 30

const daysAgo = (iso?: string) => iso ? differenceInCalendarDays(new Date(), parseISO(iso)) : undefined
const isChurnRisk = (row: AdminClinicOverview) => { const d = daysAgo(row.lastSeenAt); return d === undefined || d > CHURN_DAYS }
const toDateInput = (iso?: string) => iso ? iso.slice(0, 10) : ''

const emailErrorMessage = (error: unknown) => {
  const message = errorMessage(error)
  const wait = message.match(/after (\d+) seconds?/i)
  if (wait) return `Aguarde ${wait[1]} segundos antes de pedir outro envio para este e-mail.`
  if (/rate limit/i.test(message)) return 'Limite de envio de e-mails do Supabase atingido. Tente novamente mais tarde.'
  return message
}

export function AdminPage({ notify }: { notify: (s: string) => void }) {
  const [clinics, setClinics] = useState<AdminClinicOverview[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | BillingStatus>('Todos')
  const [sortBy, setSortBy] = useState<'lastSeen' | 'dueDate'>('lastSeen')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AdminClinicOverview | null>(null)
  const [creating, setCreating] = useState(false)
  const [orphans, setOrphans] = useState<AdminMemberContact[] | null>(null)
  const [orphanPasswordFor, setOrphanPasswordFor] = useState<AdminMemberContact | null>(null)

  const loadOrphans = () => { getAdminUsersWithoutClinic().then(setOrphans).catch(() => setOrphans(null)) }
  const load = () => { listAdminClinics().then(rows => { setClinics(rows); setLoadError('') }).catch(error => setLoadError(errorMessage(error))); loadOrphans() }
  useEffect(load, [])

  const cards = useMemo(() => {
    if (!clinics) return null
    const now = new Date()
    return {
      total: clinics.length,
      activos30: clinics.filter(c => { const d = daysAgo(c.lastSeenAt); return d !== undefined && d <= 30 }).length,
      inadimplentes: clinics.filter(c => c.billingStatus === 'inadimplente').length,
      criadasNoMes: clinics.filter(c => { const d = parseISO(c.createdAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() }).length,
    }
  }, [clinics])

  const filtered = useMemo(() => {
    if (!clinics) return []
    let rows = clinics.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    if (statusFilter !== 'Todos') rows = rows.filter(c => c.billingStatus === statusFilter)
    rows = [...rows].sort((a, b) => {
      if (sortBy === 'lastSeen') return (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '')
      return (a.nextDueAt ?? '9999').localeCompare(b.nextDueAt ?? '9999')
    })
    return rows
  }, [clinics, query, statusFilter, sortBy])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  useEffect(() => { setPage(0) }, [query, statusFilter, sortBy])

  if (loadError) return <div className="page"><PageHeader kicker="ADMINISTRAÇÃO" title="Painel da plataforma" subtitle="Acompanhamento de clínicas."/><EmptyState>Não foi possível carregar o painel: {loadError}</EmptyState></div>

  return <div className="page wide admin-page">
    <PageHeader kicker="ADMINISTRAÇÃO" title="Painel da plataforma" subtitle="Metadados e cobrança das clínicas — nenhum dado clínico passa por aqui." action={<Button variant="primary" onClick={() => setCreating(true)}><UserPlus size={17}/> Novo usuário</Button>}/>
    {cards && <div className="admin-cards">
      <div className="admin-card"><div className="admin-card-icon"><Building2 size={18}/></div><span>Total de clínicas</span><strong>{cards.total}</strong></div>
      <div className="admin-card"><div className="admin-card-icon good"><Users size={18}/></div><span>Ativas nos últimos 30 dias</span><strong>{cards.activos30}</strong></div>
      <div className="admin-card"><div className="admin-card-icon bad"><Wallet size={18}/></div><span>Inadimplentes</span><strong>{cards.inadimplentes}</strong></div>
      <div className="admin-card"><div className="admin-card-icon"><CalendarClock size={18}/></div><span>Criadas no mês</span><strong>{cards.criadasNoMes}</strong></div>
    </div>}
    <div className="toolbar">
      <div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar clínica pelo nome..."/></div>
      <div className="admin-toolbar-actions">
        <select className="toolbar-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="Todos">Todos os status</option>
          {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
        <select className="toolbar-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
          <option value="lastSeen">Ordenar por último acesso</option>
          <option value="dueDate">Ordenar por vencimento</option>
        </select>
      </div>
    </div>
    <div className="table-card admin-table">
      <table>
        <thead><tr><th>Clínica</th><th>Status</th><th>Próximo vencimento</th><th>Último acesso</th><th>Membros</th><th>Pacientes</th><th>Planos</th><th>Vendas</th><th>Criada em</th></tr></thead>
        <tbody>
          {pageRows.map(row => {
            const churn = isChurnRisk(row)
            const overdue = row.billingStatus === 'inadimplente'
            const seenDays = daysAgo(row.lastSeenAt)
            return <tr key={row.id} className={overdue ? 'admin-row-danger' : churn ? 'admin-row-warning' : ''} onClick={() => setSelected(row)}>
              <td><div className="table-main"><div className="file-icon"><Building2 size={16}/></div><strong>{row.name || 'Sem nome'}</strong>{(churn || overdue) && <AlertTriangle size={14} className={overdue ? 'admin-flag-danger' : 'admin-flag-warning'}/>}</div></td>
              <td><span className={`status admin-status-${row.billingStatus ?? 'sem-status'}`}>{row.billingStatus ? statusLabels[row.billingStatus] : 'Sem status'}</span></td>
              <td className="muted">{row.nextDueAt ? format(parseISO(row.nextDueAt), 'dd/MM/yyyy') : '—'}</td>
              <td>{row.lastSeenAt ? <><strong>{format(parseISO(row.lastSeenAt), 'dd/MM/yyyy')}</strong><span className="admin-days-ago"> · há {seenDays} dia{seenDays === 1 ? '' : 's'}</span></> : <span className="muted">Nunca acessou</span>}</td>
              <td>{row.members}</td>
              <td>{row.patients}</td>
              <td>{row.plans}</td>
              <td>{row.sales}</td>
              <td className="muted">{format(parseISO(row.createdAt), 'dd/MM/yyyy')}</td>
            </tr>
          })}
          {!pageRows.length && <tr><td colSpan={9}><EmptyState tone="panel">{clinics && !clinics.length ? 'Nenhuma clínica cadastrada ainda.' : 'Nenhuma clínica encontrada com esse filtro.'}</EmptyState></td></tr>}
        </tbody>
      </table>
    </div>
    {filtered.length > PAGE_SIZE && <div className="admin-pagination">
      <button disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16}/></button>
      <span>Página {page + 1} de {pageCount}</span>
      <button disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={16}/></button>
    </div>}
    {!!orphans?.length && <section className="card admin-orphans">
      <div className="admin-orphans-head"><div><h3>Cadastros sem clínica ({orphans.length})</h3><p>Pessoas que criaram conta pela tela de login mas nunca entraram — a clínica só é criada no primeiro acesso, depois da ativação do e-mail.</p></div></div>
      <div className="admin-orphans-list">{orphans.map(m => <MemberRow key={m.userId} member={m} notify={notify} onChanged={loadOrphans} onSetPassword={() => setOrphanPasswordFor(m)}/>)}</div>
    </section>}
    {orphanPasswordFor && <SetPasswordModal member={orphanPasswordFor} onClose={() => setOrphanPasswordFor(null)} notify={notify}/>}
    {selected && <ClinicSidePanel row={selected} clinics={clinics ?? []} onClose={() => setSelected(null)} notify={notify} onBillingSaved={load} onMembersChanged={load}/>}
    {creating && <CreateUserModal clinics={clinics ?? []} onClose={() => setCreating(false)} notify={notify} onCreated={() => { setCreating(false); load() }}/>}
  </div>
}

function CreateUserModal({ clinics, presetClinic, onClose, onCreated, notify }: { clinics: AdminClinicOverview[]; presetClinic?: AdminClinicOverview; onClose: () => void; onCreated: () => void; notify: (s: string) => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [target, setTarget] = useState<'new' | 'existing'>(presetClinic ? 'existing' : 'new')
  const [newClinicName, setNewClinicName] = useState('')
  const [clinicId, setClinicId] = useState(presetClinic?.id ?? '')
  const [confirmNow, setConfirmNow] = useState(true)
  const [saving, setSaving] = useState(false)
  const sortedClinics = useMemo(() => [...clinics].sort((a, b) => (a.name || 'Sem nome').localeCompare(b.name || 'Sem nome', 'pt-BR')), [clinics])

  const submit = async () => {
    if (!fullName.trim()) { notify('Informe o nome do usuário'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { notify('Informe um e-mail válido'); return }
    if (!isStrongPassword(password)) { notify('A senha não atende a todas as regras'); return }
    if (target === 'new' && !newClinicName.trim()) { notify('Informe o nome da nova clínica'); return }
    if (target === 'existing' && !clinicId) { notify('Selecione a clínica'); return }
    setSaving(true)
    try {
      await adminCreateUser({ email: email.trim(), password, fullName: fullName.trim(), confirmNow, clinicId: target === 'existing' ? clinicId : undefined, newClinicName: target === 'new' ? newClinicName.trim() : undefined })
      if (confirmNow) notify('Usuário criado e já ativado — pode entrar com o e-mail e a senha definidos')
      else {
        try { await auth.resendActivationEmail(email.trim()); notify('Usuário criado. E-mail de ativação enviado') }
        catch (error) { notify(`Usuário criado, mas o e-mail de ativação não foi enviado: ${emailErrorMessage(error)}`) }
      }
      onCreated()
    } catch (error) { notify(errorMessage(error)) } finally { setSaving(false) }
  }

  return <Modal className="admin-user-modal" layerClassName="admin-modal-layer" onClose={onClose}>
    <div className="modal-title"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h3>{presetClinic ? `Novo usuário em ${presetClinic.name || 'Sem nome'}` : 'Novo usuário'}</h3></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <div className="admin-user-form">
      <Field label="Nome do médico / usuário"><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex.: Dr. Jorge Clamed" autoFocus/></Field>
      <Field label="E-mail de acesso"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@exemplo.com" autoComplete="off"/></Field>
      <PasswordField label="Senha inicial" value={password} onChange={setPassword} showRules autoComplete="new-password"/>
      {!presetClinic && <div className="admin-user-target">
        <span className="admin-panel-label">Vincular a</span>
        <div className="choice-row"><button type="button" className={target === 'new' ? 'active' : ''} onClick={() => setTarget('new')}>Nova clínica</button><button type="button" className={target === 'existing' ? 'active' : ''} onClick={() => setTarget('existing')}>Clínica existente</button></div>
        {target === 'new' && <Field label="Nome da nova clínica"><input value={newClinicName} onChange={e => setNewClinicName(e.target.value)} placeholder="Ex.: Clínica Claros"/></Field>}
        {target === 'existing' && <Field label="Clínica"><select value={clinicId} onChange={e => setClinicId(e.target.value)}><option value="" disabled>Selecione a clínica</option>{sortedClinics.map(c => <option key={c.id} value={c.id}>{c.name || 'Sem nome'}</option>)}</select></Field>}
      </div>}
      <label className="admin-check"><input type="checkbox" checked={confirmNow} onChange={e => setConfirmNow(e.target.checked)}/><span><strong>Ativar agora, sem confirmação por e-mail</strong><small>{confirmNow ? 'O usuário já consegue entrar com o e-mail e a senha acima.' : 'Será enviado um e-mail de ativação; o acesso só libera depois que ele confirmar.'}</small></span></label>
    </div>
    <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Criando...' : 'Criar usuário'}</Button></div>
  </Modal>
}

function SetPasswordModal({ member, onClose, notify }: { member: AdminMemberContact; onClose: () => void; notify: (s: string) => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!isStrongPassword(password)) { notify('A senha não atende a todas as regras'); return }
    setSaving(true)
    try { await adminSetUserPassword(member.userId, password); notify(`Nova senha definida para ${member.email}`); onClose() }
    catch (error) { notify(errorMessage(error)) } finally { setSaving(false) }
  }
  return <Modal className="admin-user-modal" layerClassName="admin-modal-layer" onClose={onClose}>
    <div className="modal-title"><div><span className="eyebrow">ACESSO</span><h3>Definir nova senha</h3></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <p className="documents-intro">Para {member.fullName || member.email}. A senha atual deixa de funcionar imediatamente — repasse a nova ao usuário.</p>
    <div className="admin-user-form"><PasswordField label="Nova senha" value={password} onChange={setPassword} showRules autoComplete="new-password"/></div>
    <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Salvando...' : 'Definir senha'}</Button></div>
  </Modal>
}

function MemberRow({ member, notify, onChanged, onSetPassword }: { member: AdminMemberContact; notify: (s: string) => void; onChanged: () => void; onSetPassword: () => void }) {
  const [busy, setBusy] = useState<'confirm' | 'resend' | 'reset' | null>(null)
  const active = !!member.emailConfirmedAt
  const run = async (kind: 'confirm' | 'resend' | 'reset') => {
    setBusy(kind)
    try {
      if (kind === 'confirm') { await adminConfirmUser(member.userId); notify(`${member.email} ativado`); onChanged() }
      if (kind === 'resend') { await auth.resendActivationEmail(member.email); notify(`E-mail de ativação reenviado para ${member.email}`) }
      if (kind === 'reset') { await auth.requestPasswordReset(member.email, `${window.location.origin}/`); notify(`E-mail de redefinição de senha enviado para ${member.email}`) }
    } catch (error) { notify(kind === 'confirm' ? errorMessage(error) : emailErrorMessage(error)) } finally { setBusy(null) }
  }
  return <div className="admin-member-row">
    <div className="admin-member-head"><strong>{member.fullName || 'Sem nome'}</strong><span className={`admin-member-status ${active ? 'active' : 'pending'}`}>{active ? 'Ativo' : 'Aguardando ativação'}</span></div>
    <span>{member.email}</span>
    {member.crm && <span className="muted">{member.crm}</span>}
    <span className="muted">{member.createdAt ? `Cadastrado em ${format(parseISO(member.createdAt), 'dd/MM/yyyy HH:mm')} · ` : ''}{member.lastSignInAt ? `Último login: ${format(parseISO(member.lastSignInAt), 'dd/MM/yyyy HH:mm')}` : 'Nunca fez login'}</span>
    <div className="admin-member-actions">
      {!active && <button disabled={!!busy} onClick={() => run('confirm')}><CheckCircle2 size={13}/> {busy === 'confirm' ? 'Ativando...' : 'Ativar agora'}</button>}
      {!active && <button disabled={!!busy} onClick={() => run('resend')}><Mail size={13}/> {busy === 'resend' ? 'Enviando...' : 'Reenviar e-mail de ativação'}</button>}
      <button disabled={!!busy} onClick={() => run('reset')}><Mail size={13}/> {busy === 'reset' ? 'Enviando...' : 'Enviar redefinição de senha'}</button>
      <button disabled={!!busy} onClick={onSetPassword}><KeyRound size={13}/> Definir nova senha</button>
    </div>
  </div>
}

function ClinicSidePanel({ row, clinics, onClose, notify, onBillingSaved, onMembersChanged }: { row: AdminClinicOverview; clinics: AdminClinicOverview[]; onClose: () => void; notify: (s: string) => void; onBillingSaved: () => void; onMembersChanged: () => void }) {
  const [detail, setDetail] = useState<AdminClinicDetail | null>(null)
  const [members, setMembers] = useState<AdminMemberContact[] | null>(null)
  const [addingMember, setAddingMember] = useState(false)
  const [passwordFor, setPasswordFor] = useState<AdminMemberContact | null>(null)
  const reloadMembers = () => { getAdminClinicMembers(row.id).then(setMembers).catch(error => notify(errorMessage(error))) }
  const [history, setHistory] = useState<ClinicBillingHistoryEntry[] | null>(null)
  const [status, setStatus] = useState<BillingStatus>(row.billingStatus ?? 'trial')
  const [planLabel, setPlanLabel] = useState(row.planLabel ?? '')
  const [dueDay, setDueDay] = useState('')
  const [lastPaymentAt, setLastPaymentAt] = useState(toDateInput(row.lastPaymentAt))
  const [nextDueAt, setNextDueAt] = useState(toDateInput(row.nextDueAt))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAdminClinicDetail(row.id).then(d => !cancelled && setDetail(d)).catch(error => notify(errorMessage(error)))
    getAdminClinicMembers(row.id).then(rows => !cancelled && setMembers(rows)).catch(error => notify(errorMessage(error)))
    getClinicBillingHistory(row.id).then(rows => { if (cancelled) return; setHistory(rows); const latestNotes = rows[0]?.notes; if (latestNotes) setNotes(latestNotes) }).catch(error => notify(errorMessage(error)))
    return () => { cancelled = true }
  }, [row.id])

  const save = async () => {
    setSaving(true)
    try {
      await saveClinicBilling(row.id, { status, planLabel: planLabel.trim() || undefined, dueDay: dueDay ? Number(dueDay) : undefined, lastPaymentAt: lastPaymentAt || undefined, nextDueAt: nextDueAt || undefined, notes: notes.trim() || undefined })
      notify('Status de cobrança atualizado')
      onBillingSaved()
      const rows = await getClinicBillingHistory(row.id)
      setHistory(rows)
    } catch (error) { notify(errorMessage(error)) } finally { setSaving(false) }
  }

  return <div className="admin-panel-layer" onMouseDown={onClose}>
    <aside className="admin-panel" onMouseDown={e => e.stopPropagation()}>
      <div className="admin-panel-head"><div><span className="eyebrow">CLÍNICA</span><h3>{row.name || 'Sem nome'}</h3></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>

      <section className="admin-panel-section">
        <label className="admin-panel-label">Dados cadastrais</label>
        {!detail && <p className="documents-intro">Carregando...</p>}
        {detail && <div className="admin-detail-grid">
          <div><span>Razão social</span><strong>{detail.legalName || '—'}</strong></div>
          <div><span>CNPJ</span><strong>{detail.cnpj || '—'}</strong></div>
          <div><span>Telefone</span><strong>{detail.phone || '—'}</strong></div>
          <div><span>E-mail</span><strong>{detail.email || '—'}</strong></div>
          <div className="full"><span>Endereço</span><strong>{detail.address ? `${detail.address}${detail.city ? `, ${detail.city}/${detail.state}` : ''}${detail.zipCode ? ` · CEP ${detail.zipCode}` : ''}` : '—'}</strong></div>
        </div>}
      </section>

      <section className="admin-panel-section">
        <div className="admin-section-head"><label className="admin-panel-label">Usuários da clínica</label><Button variant="soft" onClick={() => setAddingMember(true)}><UserPlus size={14}/> Adicionar usuário</Button></div>
        {members === null && <p className="documents-intro">Carregando...</p>}
        {members !== null && !members.length && <EmptyState tone="panel">Nenhum membro encontrado.</EmptyState>}
        <div className="admin-members-list">{members?.map(m => <MemberRow key={m.userId} member={m} notify={notify} onChanged={reloadMembers} onSetPassword={() => setPasswordFor(m)}/>)}</div>
      </section>
      {addingMember && <CreateUserModal clinics={clinics} presetClinic={row} onClose={() => setAddingMember(false)} notify={notify} onCreated={() => { setAddingMember(false); reloadMembers(); onMembersChanged() }}/>}
      {passwordFor && <SetPasswordModal member={passwordFor} onClose={() => setPasswordFor(null)} notify={notify}/>}

      <section className="admin-panel-section">
        <label className="admin-panel-label">Status de cobrança</label>
        <div className="admin-billing-form">
          <Field label="Status"><select value={status} onChange={e => setStatus(e.target.value as BillingStatus)}>{statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></Field>
          <Field label="Plano contratado"><input value={planLabel} onChange={e => setPlanLabel(e.target.value)} placeholder="Ex.: Plano Pro mensal"/></Field>
          <div className="admin-billing-row">
            <Field label="Dia de vencimento"><input type="number" min={1} max={31} value={dueDay} onChange={e => setDueDay(e.target.value)}/></Field>
            <Field label="Próximo vencimento"><input type="date" value={nextDueAt} onChange={e => setNextDueAt(e.target.value)}/></Field>
          </div>
          <Field label="Último pagamento"><input type="date" value={lastPaymentAt} onChange={e => setLastPaymentAt(e.target.value)}/></Field>
          <Field label="Observações"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Qualquer anotação sobre a cobrança desta clínica..."/></Field>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar status de cobrança'}</Button>
        </div>
      </section>

      <section className="admin-panel-section">
        <label className="admin-panel-label">Histórico de cobrança</label>
        {history === null && <p className="documents-intro">Carregando...</p>}
        {history !== null && !history.length && <EmptyState tone="panel">Nenhuma alteração registrada ainda.</EmptyState>}
        <div className="admin-history-list">
          {history?.map(entry => <div className="admin-history-row" key={entry.id}>
            <div><strong>{entry.oldStatus ? `${statusLabels[entry.oldStatus]} → ${statusLabels[entry.newStatus]}` : `Definido como ${statusLabels[entry.newStatus]}`}</strong><span className="muted">{format(parseISO(entry.changedAt), 'dd/MM/yyyy HH:mm')}{entry.changedByEmail ? ` · ${entry.changedByEmail}` : ''}</span></div>
            {entry.notes && <p>{entry.notes}</p>}
          </div>)}
        </div>
      </section>
    </aside>
  </div>
}
