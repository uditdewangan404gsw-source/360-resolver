'use server'

import { createClient } from '@/lib/supabase/server'
import type { CustomerComplaint, CustomerEvent, CustomerMessage } from '@/lib/customer-portal'

async function requireCustomer() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Please sign in to continue.')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,display_name,role').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.role !== 'customer') throw new Error('This page is available to customer accounts only.')
  return { supabase, user, profile }
}

export async function loadCustomerComplaintsAction() {
  const { supabase } = await requireCustomer()
  const { data, error } = await supabase.rpc('get_customer_complaints')
  if (error) throw new Error('Your complaints could not be loaded. Please try again.')
  return (data ?? []) as CustomerComplaint[]
}

export async function loadLatestCustomerCareReplyAction(complaints: CustomerComplaint[]) {
  const { supabase } = await requireCustomer()
  const ids = complaints.map((item) => item.id)
  if (!ids.length) return null
  const { data, error } = await supabase.from('customer_messages').select('body,created_at')
    .in('complaint_id', ids).eq('sender_kind', 'staff').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('The latest customer-care response could not be loaded.')
  return data
}

export async function loadCustomerCaseAction(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('This complaint could not be found.')
  const { supabase } = await requireCustomer()
  const { data, error } = await supabase.rpc('get_customer_complaints')
  if (error) throw new Error('This complaint could not be loaded.')
  const complaint = ((data ?? []) as CustomerComplaint[]).find((item) => item.id === id)
  if (!complaint) throw new Error('This complaint could not be found.')
  const [{ data: eventData, error: eventError }, { data: messageData, error: messageError }] = await Promise.all([
    supabase.rpc('get_customer_complaint_events', { p_complaint_id: id }),
    supabase.from('customer_messages').select('id,sender_kind,body,created_at').eq('complaint_id', id).order('created_at'),
  ])
  if (eventError || messageError) throw new Error('The case updates could not be loaded.')
  return { complaint, events: (eventData ?? []) as CustomerEvent[], messages: (messageData ?? []) as CustomerMessage[] }
}

export async function submitCustomerComplaintAction(input: {
  submissionKey: string; subject: string; category: string; product: string; description: string
  transactionDate?: string; transactionAmount?: string; transactionReference?: string
}) {
  const { supabase } = await requireCustomer()
  if (!/^[0-9a-f-]{36}$/i.test(input.submissionKey) || input.subject.trim().length < 1 || input.subject.trim().length > 120 ||
      input.category.trim().length < 1 || input.category.length > 100 || input.product.length > 60 || input.description.trim().length < 10 || input.description.length > 10000) {
    throw new Error('Review the complaint details and try again.')
  }
  const amount = input.transactionAmount?.trim() ? Number(input.transactionAmount) : null
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error('Enter a valid transaction amount.')
  const { data, error } = await supabase.rpc('submit_customer_complaint', {
    p_submission_key: input.submissionKey, p_subject: input.subject.trim(), p_category: input.category.trim(),
    p_product: input.product.trim(), p_description: input.description.trim(),
    p_transaction_date: input.transactionDate || null, p_transaction_amount: amount,
    p_transaction_reference: input.transactionReference?.trim() || null,
  })
  if (error || !data?.[0]) throw new Error('Your complaint could not be submitted. Your details have not been confirmed as saved.')
  return data[0] as { id: string; complaint_number: string; received_at: string; status: string; sla_due_at: string }
}

export async function replyToCustomerCaseAction(id: string, body: string) {
  const { supabase, user } = await requireCustomer()
  if (!/^[0-9a-f-]{36}$/i.test(id) || body.trim().length < 1 || body.trim().length > 5000) throw new Error('Enter a message of up to 5,000 characters.')
  const { error } = await supabase.from('customer_messages').insert({
    complaint_id: id, sender_id: user.id, sender_kind: 'customer', body: body.trim(),
  })
  if (error) throw new Error('Your message could not be sent. Please try again.')
}

export async function loadCustomerProfileAction() {
  const { profile, user } = await requireCustomer()
  return { displayName: profile.display_name, email: user.email ?? '' }
}
