import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { diagnoseAuthCallback, logAuthDiagnostic } from '@/lib/auth-callback-diagnostic'

function redirectTo(request: NextRequest, next: string, diagnostic?: string) {
  const origin = request.nextUrl.origin
  const destination = new URL(next, origin)
  const safeDestination = destination.origin === origin ? destination : new URL('/', origin)
  if (diagnostic && process.env.NODE_ENV === 'development') safeDestination.searchParams.set('authError', `callback-${diagnostic}`)
  return NextResponse.redirect(safeDestination)
}

function logRedirect(success: boolean, redirectTarget: 'safe-next' | 'root-error' | 'local-diagnostic') {
  logAuthDiagnostic({ stage: 'redirect', success, supabaseErrorCode: null, httpStatus: 307, redirectTarget })
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  if (!code) {
    logAuthDiagnostic({ stage: 'code-parse', success: false, supabaseErrorCode: null, httpStatus: null })
    const redirectTarget = process.env.NODE_ENV === 'development' ? 'local-diagnostic' : 'root-error'
    logRedirect(false, redirectTarget)
    const response = redirectTo(request, '/', 'missing-code')
    if (process.env.NODE_ENV !== 'development') response.headers.set('location', new URL('/?authError=callback', origin).toString())
    return response
  }
  let cookieWriteFailed = false
  const supabase = await createClient(() => {
    cookieWriteFailed = true
    logAuthDiagnostic({ stage: 'cookie-write', success: false, supabaseErrorCode: null, httpStatus: null })
  })
  const result = await diagnoseAuthCallback({
    code,
    exchange: async (authorizationCode) => {
      const { error } = await supabase.auth.exchangeCodeForSession(authorizationCode)
      return { error }
    },
    getUser: async () => {
      const { data, error } = await supabase.auth.getUser()
      return { user: data.user ? { id: data.user.id } : null, error }
    },
    findProfile: async (userId) => {
      const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
      return { exists: Boolean(data), error }
    },
  })

  if (result.outcome === 'success') {
    // Next 16 merges cookies() writes into this Route Handler redirect response.
    const redirectTarget = cookieWriteFailed && process.env.NODE_ENV === 'development' ? 'local-diagnostic' : 'safe-next'
    logRedirect(!cookieWriteFailed, redirectTarget)
    return redirectTo(request, next, cookieWriteFailed ? 'cookie-write-failed' : undefined)
  }

  const diagnostic = result.outcome
  if (process.env.NODE_ENV !== 'development' && result.outcome !== 'missing-code' && result.outcome !== 'exchange-failed') {
    logRedirect(false, 'safe-next')
    return redirectTo(request, next)
  }
  const failureDestination = result.outcome === 'missing-code' || result.outcome === 'exchange-failed' ? '/' : next
  logRedirect(false, process.env.NODE_ENV === 'development' ? 'local-diagnostic' : 'root-error')
  const response = redirectTo(request, failureDestination, diagnostic)
  if (process.env.NODE_ENV !== 'development') response.headers.set('location', new URL('/?authError=callback', origin).toString())
  return response
}
