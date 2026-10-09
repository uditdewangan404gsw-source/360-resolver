import test from 'node:test'
import assert from 'node:assert/strict'
import { logTriageDiagnostic } from '../lib/triage-diagnostic.ts'

test('triage diagnostics log only safe failure metadata in development', () => {
  const originalEnvironment = process.env.NODE_ENV
  const originalInfo = console.info
  let logged
  process.env.NODE_ENV = 'development'
  console.info = (...args) => { logged = args }
  try {
    logTriageDiagnostic('processing-claim', {
      code: '42501', status: 403, name: 'PostgrestError',
      message: 'private complaint data', token: 'sensitive-value',
    })
  } finally {
    console.info = originalInfo
    if (originalEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnvironment
  }
  assert.deepEqual(logged, ['[triage-diagnostic]', {
    stage: 'processing-claim', success: false, outcome: null,
    errorCode: '42501', httpStatus: 403, errorName: 'PostgrestError',
  }])
})

test('triage diagnostic logger is silent in production', () => {
  const originalEnvironment = process.env.NODE_ENV
  const originalInfo = console.info
  let logged = false
  process.env.NODE_ENV = 'production'
  console.info = () => { logged = true }
  try { logTriageDiagnostic('classification', new Error('sensitive')) }
  finally {
    console.info = originalInfo
    if (originalEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnvironment
  }
  assert.equal(logged, false)
})
