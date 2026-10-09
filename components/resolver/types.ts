export type ViewKey =
  | 'dashboard'
  | 'inbox'
  | 'new'
  | 'sla'
  | 'duplicates'
  | 'analytics'
  | 'knowledge'
  | 'team'
  | 'settings'

export type UserRole = 'Manager' | 'Agent'
export type ComplaintStatus = 'Open' | 'In progress' | 'Pending customer' | 'Resolved'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Channel = 'Email' | 'Phone' | 'Branch' | 'Web form' | 'Mobile app' | 'Social'
export type TriageSource = 'ai' | 'fallback'
export type TriageStatus = 'pending' | 'processing' | 'complete' | 'failed'
export type ComplaintTriage = {
  status: TriageStatus
  source: TriageSource | null
  category: string | null
  product: string | null
  severity: Severity | null
  sentiment: 'Frustrated' | 'Negative' | 'Neutral' | 'Positive' | null
  language: string | null
  summary: string | null
  recommendedAction: string | null
  possibleFraud: boolean | null
  fraudReason: string | null
  confidence: number | null
  explanation: string | null
  error: string | null
  updatedAt: string | null
  reviewedAt: string | null
}

export type SlaRules = {
  standardFirstResponseHours: number
  criticalResponseHours: number
  escalationElapsedPercent: number
}

export const defaultSlaRules: SlaRules = {
  standardFirstResponseHours: 4,
  criticalResponseHours: 1,
  escalationElapsedPercent: 75,
}

export type Complaint = {
  id: string
  subject: string
  customerRef: string
  channel: Channel
  category: string
  severity: Severity
  sentiment: 'Frustrated' | 'Negative' | 'Neutral' | 'Positive'
  assignedTo: string
  status: ComplaintStatus
  minutesToSla: number
  slaTargetMinutes: number
  slaRiskThresholdMinutes: number
  receivedAt: string
  slaDueAt: string
  resolvedAt: string | null
  received: string
  message: string
  summary: string
  recommendedAction: string
  responseDraft: string
  triage: ComplaintTriage
  duplicateIds: string[]
  events: { time: string; title: string; detail: string; type: 'system' | 'agent' | 'customer' }[]
}

export type NewComplaintInput = Pick<Complaint, 'subject' | 'customerRef' | 'channel' | 'category' | 'severity' | 'message'>

export type TeamMember = {
  name: string
  initials: string
  role: UserRole
  active: number
  resolvedToday: number
  avatarColor: string
}

export type PolicyArticle = {
  title: string
  category: string
  updated: string
  text: string
}

export const navigation: { key: ViewKey; label: string; icon: string; section?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', section: 'WORKSPACE' },
  { key: 'inbox', label: 'Complaint Inbox', icon: 'Inbox', section: 'WORKSPACE' },
  { key: 'new', label: 'New Complaint', icon: 'CirclePlus', section: 'WORKSPACE' },
  { key: 'sla', label: 'SLA & Escalations', icon: 'AlarmClock', section: 'OPERATIONS' },
  { key: 'duplicates', label: 'Duplicate Clusters', icon: 'Copy', section: 'OPERATIONS' },
  { key: 'analytics', label: 'Trends & Analytics', icon: 'ChartNoAxesCombined', section: 'INSIGHTS' },
  { key: 'knowledge', label: 'Knowledge Base', icon: 'BookOpen', section: 'INSIGHTS' },
  { key: 'team', label: 'Team Management', icon: 'UsersRound', section: 'ADMINISTRATION' },
  { key: 'settings', label: 'Settings', icon: 'Settings2', section: 'ADMINISTRATION' },
]

export function formatSla(minutes: number) {
  if (minutes < 0) return 'Breached'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

export function minutesUntilSla(deadline: string, now = Date.now()) {
  return Math.ceil((new Date(deadline).getTime() - now) / 60_000)
}

export function isAtRisk(complaint: Complaint) {
  return complaint.status !== 'Resolved' && complaint.minutesToSla >= 0 && complaint.minutesToSla <= complaint.slaRiskThresholdMinutes
}

export function isSlaBreached(complaint: Complaint) {
  return complaint.status !== 'Resolved' && complaint.minutesToSla < 0
}

export function getSlaState(complaint: Complaint) {
  if (complaint.status === 'Resolved') return 'resolved' as const
  if (isSlaBreached(complaint)) return 'breached' as const
  if (isAtRisk(complaint)) return 'at-risk' as const
  return 'on-track' as const
}

export function buildDailyComplaintVolume(complaints: Complaint[], now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 6)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { key: date.toDateString(), day: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date), received: 0, resolved: 0 }
  })
  const byDate = new Map(days.map((day) => [day.key, day]))
  for (const complaint of complaints) {
    const receivedDay = byDate.get(new Date(complaint.receivedAt).toDateString())
    if (receivedDay) receivedDay.received += 1
    if (complaint.resolvedAt) {
      const resolvedDay = byDate.get(new Date(complaint.resolvedAt).toDateString())
      if (resolvedDay) resolvedDay.resolved += 1
    }
  }
  return days.map(({ day, received, resolved }) => ({ day, received, resolved }))
}

export function findDuplicateCandidates(complaints: Complaint[]) {
  const candidates: { key: string; first: Complaint; second: Complaint; reason: string }[] = []
  for (let firstIndex = 0; firstIndex < complaints.length; firstIndex += 1) {
    const first = complaints[firstIndex]
    if (first.status === 'Resolved') continue
    for (const second of complaints.slice(firstIndex + 1)) {
      if (second.status === 'Resolved') continue
      const alreadyLinked = first.duplicateIds.includes(second.id) || second.duplicateIds.includes(first.id)
      const firstDate = new Date(first.receivedAt).getTime()
      const secondDate = new Date(second.receivedAt).getTime()
      const withinWindow = Math.abs(firstDate - secondDate) <= 30 * 24 * 60 * 60 * 1000
      const sameSubject = first.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ') === second.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
      const sameCustomerAndCategory = first.customerRef.toLowerCase() === second.customerRef.toLowerCase() && first.category === second.category
      if (!alreadyLinked && withinWindow && (sameSubject || sameCustomerAndCategory)) {
        const [a, b] = [first.id, second.id].sort()
        candidates.push({ key: `${a}:${b}`, first, second, reason: sameSubject ? 'Matching complaint subject' : 'Same customer and category within 30 days' })
      }
    }
  }
  return candidates
}

export function makeComplaint(input: NewComplaintInput, currentCount: number): Complaint {
  const id = `CMP-${String(28500 + currentCount).padStart(5, '0')}`
  return {
    ...input,
    id,
    sentiment: 'Neutral',
    assignedTo: 'Unassigned',
    status: 'Open',
    minutesToSla: 480,
    slaTargetMinutes: 480,
    slaRiskThresholdMinutes: 120,
    receivedAt: new Date().toISOString(),
    slaDueAt: new Date(Date.now() + 480 * 60_000).toISOString(),
    resolvedAt: null,
    received: 'Just now',
    summary: `Customer reports: ${input.message.slice(0, 138)}${input.message.length > 138 ? '…' : ''}`,
    recommendedAction: 'Review the customer’s concern, verify the relevant account records, and confirm the next update with the customer.',
    responseDraft: `Hello, thank you for contacting us about ${input.subject.toLowerCase()}. We’re reviewing your concern and will follow up with an update. Your case reference is ${id}.`,
    triage: {
      status: 'pending', source: null, category: null, product: null, severity: null,
      sentiment: null, language: null, summary: null, recommendedAction: null,
      possibleFraud: null, fraudReason: null, confidence: null, explanation: null,
      error: null, updatedAt: null, reviewedAt: null,
    },
    duplicateIds: [],
    events: [{ time: 'Just now', title: 'Complaint received', detail: 'Created in the authenticated workspace', type: 'customer' }],
  }
}
