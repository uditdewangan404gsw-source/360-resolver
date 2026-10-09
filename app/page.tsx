import { ResolverApp } from '@/components/resolver/resolver-app'
import { loadResolverWorkspace } from '@/lib/resolver-workspace'
import type { ResolverWorkspace } from '@/components/resolver/data-mappers'
import { WorkspaceLoadError } from '@/lib/workspace-diagnostic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const developmentAuthErrors: Record<string, string> = {
  'callback-missing-code': 'Diagnostic: the confirmation callback arrived without a code parameter.',
  'callback-exchange-failed': 'Diagnostic: Supabase rejected the authorization code exchange. See the server diagnostic fields.',
  'callback-user-missing': 'Diagnostic: exchange returned, but getUser did not find an authenticated user.',
  'callback-profile-check-failed': 'Diagnostic: the user was found, but the workspace profile query failed.',
  'callback-profile-missing': 'Diagnostic: the user was found, but no matching workspace profile exists.',
  'callback-cookie-write-failed': 'Diagnostic: cookieStore.set threw during the exchange; the exception was caught by the shared client.',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ authError?: string; audience?: string; mode?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'customer') redirect('/customer/dashboard')
  }
  const [{ authError, audience, mode }, workspace] = await Promise.all([searchParams, loadResolverWorkspace().catch((error): ResolverWorkspace => ({
    profile: null,
    complaints: [],
    team: [],
    articles: [],
    duplicateDecisions: {},
    slaRules: { standardFirstResponseHours: 4, criticalResponseHours: 1, escalationElapsedPercent: 75 },
    error: 'The requested workspace data could not be loaded.',
    errorStage: error instanceof WorkspaceLoadError
      ? error.stage === 'auth' ? 'auth' : error.stage === 'profile-query' ? 'profile' : 'workspace'
      : 'workspace',
  }))])

  const errorMessage = authError === 'callback'
    ? 'callback'
    : process.env.NODE_ENV === 'development' ? developmentAuthErrors[authError ?? ''] : undefined
  return <ResolverApp
    key={workspace.profile?.id ?? 'signed-out'}
    workspace={workspace}
    initialAuthError={errorMessage}
    initialAuthAudience={audience === 'customer' ? 'customer' : 'agent'}
    initialAuthMode={mode === 'sign-up' ? 'sign-up' : 'sign-in'}
  />
}
