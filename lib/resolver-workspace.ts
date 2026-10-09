import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { mapWorkspace, type ResolverWorkspace } from '@/components/resolver/data-mappers'

const complaintColumns = 'id,complaint_number,subject,customer_ref,channel,category,severity,sentiment,assigned_to,status,minutes_to_sla,received_at,message,summary,recommended_action,response_draft'

export async function loadResolverWorkspace(): Promise<ResolverWorkspace> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { profile: null, complaints: [], team: [], articles: [], duplicateDecisions: {} }

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id,display_name,role')
  if (profileError) throw profileError

  const [complaints, events, duplicates, articles] = await Promise.all([
    supabase.from('complaints').select(complaintColumns).order('received_at', { ascending: false }),
    supabase.from('complaint_events').select('complaint_id,event_type,title,detail,created_at').order('created_at', { ascending: true }),
    supabase.from('duplicate_links').select('complaint_a_id,complaint_b_id,status'),
    supabase.from('knowledge_base').select('id,title,category,content,updated_at').order('title'),
  ])
  const queryError = complaints.error ?? events.error ?? duplicates.error ?? articles.error
  if (queryError) throw queryError

  return mapWorkspace(user.id, profileRows ?? [], complaints.data ?? [], events.data ?? [], duplicates.data ?? [], articles.data ?? [])
}
