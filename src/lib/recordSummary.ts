import { addDays, addWeeks, format, parseISO } from 'date-fns'
import { money } from '../data'
import type { Plan, SalesScriptItem, Service } from '../types'

export type ConsultationSummaryInput = {
  startedAt: string
  freeNotes?: string
  scriptItems: SalesScriptItem[]
  entries: Record<string, { checked?: boolean; answerText?: string }>
}

export type PlanSummaryInput = {
  plan: Plan
  goalLines: string[]
  services: Service[]
  discountPercent: number
}

const shortSectionLabel = (item: SalesScriptItem) => {
  const raw = item.sectionLabel ?? item.phaseLabel
  return raw.replace(/^\d+(\.\d+)?\s+/, '').split(/[—–-]/)[0].trim()
}

export const formatGoalLine = (goal: { name: string; unit?: string; current: string; target: string }) => {
  const unit = goal.unit ? ` ${goal.unit}` : ''
  return `${goal.name}: ${goal.current || '—'}${unit} → ${goal.target || '—'}${unit}`
}

export function buildRecordText(patientName: string, consultation?: ConsultationSummaryInput, planInput?: PlanSummaryInput): string {
  const sections: string[] = []

  if (consultation) {
    const date = format(parseISO(consultation.startedAt), 'dd/MM/yyyy')
    sections.push(`CONSULTA — ${date}\nPaciente: ${patientName}`)

    const answerLines = consultation.scriptItems
      .filter(item => item.itemType === 'answer')
      .map(item => {
        const text = consultation.entries[item.id]?.answerText?.trim()
        return text ? `[${shortSectionLabel(item)}] ${item.label}:\n  R: ${text}` : null
      })
      .filter((line): line is string => !!line)
    if (answerLines.length) sections.push(`ANAMNESE / INVESTIGAÇÃO (SPIN)\n${answerLines.join('\n')}`)

    if (consultation.freeNotes?.trim()) sections.push(`ANOTAÇÕES LIVRES\n${consultation.freeNotes.trim()}`)

    const checkedLines = consultation.scriptItems
      .filter(item => item.itemType === 'check' && consultation.entries[item.id]?.checked)
      .map(item => `- ${item.label}`)
    if (checkedLines.length) sections.push(`ETAPAS REALIZADAS NA CONSULTA\n${checkedLines.join('\n')}`)
  } else {
    sections.push(`Paciente: ${patientName}`)
  }

  if (planInput) {
    const { plan, goalLines, services, discountPercent } = planInput
    if (goalLines.length) sections.push(`OBJETIVOS DEFINIDOS\n${goalLines.join('\n')}`)

    const start = plan.startDate ? parseISO(plan.startDate) : new Date()
    const weekLines = plan.weeks.filter(w => w.items.length).map(w => {
      const from = addWeeks(start, w.number - 1)
      const names = w.items.map(item => {
        const quantity = item.quantity ?? 1
        const service = services.find(s => s.id === item.serviceId)
        return `${quantity > 1 ? `${quantity}x ` : ''}${service?.name ?? 'Serviço'}`
      }).join('; ')
      return `Semana ${w.number} (${format(from, 'dd/MM')} a ${format(addDays(from, 6), 'dd/MM')}): ${names}`
    })
    const subtotal = plan.weeks.flatMap(w => w.items).reduce((sum, item) => sum + (services.find(s => s.id === item.serviceId)?.price ?? 0) * (item.quantity ?? 1), 0)
    const total = subtotal * (1 - discountPercent / 100)
    const investmentLine = `Investimento: ${money(total)}${discountPercent > 0 ? ` (desconto de ${discountPercent}% por ${plan.duration} semanas)` : ''}`
    sections.push(`PLANO DE ACOMPANHAMENTO\nInício: ${format(start, 'dd/MM/yyyy')} | Duração: ${plan.duration} semanas\n${[...weekLines, investmentLine].join('\n')}`)
  }

  return sections.join('\n\n')
}

export async function copyTextWithFallback(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    if (!document.execCommand('copy')) throw new Error('Falha ao copiar')
  } finally {
    document.body.removeChild(textarea)
  }
}
