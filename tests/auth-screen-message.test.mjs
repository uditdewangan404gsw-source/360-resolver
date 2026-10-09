import test from 'node:test'
import assert from 'node:assert/strict'
import { getAuthMessage, getInitialAuthMessage } from '../lib/auth-screen-message.ts'

test('shows safe stage-specific diagnostics in development', () => {
  const message = 'Diagnostic: the user session was found, but no matching workspace profile exists.'
  assert.equal(getInitialAuthMessage(message, 'development'), message)
})

test('keeps confirmation errors generic outside development', () => {
  assert.equal(
    getInitialAuthMessage('Diagnostic: internal detail', 'production'),
    'We could not complete the email confirmation. Please try again.',
  )
})

test('clears the initial message when there is no active diagnostic', () => {
  assert.equal(getInitialAuthMessage(undefined, 'development'), '')
})

test('maps invalid password credentials without claiming email confirmation failed', () => {
  assert.equal(getAuthMessage({ code: 'invalid_credentials' }, 'sign-in'), 'Incorrect email or password.')
})

test('asks users to confirm only when Supabase reports an unconfirmed email', () => {
  assert.equal(getAuthMessage({ code: 'email_not_confirmed' }, 'sign-in'), 'Please confirm your email using the link we sent, then sign in.')
})

test('maps HTTP and coded rate limits to the retry message', () => {
  assert.equal(getAuthMessage({ status: 429 }, 'sign-in'), 'Too many attempts. Please wait before trying again.')
  assert.equal(getAuthMessage({ code: 'over_request_rate_limit' }, 'sign-in'), 'Too many attempts. Please wait before trying again.')
})

test('callback errors are rendered only from callback state and do not alter password error mapping', () => {
  assert.equal(getInitialAuthMessage('callback', 'production'), 'We could not complete the email confirmation. Please request a new link and try again.')
  assert.equal(getAuthMessage({ code: 'invalid_credentials' }, 'sign-in'), 'Incorrect email or password.')
  assert.equal(getInitialAuthMessage('workspace', 'production'), 'We could not load your workspace. Please try again.')
})
