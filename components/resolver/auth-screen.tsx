'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthMessage, getInitialAuthMessage, logAuthClientError } from '@/lib/auth-screen-message'
import { Button } from '@/components/ui/button'
import { BrandLockup } from '@/components/brand-lockup'

type AuthMode = 'sign-in' | 'sign-up'
type Audience = 'customer' | 'agent'

function confirmationUrl(next: string) {
  const fallback = `${window.location.origin}/auth/callback`
  const callback = new URL(process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? fallback, window.location.origin)
  callback.searchParams.set('next', next)
  return callback.toString()
}

export function AuthScreen({
  initialError,
  initialAudience = 'agent',
  initialMode = 'sign-in',
}: {
  initialError?: string
  initialAudience?: Audience
  initialMode?: AuthMode
}) {
  const router = useRouter()
  const [audience, setAudience] = useState<Audience>(initialAudience)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState(() => getInitialAuthMessage(initialError))
  const [busy, setBusy] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)

  useEffect(() => {
    setMessage(getInitialAuthMessage(initialError))
  }, [initialError])

  function selectAudience(value: Audience) {
    setAudience(value)
    setMessage('')
    setConfirmationPending(false)
  }

  function selectMode(value: AuthMode) {
    setMode(value)
    setMessage('')
    setConfirmationPending(false)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setConfirmationPending(false)
    setBusy(true)

    try {
      const supabase = createClient()
      if (mode === 'sign-up') {
        if (audience === 'agent') {
          setMessage('Agent accounts are provisioned by a workspace administrator. Contact your administrator to request staff access.')
          return
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: confirmationUrl('/customer/dashboard'),
            data: { full_name: displayName.trim(), account_type: 'customer' },
          },
        })
        if (error) throw error
        setConfirmationPending(true)
        setMessage('Check your email to confirm your account. You can sign in to the customer portal after confirmation.')
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      if (!data.session) throw new Error('Sign-in did not create a session.')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()
      if (profileError || !profile) {
        await supabase.auth.signOut()
        throw new Error('Your account role could not be verified. Please try again or contact support.')
      }

      const isCustomer = profile.role === 'customer'
      if ((audience === 'customer' && !isCustomer) || (audience === 'agent' && isCustomer)) {
        await supabase.auth.signOut()
        setMessage(isCustomer
          ? 'This is a customer account. Choose Customer above to sign in.'
          : 'This is a staff account. Choose Agent above to sign in.')
        return
      }

      router.replace(isCustomer ? '/customer/dashboard' : '/')
      router.refresh()
    } catch (error) {
      logAuthClientError(mode === 'sign-in' ? 'signInWithPassword' : 'signUp', error)
      setMessage(getAuthMessage(error as { message?: unknown; status?: unknown; code?: unknown; name?: unknown }, mode))
    } finally {
      setBusy(false)
    }
  }

  const agentSignup = mode === 'sign-up' && audience === 'agent'

  return (
    <main className="login-screen">
      <BrandLockup className="login-brand" subtitle="COMPLAINT RESOLUTION PORTAL" size={46} />

      <section className="login-card">
        <div className="mb-6">
          <span className="login-kicker">SECURE ACCESS</span>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.045em] text-slate-950">
            {mode === 'sign-in' ? 'Welcome back' : audience === 'customer' ? 'Create your account' : 'Staff access'}
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
            {mode === 'sign-in'
              ? audience === 'customer'
                ? 'Sign in to track your complaints and contact customer care.'
                : 'Sign in to your complaint operations workspace.'
              : audience === 'customer'
                ? 'Register to submit and follow your banking complaints.'
                : 'Staff access is managed by your workspace administrator.'}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Choose account type">
          {(['customer', 'agent'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={audience === value}
              onClick={() => selectAudience(value)}
              className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${audience === value ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {value === 'customer' ? 'Customer' : 'Agent'}
            </button>
          ))}
        </div>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          {mode === 'sign-up' && audience === 'customer' && (
            <label className="field-block">
              <span>Full name</span>
              <input autoComplete="name" maxLength={100} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          )}
          {!agentSignup && <>
            <label className="field-block">
              <span>Email address</span>
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-block">
              <span>Password</span>
              <input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          </>}

          {agentSignup && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-900" role="status">
              Agent accounts are created or approved by a workspace administrator. The account type toggle cannot grant staff permissions.
            </div>
          )}

          {message && <p role={confirmationPending ? 'status' : 'alert'} aria-live={confirmationPending ? 'polite' : 'assertive'} className={`rounded-md border px-3 py-2.5 text-[11px] leading-relaxed ${confirmationPending ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message}</p>}

          {!agentSignup && (
            <Button type="submit" disabled={busy} className="mt-1 h-10 w-full rounded-md bg-[#2459c5] text-[12px] hover:bg-[#1d4ca8]">
              {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create customer account'}
            </Button>
          )}
        </form>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          {mode === 'sign-in' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button type="button" className="font-semibold text-blue-700 hover:text-blue-900" onClick={() => selectMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
            {mode === 'sign-in' ? 'Create one' : 'Sign in'}
          </button>
        </p>
        {mode === 'sign-up' && audience === 'customer' && (
          <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-500">Never share your password, PIN, OTP, CVV, or full card number in a complaint.</p>
        )}
      </section>
    </main>
  )
}
