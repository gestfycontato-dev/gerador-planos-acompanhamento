import type { Discount, Plan, Service } from '../types'

export const planValue = (plan: Plan, services: Service[], discounts: Discount[]) => {
  const subtotal = plan.weeks.flatMap(w => w.items).reduce((n, i) => n + (services.find(s => s.id === i.serviceId)?.price ?? 0) * (i.quantity ?? 1), 0)
  const discount = discounts.find(d => d.duration === plan.duration)?.percent ?? 0
  return subtotal * (1 - discount / 100)
}
