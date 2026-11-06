import { useState } from 'react'
import { X } from 'lucide-react'
import { copyTextWithFallback } from '../lib/recordSummary'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

export function RecordSummaryModal({ text, onClose, notify }: { text: string; onClose: () => void; notify: (s: string) => void }) {
  const [value, setValue] = useState(text)

  const copy = async () => {
    try { await copyTextWithFallback(value); notify('Texto copiado para a área de transferência') }
    catch { notify('Não foi possível copiar o texto') }
  }

  return <Modal className="record-summary-modal" onClose={onClose}>
    <div className="modal-title"><div><span className="eyebrow">PRONTUÁRIO</span><h3>Revisar antes de copiar</h3></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <p className="documents-intro">Ajuste o texto como quiser — nada é copiado até você confirmar abaixo.</p>
    <textarea className="record-summary-textarea" value={value} onChange={e => setValue(e.target.value)} rows={18} autoFocus/>
    <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={copy}>Copiar para a área de transferência</Button></div>
  </Modal>
}
