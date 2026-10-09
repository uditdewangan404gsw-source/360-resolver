export type CustomerComplaint = {
  id: string
  complaint_number: string
  subject: string
  category: string
  product: string | null
  description: string
  status: 'Open' | 'In progress' | 'Pending customer' | 'Resolved'
  received_at: string
  updated_at: string
  sla_due_at: string | null
  sla_risk_at: string | null
  resolved_at: string | null
  transaction_date: string | null
  transaction_amount: number | null
  transaction_reference: string | null
  assigned_name: string | null
}

export type CustomerEvent = { event_type: string; title: string; detail: string; created_at: string }
export type CustomerMessage = { id: string; sender_kind: 'customer' | 'staff'; body: string; created_at: string }

export function customerStatus(status: CustomerComplaint['status']) {
  return ({ Open: 'Received', 'In progress': 'Under review', 'Pending customer': 'Waiting for your information', Resolved: 'Resolved' })[status]
}

export function slaState(status: CustomerComplaint['status'], dueAt: string | null, riskAt: string | null, now = Date.now()) {
  if (status === 'Resolved') return 'resolved' as const
  if (!dueAt) return 'unavailable' as const
  const minutes = Math.ceil((new Date(dueAt).getTime() - now) / 60_000)
  if (minutes < 0) return 'breached' as const
  if (riskAt && now >= new Date(riskAt).getTime()) return 'at-risk' as const
  return 'on-track' as const
}

export function minutesRemaining(dueAt: string | null, now = Date.now()) {
  return dueAt ? Math.ceil((new Date(dueAt).getTime() - now) / 60_000) : null
}

export function resolutionEstimate(commitmentAt: string | null) {
  return commitmentAt ? { available: true as const, commitmentAt } : { available: false as const, label: 'Resolution time not yet available' }
}
