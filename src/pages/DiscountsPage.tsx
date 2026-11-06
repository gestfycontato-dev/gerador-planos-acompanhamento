import { useState } from 'react'
import { CalendarDays, Sparkles } from 'lucide-react'
import { money } from '../data'
import type { Discount } from '../types'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'

export function DiscountsPage({ discounts, saveDiscounts }: { discounts: Discount[]; saveDiscounts: (discounts: Discount[]) => Promise<boolean> }) {
  const [draft, setDraft] = useState(discounts)
  const update = (duration: number, percent: number) => setDraft(ds => ds.map(d => d.duration === duration ? { ...d, percent: Math.max(0, Math.min(100, percent || 0)) } : d))
  const save = () => { void saveDiscounts(draft) }
  return <div className="page discounts-page">
    <PageHeader kicker="CADASTROS" title="Descontos por duração" subtitle="Defina descontos automáticos para cada duração de plano. Por padrão, todos começam zerados."/>
    <div className="discount-table card">
      <div className="discount-head"><span>DURAÇÃO DO PLANO</span><span>DESCONTO APLICADO</span><span>EXEMPLO EM R$ 10.000</span></div>
      {draft.map(d => <div className="discount-row" key={d.duration}><div><div className="duration-badge"><CalendarDays size={17}/></div><strong>{d.duration} semanas</strong></div><label><input inputMode="numeric" value={`${d.percent}%`} onFocus={e => e.currentTarget.select()} onChange={e => update(d.duration, Number(e.target.value.replace(/\D/g, '')))}/></label><strong>{money(10000 * (1 - d.percent / 100))}</strong></div>)}
    </div>
    <div className="discount-note"><Sparkles size={18}/><div><strong>Aplicação automática</strong><span>Ao escolher uma duração no construtor, o desconto correspondente será aplicado ao investimento final e aos documentos do plano.</span></div></div>
    <div className="settings-save"><Button variant="primary" onClick={save}>Salvar descontos</Button></div>
  </div>
}
