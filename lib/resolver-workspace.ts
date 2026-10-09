import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { mapWorkspace, type ResolverWorkspace } from '@/components/resolver/data-mappers'
import { logWorkspaceDiagnostic, WorkspaceLoadError, type WorkspaceStage } from '@/lib/workspace-diagnostic'

const complaintColumns = 'id,complaint_number,subject,customer_ref,channel,category,severity,sentiment,assigned_to,status,minutes_to_sla,received_at,sla_due_at,resolved_at,message,summary,recommended_action,response_draft,triage_status,triage_source,triage_category,triage_product,triage_severity,triage_sentiment,triage_language,triage_summary,triage_recommended_action,triage_possible_fraud,triage_fraud_reason,triage_confidence,triage_explanation,triage_error,triage_updated_at,triage_reviewed_at'

export async function loadResolverWorkspace(): Promise<ResolverWorkspace> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) {
    logWorkspaceDiagnostic('auth', userError)
    throw new WorkspaceLoadError('auth')
  }
  if (!user) return { profile: null, complaints: [], team: [], articles: [], duplicateDecisions: {}, slaRules: { standardFirstResponseHours: 4, criticalResponseHours: 1, escalationElapsedPercent: 75 } }

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id,display_name,role')
  if (profileError) {
    logWorkspaceDiagnostic('profile-query', profileError)
    throw new WorkspaceLoadError('profile-query')
  }

  const [complaints, events, duplicates, articles, settings] = await Promise.all([
    supabase.from('complaints').select(complaintColumns).order('received_at', { ascending: false }),
    supabase.from('complaint_events').select('complaint_id,event_type,title,detail,created_at').order('created_at', { ascending: true }),
    supabase.from('duplicate_links').select('complaint_a_id,complaint_b_id,status'),
    supabase.from('knowledge_base').select('id,title,category,content,updated_at').order('title'),
    supabase.from('workspace_settings').select('standard_first_response_hours,critical_response_hours,escalation_elapsed_percent').eq('id', true).maybeSingle(),
  ])
  const queryResults: [WorkspaceStage, { error: unknown | null }][] = [
    ['complaints-query', complaints], ['events-query', events], ['duplicates-query', duplicates],
    ['knowledge-query', articles], ['settings-query', settings],
  ]
  const failedQueries = queryResults.filter(([, result]) => result.error)
  if (failedQueries.length) {
    for (const [stage, result] of failedQueries) logWorkspaceDiagnostic(stage, result.error)
    throw new WorkspaceLoadError(failedQueries[0][0])
  }

  const workspace = mapWorkspace(user.id, profileRows ?? [], complaints.data ?? [], events.data ?? [], duplicates.data ?? [], articles.data ?? [], settings.data)
  if (!workspace.profile) {
    logWorkspaceDiagnostic('profile-match', { code: 'profile_missing' })
    return { ...workspace, errorStage: 'profile' }
  }
  return workspace
}
