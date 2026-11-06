import type { SalesScriptPhase, SaleStatus } from '../types'

export type Page = 'dashboard' | 'create' | 'plans' | 'patients' | 'services' | 'discounts' | 'payment-methods' | 'goals' | 'plan-templates' | 'sales-script' | 'sales' | 'renewals' | 'settings' | 'builder' | 'consultation' | 'admin'
export const statuses: SaleStatus[] = ['Plano criado', 'Plano vendido', 'Plano não vendido']
export const durationOptions = [8, 12, 16, 24, 48]
export const consultationPhases: SalesScriptPhase[] = ['rapport', 'situacao', 'problema', 'implicacao', 'necessidade', 'apresentacao', 'encaminhamento']
