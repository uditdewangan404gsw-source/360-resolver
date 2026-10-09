import { ResolverApp } from '@/components/resolver/resolver-app'
import { loadResolverWorkspace } from '@/lib/resolver-workspace'
import type { ResolverWorkspace } from '@/components/resolver/data-mappers'

export default async function Page({ searchParams }: { searchParams: Promise<{ authError?: string }> }) {
  const [{ authError }, workspace] = await Promise.all([searchParams, loadResolverWorkspace().catch((): ResolverWorkspace => ({
    profile: null,
    complaints: [],
    team: [],
    articles: [],
    duplicateDecisions: {},
    error: 'The workspace data could not be loaded. Check the Supabase table access and row-level security policies.',
  }))])

  return <ResolverApp key={workspace.profile?.id ?? 'signed-out'} workspace={workspace} initialAuthError={authError === 'callback' ? 'We could not complete the email confirmation. Please request a new link and try again.' : undefined} />
}
