import type { GoalCatalogItem, GoalDirection, GoalValueType } from '../types'

export const normalizeGoalName = (value: string) => value.trim().toLowerCase()
export const findCatalogMatch = (name: string, catalog: GoalCatalogItem[] | null | undefined) =>
  catalog?.find(c => normalizeGoalName(c.name) === normalizeGoalName(name))

export const directionLabels: Record<GoalDirection, string> = {
  decrease: 'Diminuir (menor valor = melhora)',
  increase: 'Aumentar (maior valor = melhora)',
  target: 'Meta específica (comparar com valor alvo)',
}
export const valueTypeLabels: Record<GoalValueType, string> = {
  number: 'Numérico',
  text: 'Texto (ex.: escala, categoria)',
}
