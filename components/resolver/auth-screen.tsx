'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type AuthMode = 'sign-in' | 'sign-up'

function getAuthMessage(message: string, mode: AuthMode, status?: number) {
  const normalized = message.toLowerCase()
  if (status === 429) return 'Too many attempts. Wait a moment before trying again.'
  if (normalized.includes('not confirmed') || normalized.includes('email not confirmed')) return 'Confirm your email using the link we sent, then sign in.'
  if (normalized.includes('weak password') || normalized.includes('password should')) return 'Choose a stronger password and try again.'
  if (mode === 'sign-up' && (normalized.includes('invalid email') || normalized.includes('valid email'))) return 'Enter a valid email address.'
  if (mode === 'sign-in' && (normalized.includes('invalid login') || normalized.includes('invalid email or password'))) return 'Invalid email or password.'
  return 'We could not complete sign-in. Please try again or contact your workspace administrator.'
}

export function AuthScreen({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState(initialError ? 'We could not complete the email confirmation. Please try again.' : '')
  const [busy, setBusy] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setConfirmationPending(false)
    setBusy(true)

    try {
      const supabase = createClient()
      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
            data: { full_name: displayName.trim() },
          },
        })
        if (error) throw error
        setConfirmationPending(true)
        setMessage('Check your email for a confirmation link. New accounts receive the agent role; a workspace manager must grant manager access.')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      router.refresh()
    } catch (error) {
      const authError = error as { message?: string; status?: number }
      setMessage(getAuthMessage(authError.message ?? '', mode, authError.status))
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-screen"><div className="login-brand"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,90,197,.25)]"><ShieldCheck className="size-5" /></div><div><div className="text-[15px] font-semibold tracking-tight text-slate-900">360° Resolver</div><div className="text-[10px] text-slate-500">COMPLAINT OPERATIONS PLATFORM</div></div></div><section className="login-card"><div className="mb-7"><span className="login-kicker">SECURE WORKSPACE</span><h1 className="mt-3 text-[26px] font-semibold tracking-[-0.045em] text-slate-950">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1><p className="mt-2 text-[12px] leading-relaxed text-slate-500">{mode === 'sign-in' ? 'Sign in to access your organization’s complaint workspace.' : 'Create an account to request access to the complaint workspace.'}</p></div><form className="flex flex-col gap-4" onSubmit={submit}>{mode === 'sign-up' && <label className="field-block"><span>Full name</span><input autoComplete="name" maxLength={100} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}<label className="field-block"><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field-block"><span>Password</span><input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p role="status" className={`rounded-md border px-3 py-2.5 text-[11px] leading-relaxed ${confirmationPending ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message}</p>}<Button disabled={busy} className="mt-1 h-9 w-full rounded-md bg-[#2459c5] text-[12px] hover:bg-[#1d4ca8]">{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</Button></form><p className="mt-5 text-center text-[11px] text-slate-500">{mode === 'sign-in' ? 'Need an account?' : 'Already have an account?'}{' '}<button type="button" className="font-semibold text-blue-700 hover:text-blue-900" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); setConfirmationPending(false) }}>{mode === 'sign-in' ? 'Create one' : 'Sign in'}</button></p><div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] leading-relaxed text-slate-600">Your account and role are managed by this workspace. Registration does not grant manager privileges.</div></section></main>
}
