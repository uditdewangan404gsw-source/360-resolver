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
  received: string
  message: string
  summary: string
  recommendedAction: string
  responseDraft: string
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

export const volumeData = [
  { day: 'Mon', received: 112, resolved: 98 },
  { day: 'Tue', received: 128, resolved: 116 },
  { day: 'Wed', received: 105, resolved: 119 },
  { day: 'Thu', received: 149, resolved: 121 },
  { day: 'Fri', received: 137, resolved: 130 },
  { day: 'Sat', received: 88, resolved: 95 },
  { day: 'Sun', received: 94, resolved: 82 },
]

export const categoryData = [
  { name: 'Card payments', value: 31, color: '#315fce' },
  { name: 'Digital banking', value: 24, color: '#5482df' },
  { name: 'Fees & charges', value: 18, color: '#7aa0ea' },
  { name: 'Disputes', value: 15, color: '#a4beef' },
  { name: 'Other', value: 12, color: '#d0dcf4' },
]

export const channelData = [
  { name: 'Mobile app', value: 38 },
  { name: 'Phone', value: 26 },
  { name: 'Web form', value: 17 },
  { name: 'Branch', value: 12 },
  { name: 'Email / social', value: 7 },
]

export function formatSla(minutes: number) {
  if (minutes < 0) return 'Overdue'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return `${hours}h ${remaining}m`
}

export function isAtRisk(complaint: Complaint) {
  return complaint.minutesToSla <= 120 && complaint.status !== 'Resolved'
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
    received: 'Just now',
    summary: `Customer reports: ${input.message.slice(0, 138)}${input.message.length > 138 ? '…' : ''}`,
    recommendedAction: 'Review the customer’s concern, verify the relevant account records, and confirm the next update with the customer.',
    responseDraft: `Hello, thank you for contacting us about ${input.subject.toLowerCase()}. We’re reviewing your concern and will follow up with an update. Your case reference is ${id}.`,
    duplicateIds: [],
    events: [{ time: 'Just now', title: 'Complaint received', detail: 'Created in the authenticated workspace', type: 'customer' }],
  }
}
