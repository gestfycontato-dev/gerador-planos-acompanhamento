import { useState } from 'react'
import { CreditCard, Plus, Trash2 } from 'lucide-react'
import type { PaymentMethod } from '../types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

export function PaymentMethodsPage({ paymentMethods, addPaymentMethod, removePaymentMethod }: { paymentMethods: PaymentMethod[]; addPaymentMethod: (label: string) => Promise<void>; removePaymentMethod: (id: string) => Promise<void> }) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async () => {
    const clean = label.trim()
    if (!clean) return
    setSaving(true)
    try { await addPaymentMethod(clean); setLabel('') } finally { setSaving(false) }
  }

  return <div className="page">
    <PageHeader kicker="CADASTROS" title="Formas de pagamento" subtitle="Cadastre os modelos padrão de pagamento para que os contratos e documentos saiam sempre com a mesma redação."/>
    <div className="card">
      <div className="new-category">
        <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add() }} placeholder="Ex.: Crédito em 12x, Pix à vista, Boleto em 3x"/>
        <Button variant="primary" disabled={saving} onClick={add}><Plus size={16}/> Adicionar</Button>
      </div>
      {!paymentMethods.length && <EmptyState>
        <strong>Nenhuma forma de pagamento cadastrada ainda.</strong>
        <p>Ao gerar contratos e documentos do plano, você poderá escolher entre os modelos cadastrados aqui, sem precisar redigitar a cada paciente.</p>
      </EmptyState>}
      {!!paymentMethods.length && <div className="category-list">{paymentMethods.map(m => <div key={m.id}><span><CreditCard size={15}/> {m.label}</span><button title="Excluir" onClick={() => removePaymentMethod(m.id)}><Trash2 size={14}/></button></div>)}</div>}
    </div>
  </div>
}
