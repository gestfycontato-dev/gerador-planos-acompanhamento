export function parseDecimalInput(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function formatDecimalInput(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  return String(value).replace('.', ',')
}

export function sanitizeConstrainedInput(value: string, decimals: number): string {
  const digitsOnly = value.replace(/[^\d,]/g, '')
  if (decimals <= 0) return digitsOnly.replace(/,/g, '')
  const [intPart, ...rest] = digitsOnly.split(',')
  if (!rest.length) return intPart
  return `${intPart},${rest.join('').slice(0, decimals)}`
}

export function clampDecimalInput(value: string, min?: number, max?: number): string {
  const parsed = parseDecimalInput(value)
  if (parsed === undefined) return value
  let next = parsed
  if (min !== undefined) next = Math.max(min, next)
  if (max !== undefined) next = Math.min(max, next)
  return next === parsed ? value : formatDecimalInput(next)
}
