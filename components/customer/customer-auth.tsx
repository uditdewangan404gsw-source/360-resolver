'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function CustomerAuth({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const supabase = createClient()
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: {
          data: { full_name: name.trim(), account_type: 'customer' },
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback?next=/customer/dashboard`,
        } })
        if (error) throw error
        setSent(true); setMessage('Check your inbox to confirm your email. You can sign in after confirmation.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        router.replace('/customer/dashboard'); router.refresh()
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication could not be completed.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-[#f4f7fb] px-4 py-12"><div className="mx-auto max-w-md"><Link href="/customer/login" className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-blue-700 text-lg font-semibold text-white">360</span><span><b className="block text-slate-950">360° Resolver</b><small className="text-slate-500">Customer care portal</small></span></Link><section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Secure complaint tracking</p><h1 className="mt-3 text-2xl font-semibold text-slate-950">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1><p className="mt-2 text-sm text-slate-600">{mode === 'register' ? 'Register to submit and follow your banking complaints.' : 'Sign in to follow your complaints and contact customer care.'}</p><form onSubmit={submit} className="mt-6 space-y-4">{mode === 'register' && <label className="block text-sm font-medium text-slate-700">Full name<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>}<label className="block text-sm font-medium text-slate-700">Email address<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Password<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p role={sent ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${sent ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{message}</p>}<button disabled={busy} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button></form><p className="mt-5 text-center text-sm text-slate-600">{mode === 'register' ? 'Already registered?' : 'New to the portal?'}{' '}<Link className="font-semibold text-blue-700" href={mode === 'register' ? '/customer/login' : '/customer/register'}>{mode === 'register' ? 'Sign in' : 'Create an account'}</Link></p></section><p className="mt-5 text-center text-xs text-slate-500">Never share your password, PIN, OTP, CVV, or full card number in a complaint.</p></div></main>
}
