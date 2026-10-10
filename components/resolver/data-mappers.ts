import { defaultSlaRules, minutesUntilSla, type Complaint, type ComplaintStatus, type Severity, type Channel, type TeamMember, type UserRole, type PolicyArticle, type SlaRules } from './types'

export type WorkspaceProfile = { id: string; displayName: string; role: UserRole }
export type ResolverWorkspace = {
  profile: WorkspaceProfile | null
  complaints: Complaint[]
  team: TeamMember[]
  articles: PolicyArticle[]
  duplicateDecisions: Record<string, 'confirmed' | 'rejected'>
  slaRules: SlaRules
  error?: string
  errorStage?: 'auth' | 'profile' | 'workspace'
}

type ProfileRow = { id: string; display_name: string; role: 'manager' | 'agent' }
type ComplaintRow = {
  id: string
  complaint_number: string
  subject: string
  customer_ref: string
  channel: Channel
  category: string
  severity: Severity
  sentiment: Complaint['sentiment']
  assigned_to: string | null
  status: ComplaintStatus
  minutes_to_sla: number
  received_at: string
  sla_due_at: string | null
  resolved_at: string | null
  message: string
  summary: string
  recommended_action: string
  response_draft: string
}
type EventRow = { complaint_id: string; event_type: Complaint['events'][number]['type']; title: string; detail: string; created_at: string }
type DuplicateRow = { complaint_a_id: string; complaint_b_id: string; status: string }
type KnowledgeRow = { id: string; title: string; category: string; content: string; updated_at: string }
type SlaSettingsRow = { standard_first_response_hours: number; critical_response_hours: number; escalation_elapsed_percent: number }

export function mapSlaRules(row?: SlaSettingsRow | null): SlaRules {
  return row ? {
    standardFirstResponseHours: row.standard_first_response_hours,
    criticalResponseHours: row.critical_response_hours,
    escalationElapsedPercent: row.escalation_elapsed_percent,
  } : defaultSlaRules
}

const avatarColors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700']

export function formatDatabaseTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function mapComplaintRows(
  rows: ComplaintRow[],
  profileRows: ProfileRow[],
  eventRows: EventRow[],
  duplicateRows: DuplicateRow[],
  slaRules: SlaRules = defaultSlaRules,
): Complaint[] {
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const complaintById = new Map(rows.map((row) => [row.id, row.complaint_number]))
  const eventsByComplaint = new Map<string, EventRow[]>()
  for (const event of eventRows) {
    const events = eventsByComplaint.get(event.complaint_id) ?? []
    events.push(event)
    eventsByComplaint.set(event.complaint_id, events)
  }
  const duplicatesByComplaint = new Map<string, Set<string>>()
  for (const link of duplicateRows) {
    const first = complaintById.get(link.complaint_a_id)
    const second = complaintById.get(link.complaint_b_id)
    if (!first || !second) continue
    for (const [owner, related] of [[link.complaint_a_id, second], [link.complaint_b_id, first]] as const) {
      const ids = duplicatesByComplaint.get(owner) ?? new Set<string>()
      ids.add(related)
      duplicatesByComplaint.set(owner, ids)
    }
  }

  return rows.map((row) => ({
    id: row.complaint_number,
    subject: row.subject,
    customerRef: row.customer_ref,
    channel: row.channel,
    category: row.category,
    severity: row.severity,
    sentiment: row.sentiment,
    assignedTo: row.assigned_to ? profileById.get(row.assigned_to)?.display_name ?? 'Unassigned' : 'Unassigned',
    status: row.status,
    minutesToSla: minutesUntilSla(row.sla_due_at ?? new Date(new Date(row.received_at).getTime() + (row.severity === 'Critical' ? slaRules.criticalResponseHours : slaRules.standardFirstResponseHours) * 3_600_000).toISOString()),
    slaTargetMinutes: row.sla_due_at ? Math.max(1, Math.round((new Date(row.sla_due_at).getTime() - new Date(row.received_at).getTime()) / 60_000)) : (row.severity === 'Critical' ? slaRules.criticalResponseHours : slaRules.standardFirstResponseHours) * 60,
    slaRiskThresholdMinutes: Math.ceil(((row.sla_due_at ? Math.max(1, Math.round((new Date(row.sla_due_at).getTime() - new Date(row.received_at).getTime()) / 60_000)) : (row.severity === 'Critical' ? slaRules.criticalResponseHours : slaRules.standardFirstResponseHours) * 60) * (100 - slaRules.escalationElapsedPercent)) / 100),
    receivedAt: row.received_at,
    slaDueAt: row.sla_due_at ?? new Date(new Date(row.received_at).getTime() + (row.severity === 'Critical' ? slaRules.criticalResponseHours : slaRules.standardFirstResponseHours) * 3_600_000).toISOString(),
    resolvedAt: row.resolved_at,
    received: formatDatabaseTime(row.received_at),
    message: row.message,
    summary: row.summary,
    recommendedAction: row.recommended_action,
    responseDraft: row.response_draft,
    duplicateIds: [...(duplicatesByComplaint.get(row.id) ?? [])],
    events: (eventsByComplaint.get(row.id) ?? []).map((event) => ({
      time: formatDatabaseTime(event.created_at),
      title: event.title,
      detail: event.detail,
      type: event.event_type,
    })),
  }))
}

export function mapWorkspace(
  userId: string,
  profileRows: ProfileRow[],
  complaintRows: ComplaintRow[],
  eventRows: EventRow[],
  duplicateRows: DuplicateRow[],
  knowledgeRows: KnowledgeRow[],
  settingsRow?: SlaSettingsRow | null,
): ResolverWorkspace {
  const profileRow = profileRows.find((item) => item.id === userId)
  const slaRules = mapSlaRules(settingsRow)
  if (!profileRow) {
    return { profile: null, complaints: [], team: [], articles: [], duplicateDecisions: {}, slaRules, error: 'Your account does not have a workspace profile. Ask a workspace manager to restore access.' }
  }

  const complaints = mapComplaintRows(complaintRows, profileRows, eventRows, duplicateRows, slaRules)
  const role: UserRole = profileRow.role === 'manager' ? 'Manager' : 'Agent'
  const profile: WorkspaceProfile = { id: profileRow.id, displayName: profileRow.display_name, role }
  const team = profileRows.map((member, index) => {
    const name = member.display_name
    const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    return {
      name,
      initials,
      role: member.role === 'manager' ? 'Manager' as const : 'Agent' as const,
      active: complaints.filter((item) => item.assignedTo === name && item.status !== 'Resolved').length,
      resolvedToday: 0,
      avatarColor: avatarColors[index % avatarColors.length],
    }
  })
  const decisions: Record<string, 'confirmed' | 'rejected'> = {}
  const complaintNumberById = new Map(complaintRows.map((item) => [item.id, item.complaint_number]))
  for (const link of duplicateRows) {
    if (link.status !== 'confirmed' && link.status !== 'rejected') continue
    const numbers = [complaintNumberById.get(link.complaint_a_id), complaintNumberById.get(link.complaint_b_id)].filter((value): value is string => Boolean(value)).sort()
    if (numbers.length === 2) decisions[numbers.join(':')] = link.status
  }

  return {
    profile,
    complaints,
    team,
    articles: knowledgeRows.map((article) => ({
      title: article.title,
      category: article.category,
      updated: `Updated ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(article.updated_at))}`,
      text: article.content,
    })),
    duplicateDecisions: decisions,
    slaRules,
  }
}

export type { ComplaintRow, DuplicateRow, EventRow, KnowledgeRow, ProfileRow }
