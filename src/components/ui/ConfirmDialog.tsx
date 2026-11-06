import { useEffect, useRef } from 'react'
import { Button } from './Button'

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
      if (event.key !== 'Tab') return
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>('button')
      if (!focusable?.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previouslyFocused.current?.focus() }
  }, [])

  return <div className="modal-layer" onMouseDown={onCancel}>
    <div className="modal confirm-modal" ref={modalRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-title"><h3 id="confirm-modal-title">{title}</h3></div>
      <p className="confirm-message">{message}</p>
      <div className="modal-actions">
        <Button ref={cancelRef} variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
}
