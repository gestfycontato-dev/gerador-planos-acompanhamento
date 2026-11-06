import type { ReactNode } from 'react'

export function EmptyState({ tone = 'state', children }: { tone?: 'state' | 'panel'; children: ReactNode }) {
  return <div className={`empty-${tone}`}>{children}</div>
}
