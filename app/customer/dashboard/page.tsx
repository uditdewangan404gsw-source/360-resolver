import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCustomerComplaintsAction, loadLatestCustomerCareReplyAction } from '@/app/actions/customer'
import { CustomerDashboard } from '@/components/customer/customer-portal'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/customer/login')
  const { data: profile } = await supabase.from('profiles').select('display_name,role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'customer') redirect('/')
  const complaints = await loadCustomerComplaintsAction().catch(() => null)
  if (!complaints) return <main className="p-8"><p role="alert">Your complaints could not be loaded. Refresh to try again.</p></main>
  const latestReply = await loadLatestCustomerCareReplyAction(complaints).catch(() => null)
  return <CustomerDashboard initial={complaints} latestReply={latestReply} displayName={profile.display_name} />
}
