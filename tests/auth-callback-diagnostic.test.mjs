import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseAuthCallback } from '../lib/auth-callback-diagnostic.ts'

test('diagnoses a missing code without attempting an exchange', async () => {
  const diagnostics = []
  const result = await diagnoseAuthCallback({
    code: null,
    exchange: async () => { throw new Error('must not exchange') },
    getUser: async () => { throw new Error('must not fetch user') },
    findProfile: async () => { throw new Error('must not query profile') },
    log: (event) => diagnostics.push(event),
  })
  assert.deepEqual(result, { outcome: 'missing-code' })
  assert.deepEqual(diagnostics, [{ stage: 'code-parse', success: false, supabaseErrorCode: null, httpStatus: null }])
})

test('diagnoses a code exchange failure with only its safe code and status', async () => {
  const diagnostics = []
  const result = await diagnoseAuthCallback({
    code: 'sensitive-code-never-logged',
    exchange: async () => ({ error: { code: 'invalid_grant', status: 400, message: 'private error text' } }),
    getUser: async () => ({ user: null, error: null }),
    findProfile: async () => ({ exists: false, error: null }),
    log: (event) => diagnostics.push(event),
  })
  assert.deepEqual(result, { outcome: 'exchange-failed' })
  assert.deepEqual(diagnostics, [{ stage: 'code-exchange', success: false, supabaseErrorCode: 'invalid_grant', httpStatus: 400 }])
  assert.equal(JSON.stringify(diagnostics).includes('sensitive-code'), false)
  assert.equal(JSON.stringify(diagnostics).includes('private error text'), false)
})

test('diagnoses successful exchange, authenticated user, and matching profile', async () => {
  const diagnostics = []
  const calls = []
  const result = await diagnoseAuthCallback({
    code: 'sensitive-code-never-logged',
    exchange: async () => { calls.push('exchange'); return { error: null } },
    getUser: async () => { calls.push('get-user'); return { user: { id: 'user-id-never-logged' }, error: null } },
    findProfile: async (id) => { calls.push(id); return { exists: true, error: null } },
    log: (event) => diagnostics.push(event),
  })
  assert.deepEqual(result, { outcome: 'success' })
  assert.deepEqual(calls, ['exchange', 'get-user', 'user-id-never-logged'])
  assert.deepEqual(diagnostics.map(({ stage, success }) => ({ stage, success })), [
    { stage: 'code-exchange', success: true },
    { stage: 'get-user', success: true },
    { stage: 'workspace-profile', success: true },
  ])
  assert.equal(JSON.stringify(diagnostics).includes('user-id-never-logged'), false)
})

test('distinguishes an authenticated user with no workspace profile', async () => {
  const diagnostics = []
  const result = await diagnoseAuthCallback({
    code: 'sensitive-code-never-logged',
    exchange: async () => ({ error: null }),
    getUser: async () => ({ user: { id: 'user-id' }, error: null }),
    findProfile: async () => ({ exists: false, error: null }),
    log: (event) => diagnostics.push(event),
  })
  assert.deepEqual(result, { outcome: 'profile-missing' })
  assert.equal(diagnostics.at(-1).stage, 'workspace-profile')
  assert.equal(diagnostics.at(-1).success, false)
})
