'use server'

import { createClient } from '@/lib/supabase/server'
import { formatDatabaseTime, mapComplaintRows, type ComplaintRow, type DuplicateRow, type EventRow, type ProfileRow } from '@/components/resolver/data-mappers'
import { defaultSlaRules, makeComplaint, type Channel, type Complaint, type ComplaintStatus, type ComplaintTriage, type NewComplaintInput, type Severity, type SlaRules } from '@/components/resolver/types'
import { mapSlaRules } from '@/components/resolver/data-mappers'
import { classifyComplaint, classificationSchema } from '@/lib/complaint-ai'
import { triageCorrectionSchema } from '@/lib/complaint-triage-schema'
import { preserveSavedComplaintOnTriageFailure } from '@/lib/triage-workflow'
import { logTriageDiagnostic } from '@/lib/triage-diagnostic'

const channels: Channel[] = ['Email', 'Phone', 'Branch', 'Web form', 'Mobile app', 'Social']
const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low']
const statuses: ComplaintStatus[] = ['Open', 'In progress', 'Pending customer', 'Resolved']
const complaintColumns = 'id,complaint_number,subject,customer_ref,channel,category,severity,sentiment,assigned_to,status,minutes_to_sla,received_at,sla_due_at,resolved_at,message,summary,recommended_action,response_draft,triage_status,triage_source,triage_category,triage_product,triage_severity,triage_sentiment,triage_language,triage_summary,triage_recommended_action,triage_possible_fraud,triage_fraud_reason,triage_confidence,triage_explanation,triage_error,triage_updated_at,triage_reviewed_at'

function mapTriage(value: Record<string, unknown>): ComplaintTriage {
  return {
    status: value.triage_status as ComplaintTriage['status'],
    source: value.triage_source as ComplaintTriage['source'],
    category: value.triage_category as string | null,
    product: value.triage_product as string | null,
    severity: value.triage_severity as ComplaintTriage['severity'],
    sentiment: value.triage_sentiment as ComplaintTriage['sentiment'],
    language: value.triage_language as string | null,
    summary: value.triage_summary as string | null,
    recommendedAction: value.triage_recommended_action as string | null,
    possibleFraud: value.triage_possible_fraud as boolean | null,
    fraudReason: value.triage_fraud_reason as string | null,
    confidence: value.triage_confidence as number | null,
    explanation: value.triage_explanation as string | null,
    error: value.triage_error as string | null,
    updatedAt: value.triage_updated_at as string | null,
    reviewedAt: value.triage_reviewed_at as string | null,
  }
}

async function processComplaintTriage(supabase: Awaited<ReturnType<typeof createClient>>, complaintNumber: string, actorId: string) {
  const { data: complaint, error: lookupError } = await supabase.from('complaints')
    .select('id,complaint_number,subject,message,category,severity,triage_status,triage_updated_at')
    .eq('complaint_number', complaintNumber).maybeSingle()
  if (lookupError) {
    logTriageDiagnostic('complaint-lookup', lookupError)
    throw new Error('Could not load this complaint for triage. Please retry.')
  }
  if (!complaint) {
    logTriageDiagnostic('complaint-lookup', undefined, 'not-found')
    return null
  }
  const staleProcessing = complaint.triage_status === 'processing' && complaint.triage_updated_at
    && Date.now() - new Date(complaint.triage_updated_at).getTime() > 60_000
  if (!['pending', 'failed'].includes(complaint.triage_status) && !staleProcessing) return null

  let claimQuery = supabase.from('complaints')
    .update({ triage_status: 'processing', triage_error: null, triage_updated_at: new Date().toISOString() })
    .eq('id', complaint.id).eq('triage_status', complaint.triage_status)
  if (staleProcessing) claimQuery = claimQuery.eq('triage_updated_at', complaint.triage_updated_at)
  const { data: claimed, error: claimError } = await claimQuery
    .select('id').maybeSingle()
  if (claimError) {
    logTriageDiagnostic('processing-claim', claimError)
    throw new Error('Could not start triage for this complaint. Please retry.')
  }
  if (!claimed) {
    logTriageDiagnostic('processing-claim', undefined, 'not-claimed')
    return null
  }

  let stage: 'classification' | 'result-persist' | 'activity-event' = 'classification'
  try {
    const { result, source } = await classifyComplaint({
      subject: complaint.subject,
      message: complaint.message,
      category: complaint.category,
      severity: complaint.severity,
    })
    const valid = classificationSchema.parse(result)
    const timestamp = new Date().toISOString()
    stage = 'result-persist'
    const { error } = await supabase.from('complaints').update({
      triage_status: 'complete', triage_source: source,
      triage_category: valid.category, triage_product: valid.product,
      triage_severity: valid.severity, triage_sentiment: valid.sentiment,
      triage_language: valid.language, triage_summary: valid.summary,
      triage_recommended_action: valid.recommendedAction,
      triage_possible_fraud: valid.possibleFraud, triage_fraud_reason: valid.fraudReason,
      triage_confidence: valid.confidence, triage_explanation: valid.explanation,
      triage_error: null, triage_updated_at: timestamp,
    }).eq('id', complaint.id)
    if (error) throw error
    stage = 'activity-event'
    const { error: activityError } = await supabase.from('complaint_events').insert({
      complaint_id: complaint.id, actor_id: actorId, event_type: 'system',
      title: source === 'ai' ? 'AI triage completed' : 'Fallback triage completed',
      detail: source === 'ai'
        ? 'Structured suggestions are ready for agent review.'
        : 'Deterministic fallback suggestions are ready; no AI provider was configured.',
    })
    if (activityError) throw activityError
    return mapTriage({ ...valid, triage_status: 'complete', triage_source: source, triage_category: valid.category,
      triage_product: valid.product, triage_severity: valid.severity, triage_sentiment: valid.sentiment,
      triage_language: valid.language, triage_summary: valid.summary, triage_recommended_action: valid.recommendedAction,
      triage_possible_fraud: valid.possibleFraud, triage_fraud_reason: valid.fraudReason,
      triage_confidence: valid.confidence, triage_explanation: valid.explanation, triage_error: null, triage_updated_at: timestamp, triage_reviewed_at: null })
  } catch (error) {
    // Keep provider and complaint details private; the development logger emits only safe metadata.
    logTriageDiagnostic(stage, error)
    const errorMessage = 'Triage could not be completed. The complaint is saved; please retry.'
    const { error: persistError } = await supabase.from('complaints').update({ triage_status: 'failed', triage_error: errorMessage, triage_updated_at: new Date().toISOString() }).eq('id', complaint.id)
    if (persistError) logTriageDiagnostic('failure-persist', persistError)
    return mapTriage({ triage_status: 'failed', triage_source: null, triage_category: null, triage_product: null,
      triage_severity: null, triage_sentiment: null, triage_language: null, triage_summary: null,
      triage_recommended_action: null, triage_possible_fraud: null, triage_fraud_reason: null,
      triage_confidence: null, triage_explanation: null, triage_error: errorMessage, triage_updated_at: new Date().toISOString(), triage_reviewed_at: null })
  }
}

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Your session has expired. Sign in again.')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError || !profile || !['agent', 'manager'].includes(profile.role)) throw new Error('This operation is available to authorized staff only.')
  return { supabase, user }
}

export async function loadCustomerConversationAction(complaintNumber: string) {
  if (typeof complaintNumber !== 'string' || !/^CMP-\d{5}$/.test(complaintNumber)) throw new Error('Invalid complaint reference.')
  const { supabase } = await requireStaff()
  const { data: complaint, error } = await supabase.from('complaints').select('id,customer_id').eq('complaint_number', complaintNumber).maybeSingle()
  if (error || !complaint) throw new Error('The complaint could not be loaded.')
  if (!complaint.customer_id) return { enabled: false as const, reason: 'not-linked' as const, messages: [] }
  const { data, error: messageError } = await supabase.from('customer_messages').select('id,sender_kind,body,created_at').eq('complaint_id', complaint.id).order('created_at')
  if (messageError) throw new Error('The customer conversation could not be loaded.')
  return { enabled: true as const, messages: data ?? [] }
}

export async function publishCustomerReplyAction(complaintNumber: string, body: string) {
  if (typeof complaintNumber !== 'string' || !/^CMP-\d{5}$/.test(complaintNumber) || typeof body !== 'string' || body.trim().length < 1 || body.length > 5000) throw new Error('Enter a reply of up to 5,000 characters.')
  const { supabase, user } = await requireStaff()
  const { data: complaint, error } = await supabase.from('complaints').select('id,customer_id').eq('complaint_number', complaintNumber).maybeSingle()
  if (error || !complaint?.customer_id) throw new Error('This complaint does not have a customer portal conversation.')
  const { data: message, error: insertError } = await supabase.from('customer_messages')
    .insert({ complaint_id: complaint.id, sender_id: user.id, sender_kind: 'staff', body: body.trim() })
    .select('id,sender_kind,body,created_at').single()
  if (insertError || !message) throw new Error('The customer reply could not be sent.')
  return message
}

function validateNewComplaint(input: NewComplaintInput) {
  if (!input || typeof input !== 'object') throw new Error('Enter valid complaint details.')
  const subject = typeof input.subject === 'string' ? input.subject.trim() : ''
  const customerRef = typeof input.customerRef === 'string' ? input.customerRef.trim() : ''
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  const category = typeof input.category === 'string' ? input.category.trim() : ''
  if (!subject || subject.length > 120 || !customerRef || customerRef.length > 32 || !message || message.length > 10000 || !category || category.length > 100) {
    throw new Error('Check the complaint fields and try again.')
  }
  if (!channels.includes(input.channel) || !severities.includes(input.severity)) throw new Error('Choose a valid complaint channel and severity.')
  return { ...input, subject, customerRef, message, category }
}

export async function createComplaintAction(input: NewComplaintInput): Promise<Complaint> {
  const valid = validateNewComplaint(input)
  const { supabase, user } = await requireStaff()
  const { data: settingsRow } = await supabase.from('workspace_settings').select('standard_first_response_hours,critical_response_hours,escalation_elapsed_percent').eq('id', true).maybeSingle()
  const slaRules = mapSlaRules(settingsRow)
  const draft = makeComplaint(valid, 0)
  const receivedAt = new Date()
  const targetHours = valid.severity === 'Critical' ? slaRules.criticalResponseHours : slaRules.standardFirstResponseHours
  const dueAt = new Date(receivedAt.getTime() + targetHours * 3_600_000)
  const { data: row, error } = await supabase.from('complaints').insert({
    subject: valid.subject,
    customer_ref: valid.customerRef,
    channel: valid.channel,
    category: valid.category,
    severity: valid.severity,
    sentiment: 'Neutral',
    assigned_to: user.id,
    status: 'Open',
    minutes_to_sla: targetHours * 60,
    received_at: receivedAt.toISOString(),
    sla_due_at: dueAt.toISOString(),
    message: valid.message,
    summary: draft.summary,
    recommended_action: draft.recommendedAction,
    response_draft: draft.responseDraft,
    created_by: user.id,
  }).select(complaintColumns).single()
  if (error) throw new Error('The complaint could not be saved. Check your access and try again.')

  const { data: event } = await supabase.from('complaint_events').insert({
    complaint_id: row.id,
    actor_id: user.id,
    event_type: 'customer',
    title: 'Complaint received',
    detail: 'Created in the authenticated workspace',
  }).select('complaint_id,event_type,title,detail,created_at').maybeSingle()

  const profileRows = await supabase.from('profiles').select('id,display_name,role').eq('id', user.id)
  const afterSave = await preserveSavedComplaintOnTriageFailure(row, () => processComplaintTriage(supabase, row.complaint_number, user.id))
  const triage = afterSave.triage
  const complaintRows = [row as ComplaintRow]
  const eventRows = event ? [event as EventRow] : []
  const profiles = (profileRows.data ?? []) as ProfileRow[]
  const mapped = mapComplaintRows(complaintRows, profiles, eventRows, [], slaRules)[0]
  const events = triage?.status === 'complete' ? [...mapped.events, {
    time: formatDatabaseTime(new Date().toISOString()),
    title: triage.source === 'ai' ? 'AI triage completed' : 'Fallback triage completed',
    detail: triage.source === 'ai' ? 'Structured suggestions are ready for agent review.' : 'Deterministic fallback suggestions are ready; no AI provider was configured.',
    type: 'system' as const,
  }] : mapped.events
  return { ...mapped, events, ...(triage ? { triage } : {}), responseDraft: draft.responseDraft.replace(draft.id, row.complaint_number) }
}

export async function retryComplaintTriageAction(complaintNumber: string) {
  if (typeof complaintNumber !== 'string' || !/^CMP-\d{5}$/.test(complaintNumber)) throw new Error('Invalid complaint reference.')
  const { supabase, user } = await requireStaff()
  const result = await processComplaintTriage(supabase, complaintNumber, user.id)
  if (!result) throw new Error('Triage is already processing or has already completed.')
  return result
}

export async function correctComplaintTriageAction(complaintNumber: string, input: unknown) {
  if (typeof complaintNumber !== 'string' || !/^CMP-\d{5}$/.test(complaintNumber)) throw new Error('Invalid complaint reference.')
  const parsed = triageCorrectionSchema.safeParse(input)
  if (!parsed.success) throw new Error('Review values are invalid. Check each field and try again.')
  const { supabase, user } = await requireStaff()
  const { data: complaint, error: lookupError } = await supabase.from('complaints').select('id,triage_source')
    .eq('complaint_number', complaintNumber).maybeSingle()
  if (lookupError || !complaint) throw new Error('This complaint could not be found or you do not have access to it.')
  const value = parsed.data
  const reviewedAt = new Date().toISOString()
  const { error } = await supabase.from('complaints').update({
    category: value.category, severity: value.severity, sentiment: value.sentiment,
    summary: value.summary, recommended_action: value.recommendedAction,
    triage_category: value.category, triage_product: value.product,
    triage_severity: value.severity, triage_sentiment: value.sentiment,
    triage_language: value.language, triage_summary: value.summary,
    triage_recommended_action: value.recommendedAction,
    triage_possible_fraud: value.possibleFraud, triage_fraud_reason: value.fraudReason,
    triage_confidence: value.confidence, triage_explanation: value.explanation,
    triage_reviewed_at: reviewedAt, triage_updated_at: reviewedAt,
  }).eq('id', complaint.id)
  if (error) throw new Error('The corrected triage could not be saved.')
  const { error: eventError } = await supabase.from('complaint_events').insert({
    complaint_id: complaint.id, actor_id: user.id, event_type: 'agent',
    title: 'Triage suggestions corrected', detail: 'An agent reviewed and confirmed the complaint classification.',
  })
  if (eventError) throw new Error('The correction was saved, but its activity entry could not be added.')
  return { ...value, status: 'complete', source: complaint.triage_source, error: null, updatedAt: reviewedAt, reviewedAt } as ComplaintTriage
}

export async function updateComplaintAction(id: string, changes: Partial<Complaint>): Promise<Partial<Complaint>> {
  if (typeof id !== 'string' || !/^CMP-\d{5}$/.test(id)) throw new Error('Invalid complaint reference.')
  const { supabase, user } = await requireStaff()
  const { data: current, error: currentError } = await supabase.from('complaints')
    .select('id,assigned_to,created_by,status,severity,minutes_to_sla,response_draft')
    .eq('complaint_number', id).single()
  if (currentError || !current) throw new Error('This complaint could not be found or you do not have access to it.')

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const result: Partial<Complaint> = {}
  if (changes.status !== undefined) {
    if (!statuses.includes(changes.status)) throw new Error('Choose a valid complaint status.')
    patch.status = changes.status
    patch.resolved_at = changes.status === 'Resolved' ? new Date().toISOString() : null
    result.status = changes.status
    result.resolvedAt = changes.status === 'Resolved' ? String(patch.resolved_at) : null
  }
  if (changes.severity !== undefined) {
    if (!severities.includes(changes.severity)) throw new Error('Choose a valid complaint severity.')
    patch.severity = changes.severity
    result.severity = changes.severity
  }
  if (changes.responseDraft !== undefined) {
    if (typeof changes.responseDraft !== 'string' || changes.responseDraft.length > 5000) throw new Error('The response draft is too long.')
    patch.response_draft = changes.responseDraft
    result.responseDraft = changes.responseDraft
  }
  if (changes.assignedTo !== undefined) {
    if (changes.assignedTo === 'Unassigned') {
      patch.assigned_to = null
      result.assignedTo = 'Unassigned'
    } else {
      const { data: matchingProfiles, error: profileError } = await supabase.from('profiles').select('id,display_name').eq('display_name', changes.assignedTo).limit(2)
      if (profileError || matchingProfiles?.length !== 1) throw new Error('Select a valid workspace teammate.')
      patch.assigned_to = matchingProfiles[0].id
      result.assignedTo = matchingProfiles[0].display_name
    }
  }

  const { error: updateError } = await supabase.from('complaints').update(patch).eq('id', current.id)
  if (updateError) throw new Error('The complaint update was denied or could not be saved.')

  const requestedEvent = Array.isArray(changes.events) ? changes.events.at(-1) : undefined
  if (requestedEvent) {
    if (typeof requestedEvent.title !== 'string' || requestedEvent.title.length > 120 || typeof requestedEvent.detail !== 'string' || requestedEvent.detail.length > 1000) {
      throw new Error('Invalid activity entry.')
    }
    const { error: eventError } = await supabase.from('complaint_events').insert({
      complaint_id: current.id,
      actor_id: user.id,
      event_type: 'agent',
      title: requestedEvent.title,
      detail: requestedEvent.detail,
    })
    if (eventError) throw new Error('The complaint was updated, but its activity entry could not be saved.')
    result.events = [...(changes.events ?? [])].map((event) => ({ ...event, type: event.type === 'customer' ? 'customer' : event.type === 'system' ? 'system' : 'agent' }))
    result.events[result.events.length - 1] = { ...result.events[result.events.length - 1], type: 'agent', time: formatDatabaseTime(new Date().toISOString()) }
  }
  return result
}

export async function saveSlaRulesAction(input: SlaRules): Promise<SlaRules> {
  const standardFirstResponseHours = Number(input?.standardFirstResponseHours)
  const criticalResponseHours = Number(input?.criticalResponseHours)
  const escalationElapsedPercent = Number(input?.escalationElapsedPercent)
  if (!Number.isInteger(standardFirstResponseHours) || standardFirstResponseHours < 1 || standardFirstResponseHours > 72 || !Number.isInteger(criticalResponseHours) || criticalResponseHours < 1 || criticalResponseHours > 24 || !Number.isInteger(escalationElapsedPercent) || escalationElapsedPercent < 1 || escalationElapsedPercent > 99) {
    throw new Error('Enter valid whole-number SLA values within the allowed ranges.')
  }
  const { supabase } = await requireStaff()
  const rules = { standardFirstResponseHours, criticalResponseHours, escalationElapsedPercent }
  const { data, error } = await supabase.from('workspace_settings').upsert({
    id: true,
    standard_first_response_hours: rules.standardFirstResponseHours,
    critical_response_hours: rules.criticalResponseHours,
    escalation_elapsed_percent: rules.escalationElapsedPercent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select('standard_first_response_hours,critical_response_hours,escalation_elapsed_percent').single()
  if (error || !data) throw new Error('SLA rules could not be saved. Manager access is required.')
  return mapSlaRules(data)
}

export async function saveDuplicateDecisionAction(firstNumber: string, secondNumber: string, decision: 'confirmed' | 'rejected') {
  if (!/^CMP-\d{5}$/.test(firstNumber) || !/^CMP-\d{5}$/.test(secondNumber) || firstNumber === secondNumber || !['confirmed', 'rejected'].includes(decision)) {
    throw new Error('Invalid duplicate decision.')
  }
  const { supabase, user } = await requireStaff()
  const { data: rows, error: lookupError } = await supabase.from('complaints').select('id,complaint_number').in('complaint_number', [firstNumber, secondNumber])
  if (lookupError || rows?.length !== 2) throw new Error('The linked complaints could not be found.')
  const [first, second] = [...rows].sort((a, b) => a.id.localeCompare(b.id))
  const { error } = await supabase.from('duplicate_links').upsert({
    complaint_a_id: first.id,
    complaint_b_id: second.id,
    status: decision,
    created_by: user.id,
  }, { onConflict: 'complaint_a_id,complaint_b_id' })
  if (error) throw new Error('This duplicate decision could not be saved with your current role.')
}
