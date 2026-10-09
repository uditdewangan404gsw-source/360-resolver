export type AuthDiagnostic = {
  stage: 'code-parse' | 'code-exchange' | 'get-user' | 'workspace-profile' | 'cookie-write' | 'redirect'
  success: boolean
  supabaseErrorCode: string | null
  httpStatus: number | null
  redirectTarget?: 'safe-next' | 'root-error' | 'local-diagnostic'
}

type SafeError = { code?: unknown; status?: unknown }

function safeErrorFields(error: unknown) {
  const candidate = error && typeof error === 'object' ? error as SafeError : {}
  const code = typeof candidate.code === 'string' && /^[a-z0-9_-]{1,64}$/i.test(candidate.code)
    ? candidate.code
    : null
  const status = typeof candidate.status === 'number' && Number.isInteger(candidate.status) && candidate.status >= 100 && candidate.status <= 599
    ? candidate.status
    : null
  return { supabaseErrorCode: code, httpStatus: status }
}

export function logAuthDiagnostic(diagnostic: AuthDiagnostic) {
  if (process.env.NODE_ENV === 'development') console.info('[auth-diagnostic]', diagnostic)
}

export type AuthCallbackResult =
  | { outcome: 'missing-code' }
  | { outcome: 'exchange-failed' }
  | { outcome: 'user-missing' }
  | { outcome: 'profile-check-failed' }
  | { outcome: 'profile-missing' }
  | { outcome: 'success' }

export async function diagnoseAuthCallback(input: {
  code: string | null
  exchange: (code: string) => Promise<{ error: unknown | null }>
  getUser: () => Promise<{ user: { id: string } | null; error: unknown | null }>
  findProfile: (userId: string) => Promise<{ exists: boolean; error: unknown | null }>
  log?: (diagnostic: AuthDiagnostic) => void
}): Promise<AuthCallbackResult> {
  const log = input.log ?? logAuthDiagnostic
  if (!input.code) {
    log({ stage: 'code-parse', success: false, supabaseErrorCode: null, httpStatus: null })
    return { outcome: 'missing-code' }
  }

  try {
    const { error } = await input.exchange(input.code)
    log({ stage: 'code-exchange', success: !error, ...safeErrorFields(error) })
    if (error) return { outcome: 'exchange-failed' }
  } catch (error) {
    log({ stage: 'code-exchange', success: false, ...safeErrorFields(error) })
    return { outcome: 'exchange-failed' }
  }

  let user: { id: string } | null
  try {
    const result = await input.getUser()
    user = result.user
    log({ stage: 'get-user', success: Boolean(user && !result.error), ...safeErrorFields(result.error) })
    if (!user || result.error) return { outcome: 'user-missing' }
  } catch (error) {
    log({ stage: 'get-user', success: false, ...safeErrorFields(error) })
    return { outcome: 'user-missing' }
  }

  try {
    const result = await input.findProfile(user.id)
    log({ stage: 'workspace-profile', success: result.exists && !result.error, ...safeErrorFields(result.error) })
    if (result.error) return { outcome: 'profile-check-failed' }
    if (!result.exists) return { outcome: 'profile-missing' }
  } catch (error) {
    log({ stage: 'workspace-profile', success: false, ...safeErrorFields(error) })
    return { outcome: 'profile-check-failed' }
  }

  return { outcome: 'success' }
}
