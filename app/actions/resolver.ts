'use server'

import { createClient } from '@/lib/supabase/server'
import { formatDatabaseTime, mapComplaintRows, type ComplaintRow, type DuplicateRow, type EventRow, type ProfileRow } from '@/components/resolver/data-mappers'
import { makeComplaint, type Channel, type Complaint, type ComplaintStatus, type NewComplaintInput, type Severity } from '@/components/resolver/types'

const channels: Channel[] = ['Email', 'Phone', 'Branch', 'Web form', 'Mobile app', 'Social']
const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low']
const statuses: ComplaintStatus[] = ['Open', 'In progress', 'Pending customer', 'Resolved']
const complaintColumns = 'id,complaint_number,subject,customer_ref,channel,category,severity,sentiment,assigned_to,status,minutes_to_sla,received_at,message,summary,recommended_action,response_draft'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Your session has expired. Sign in again.')
  return { supabase, user }
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
  const { supabase, user } = await requireUser()
  const draft = makeComplaint(valid, 0)
  const { data: row, error } = await supabase.from('complaints').insert({
    subject: valid.subject,
    customer_ref: valid.customerRef,
    channel: valid.channel,
    category: valid.category,
    severity: valid.severity,
    sentiment: 'Neutral',
    assigned_to: user.id,
    status: 'Open',
    minutes_to_sla: 480,
    message: valid.message,
    summary: draft.summary,
    recommended_action: draft.recommendedAction,
    response_draft: draft.responseDraft,
    created_by: user.id,
  }).select(complaintColumns).single()
  if (error) throw new Error('The complaint could not be saved. Check your access and try again.')

  const { data: event, error: eventError } = await supabase.from('complaint_events').insert({
    complaint_id: row.id,
    actor_id: user.id,
    event_type: 'customer',
    title: 'Complaint received',
    detail: 'Created in the authenticated workspace',
  }).select('complaint_id,event_type,title,detail,created_at').single()
  if (eventError) throw new Error('The complaint was saved, but its activity entry could not be added. Refresh the workspace before retrying.')

  const profileRows = await supabase.from('profiles').select('id,display_name,role').eq('id', user.id)
  if (profileRows.error) throw new Error('The complaint was saved, but the assigned profile could not be loaded.')
  const complaintRows = [row as ComplaintRow]
  const eventRows = [event as EventRow]
  const profiles = (profileRows.data ?? []) as ProfileRow[]
  const mapped = mapComplaintRows(complaintRows, profiles, eventRows, [] )[0]
  return { ...mapped, responseDraft: draft.responseDraft.replace(draft.id, row.complaint_number) }
}

export async function updateComplaintAction(id: string, changes: Partial<Complaint>): Promise<Partial<Complaint>> {
  if (typeof id !== 'string' || !/^CMP-\d{5}$/.test(id)) throw new Error('Invalid complaint reference.')
  const { supabase, user } = await requireUser()
  const { data: current, error: currentError } = await supabase.from('complaints')
    .select('id,assigned_to,created_by,status,severity,minutes_to_sla,response_draft')
    .eq('complaint_number', id).single()
  if (currentError || !current) throw new Error('This complaint could not be found or you do not have access to it.')

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const result: Partial<Complaint> = {}
  if (changes.status !== undefined) {
    if (!statuses.includes(changes.status)) throw new Error('Choose a valid complaint status.')
    patch.status = changes.status
    result.status = changes.status
  }
  if (changes.severity !== undefined) {
    if (!severities.includes(changes.severity)) throw new Error('Choose a valid complaint severity.')
    patch.severity = changes.severity
    result.severity = changes.severity
  }
  if (changes.minutesToSla !== undefined) {
    if (!Number.isInteger(changes.minutesToSla) || changes.minutesToSla < -100000 || changes.minutesToSla > 100000) throw new Error('Invalid SLA value.')
    patch.minutes_to_sla = changes.minutesToSla
    result.minutesToSla = changes.minutesToSla
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

export async function saveDuplicateDecisionAction(firstNumber: string, secondNumber: string, decision: 'confirmed' | 'rejected') {
  if (!/^CMP-\d{5}$/.test(firstNumber) || !/^CMP-\d{5}$/.test(secondNumber) || firstNumber === secondNumber || !['confirmed', 'rejected'].includes(decision)) {
    throw new Error('Invalid duplicate decision.')
  }
  const { supabase, user } = await requireUser()
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
