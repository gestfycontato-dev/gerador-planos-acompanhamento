import type { ReactNode } from 'react'

export function Modal({ onClose, className, layerClassName, children }: { onClose: () => void; className?: string; layerClassName?: string; children: ReactNode }) {
  return <div className={`modal-layer ${layerClassName ?? ''}`.trim()} onMouseDown={onClose}>
    <div className={`modal ${className ?? ''}`.trim()} onMouseDown={e => e.stopPropagation()}>{children}</div>
  </div>
}
