import type { ReactNode } from 'react'

export function Field({ label, full, help, error, className, children }: { label: ReactNode; full?: boolean; help?: string; error?: string; className?: string; children: ReactNode }) {
  return <label className={[full ? 'full' : '', className ?? ''].filter(Boolean).join(' ')}>
    {label}
    {children}
    {help && <small className="field-help">{help}</small>}
    {error && <small className="field-error">{error}</small>}
  </label>
}
