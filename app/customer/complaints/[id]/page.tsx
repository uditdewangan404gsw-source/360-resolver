import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCustomerCaseAction } from '@/app/actions/customer'
import { CustomerCase } from '@/components/customer/customer-portal'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/customer/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'customer') redirect('/')
  const result = await loadCustomerCaseAction(id).catch(() => null)
  if (!result) notFound()
  return <CustomerCase complaint={result.complaint} events={result.events} initialMessages={result.messages} />
}
