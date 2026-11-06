import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Handshake, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { cloneSalesScriptForClinic, getClinicSalesScript, resetSalesScriptToDefault, updateSalesScript } from '../repository'
import { consultationPhases } from '../lib/constants'
import { errorMessage } from '../lib/format'
import { itemTypeLabels, phaseNames } from '../lib/salesScriptLabels'
import type { SalesScript, SalesScriptItemInput, SalesScriptItemType, SalesScriptPhase } from '../types'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'

type ItemDraft = SalesScriptItemInput & { key: string }
const toDrafts = (script: SalesScript): ItemDraft[] => script.items.map(item => ({ ...item, key: item.id }))

export function SalesScriptSettingsPage({ clinicId, notify }: { clinicId: string; notify: (s: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [script, setScript] = useState<SalesScript | null>(null)
  const [items, setItems] = useState<ItemDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [personalizing, setPersonalizing] = useState(false)
  const [resetting, setResetting] = useState(false)

  const load = () => {
    setLoading(true)
    getClinicSalesScript(clinicId).then(loaded => { setScript(loaded); setItems(loaded ? toDrafts(loaded) : []) }).catch(error => notify(errorMessage(error))).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [clinicId])

  const personalize = async () => {
    setPersonalizing(true)
    try { const created = await cloneSalesScriptForClinic(clinicId); setScript(created); setItems(toDrafts(created)); notify('Roteiro copiado — agora você pode personalizar') }
    catch (error) { notify(errorMessage(error)) } finally { setPersonalizing(false) }
  }

  const confirmReset = async () => {
    if (!script) return
    const id = script.id; setResetting(false)
    try { await resetSalesScriptToDefault(id); notify('Roteiro restaurado ao padrão da plataforma'); load() }
    catch (error) { notify(errorMessage(error)) }
  }

  const updatePhaseMeta = (phase: SalesScriptPhase, patch: Partial<Pick<ItemDraft, 'phaseLabel' | 'sectionLabel' | 'timeHint'>>) =>
    setItems(current => current.map(item => item.phase === phase ? { ...item, ...patch } : item))
  const updateItem = (key: string, patch: Partial<ItemDraft>) => setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item))
  const removeItem = (key: string) => setItems(current => current.filter(item => item.key !== key).map((item, i) => ({ ...item, sortOrder: i })))
  const addItem = (phase: SalesScriptPhase) => setItems(current => {
    const group = current.filter(item => item.phase === phase)
    const template = group[0]
    const draft: ItemDraft = { key: crypto.randomUUID(), phase, phaseLabel: template?.phaseLabel ?? phaseNames[phase], sectionLabel: template?.sectionLabel, timeHint: template?.timeHint, itemType: 'check', label: '', sortOrder: 0 }
    const lastIndex = current.map(item => item.phase).lastIndexOf(phase)
    const insertAt = lastIndex === -1 ? current.length : lastIndex + 1
    const next = [...current.slice(0, insertAt), draft, ...current.slice(insertAt)]
    return next.map((item, i) => ({ ...item, sortOrder: i }))
  })
  const moveItem = (key: string, dir: -1 | 1) => setItems(current => {
    const index = current.findIndex(item => item.key === key)
    const target = index + dir
    if (index === -1 || target < 0 || target >= current.length || current[target].phase !== current[index].phase) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next.map((item, i) => ({ ...item, sortOrder: i }))
  })

  const save = async () => {
    if (!script) return
    const clean = items.map(item => ({ ...item, label: item.label.trim() })).filter(item => item.label)
    if (!clean.length) { notify('O roteiro precisa ter pelo menos um item'); return }
    setSaving(true)
    try { const updated = await updateSalesScript(script.id, { name: script.name, items: clean }); setScript(updated); setItems(toDrafts(updated)); notify('Roteiro salvo') }
    catch (error) { notify(errorMessage(error)) } finally { setSaving(false) }
  }

  if (loading) return <div className="page"><PageHeader kicker="CADASTROS" title="Assistente de vendas" subtitle="Personalize o roteiro usado na consulta consultiva (SPIN)."/><p className="documents-intro">Carregando roteiro...</p></div>

  if (!script) return <div className="page">
    <PageHeader kicker="CADASTROS" title="Assistente de vendas" subtitle="Personalize o roteiro usado na consulta consultiva (SPIN)."/>
    <EmptyState>
      <strong>Sua clínica ainda usa o roteiro padrão da plataforma.</strong>
      <p>O roteiro guia o médico fase a fase durante a consulta: recepção, investigação (situação, problema, implicação, necessidade), apresentação do plano e encaminhamento. Copie o padrão e ajuste os textos e itens do jeito que sua clínica atende — as fases continuam as mesmas.</p>
      <Button variant="primary" disabled={personalizing} onClick={personalize}>{personalizing ? 'Copiando...' : 'Personalizar roteiro para minha clínica'}</Button>
    </EmptyState>
  </div>

  return <div className="page sales-script-page">
    <PageHeader kicker="CADASTROS" title="Assistente de vendas" subtitle="Personalize o roteiro usado na consulta consultiva (SPIN) da sua clínica." action={<Button variant="ghost" onClick={() => setResetting(true)}><RotateCcw size={16}/> Restaurar padrão da plataforma</Button>}/>
    {consultationPhases.map((phase, phaseIndex) => {
      const group = items.filter(item => item.phase === phase)
      const meta = group[0]
      return <section className="settings-card card" key={phase}>
        <div className="settings-title"><div className="settings-icon"><Handshake size={20}/></div><div><h3>Fase {phaseIndex + 1} — {phaseNames[phase]}</h3><p>{group.length} item{group.length === 1 ? '' : 's'}</p></div></div>
        <div className="form-grid">
          <Field label="Rótulo da fase" full><input value={meta?.phaseLabel ?? ''} onChange={e => updatePhaseMeta(phase, { phaseLabel: e.target.value })}/></Field>
          <Field label="Seção (opcional)"><input value={meta?.sectionLabel ?? ''} onChange={e => updatePhaseMeta(phase, { sectionLabel: e.target.value })}/></Field>
          <Field label="Tempo estimado (opcional)"><input placeholder="Ex.: 5–20 min" value={meta?.timeHint ?? ''} onChange={e => updatePhaseMeta(phase, { timeHint: e.target.value })}/></Field>
        </div>
        <div className="goal-items-head"><span>ITENS</span><Button variant="soft" onClick={() => addItem(phase)}><Plus size={15}/> Adicionar item</Button></div>
        <div className="goal-items-list">
          {group.map((item, i) => <div className="goal-item-card" key={item.key}>
            <div className="goal-item-head">
              <div className="goal-item-order"><button disabled={i === 0} onClick={() => moveItem(item.key, -1)}><ChevronUp size={15}/></button><span>{i + 1}</span><button disabled={i === group.length - 1} onClick={() => moveItem(item.key, 1)}><ChevronDown size={15}/></button></div>
              <button className="icon-button danger" title="Remover item" onClick={() => removeItem(item.key)}><Trash2 size={14}/></button>
            </div>
            <div className="form-grid">
              <Field label="Tipo"><select value={item.itemType} onChange={e => updateItem(item.key, { itemType: e.target.value as SalesScriptItemType })}>{Object.entries(itemTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Texto" full><textarea rows={2} value={item.label} onChange={e => updateItem(item.key, { label: e.target.value })} placeholder="O que o médico deve fazer, perguntar ou dizer nesta etapa"/></Field>
            </div>
          </div>)}
          {!group.length && <EmptyState>Nenhum item nesta fase ainda.</EmptyState>}
        </div>
      </section>
    })}
    <div className="settings-save"><Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar roteiro'}</Button></div>
    {resetting && <ConfirmDialog title="Restaurar padrão da plataforma" message="Isso apaga todas as suas personalizações e volta a usar o roteiro padrão da plataforma. Essa ação não pode ser desfeita." confirmLabel="Restaurar padrão" onCancel={() => setResetting(false)} onConfirm={confirmReset}/>}
  </div>
}
