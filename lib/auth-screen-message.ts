export type AuthMode = 'sign-in' | 'sign-up'

export type AuthIssue = {
  message?: unknown
  status?: unknown
  code?: unknown
  name?: unknown
}

function normalizedText(value: unknown) {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

export function getAuthMessage(error: AuthIssue, mode: AuthMode) {
  const message = normalizedText(error.message)
  const code = normalizedText(error.code)
  const status = typeof error.status === 'number' ? error.status : undefined

  if (status === 429 || /rate.?limit|too_many_requests|over_request_rate_limit|over_email_send_rate_limit/.test(code) || /rate.?limit|too many requests/.test(message)) {
    return 'Too many attempts. Please wait before trying again.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please confirm your email using the link we sent, then sign in.'
  }
  if (error.name === 'TypeError' || status !== undefined && status >= 500 || /fetch|network|timeout|temporar|server error/.test(message)) {
    return 'We could not reach the sign-in service. Please try again.'
  }
  if (error.code === 'weak_password' || message.includes('weak password') || message.includes('password should')) {
    return 'Choose a stronger password and try again.'
  }
  if (mode === 'sign-up' && (error.code === 'email_address_invalid' || message.includes('invalid email') || message.includes('valid email'))) {
    return 'Enter a valid email address.'
  }
  if (mode === 'sign-in' && (error.code === 'invalid_credentials' || message.includes('invalid login') || message.includes('invalid email or password'))) {
    return 'Incorrect email or password.'
  }
  return mode === 'sign-in'
    ? 'We could not complete sign-in. Please try again.'
    : 'We could not complete sign-up. Please try again.'
}

export function getInitialAuthMessage(initialError?: string, environment = process.env.NODE_ENV) {
  if (!initialError) return ''
  if (initialError.startsWith('Diagnostic:')) {
    return environment === 'development' ? initialError : 'We could not complete the email confirmation. Please try again.'
  }
  if (initialError === 'callback') return 'We could not complete the email confirmation. Please request a new link and try again.'
  if (initialError === 'workspace') return 'We could not load your workspace. Please try again.'
  if (initialError === 'auth') return 'We could not verify your sign-in session. Please sign in again.'
  if (initialError === 'profile') return 'Your account does not have a workspace profile. Ask a workspace manager to restore access.'
  return ''
}

export function logAuthClientError(operation: 'signInWithPassword' | 'signUp', error: unknown) {
  if (process.env.NODE_ENV !== 'development') return
  const candidate = error && typeof error === 'object' ? error as AuthIssue : {}
  const errorName = typeof candidate.name === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(candidate.name) ? candidate.name : null
  const errorCode = typeof candidate.code === 'string' && /^[a-z0-9_-]{1,64}$/i.test(candidate.code) ? candidate.code : null
  const httpStatus = typeof candidate.status === 'number' && Number.isInteger(candidate.status) && candidate.status >= 100 && candidate.status <= 599 ? candidate.status : null
  console.info('[auth-client-diagnostic]', { operation, errorName, errorCode, httpStatus })
}
