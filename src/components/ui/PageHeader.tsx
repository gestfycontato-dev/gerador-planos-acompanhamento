import type { ReactNode } from 'react'

export function PageHeader({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <header className="page-header"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>
}
