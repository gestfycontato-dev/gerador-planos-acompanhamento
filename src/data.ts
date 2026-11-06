import type { Patient, Plan, Service } from './types'

export const clinic = { id: '', name: '', plan: 'Plano Essencial' }

export const services: Service[] = []

export const patients: Patient[] = []

const week = (number: number, serviceIds: string[]) => ({ number, items: serviceIds.map((serviceId, i) => ({ id: `${number}-${i}`, serviceId })) })
export const initialPlans: Plan[] = []

export const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
