import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadCustomerProfileAction } from '@/app/actions/customer'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/customer/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'customer') redirect('/')
  const customer = await loadCustomerProfileAction()
  return <main className="min-h-screen bg-[#f5f7fb] p-5"><section className="mx-auto mt-12 max-w-2xl rounded-xl border border-slate-200 bg-white p-6"><Link href="/customer/dashboard" className="text-sm text-blue-700">← My complaints</Link><h1 className="mt-5 text-2xl font-semibold">My profile</h1><p className="mt-5 text-sm text-slate-500">Name</p><p className="mt-1">{customer.displayName}</p><p className="mt-4 text-sm text-slate-500">Email address</p><p className="mt-1">{customer.email}</p><p className="mt-6 text-sm text-slate-600">To change your account details, contact customer care through your complaint conversation.</p></section></main>
}
