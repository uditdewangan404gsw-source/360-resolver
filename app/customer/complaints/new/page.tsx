import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewCustomerComplaint } from '@/components/customer/customer-portal'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/customer/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'customer') redirect('/')
  return <NewCustomerComplaint />
}
