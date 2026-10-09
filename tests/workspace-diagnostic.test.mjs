import test from 'node:test'
import assert from 'node:assert/strict'
import { logWorkspaceDiagnostic, WorkspaceLoadError } from '../lib/workspace-diagnostic.ts'

test('workspace diagnostics retain only stage, safe code, and HTTP status', () => {
  const originalEnvironment = process.env.NODE_ENV
  const originalInfo = console.info
  let logged
  process.env.NODE_ENV = 'development'
  console.info = (...args) => { logged = args }
  try {
    logWorkspaceDiagnostic('complaints-query', {
      code: 'PGRST204', status: 400,
      message: 'private complaint details', token: 'sensitive-value',
    })
  } finally {
    console.info = originalInfo
    if (originalEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnvironment
  }
  assert.deepEqual(logged, ['[workspace-diagnostic]', { stage: 'complaints-query', errorCode: 'PGRST204', httpStatus: 400 }])
})

test('workspace load errors identify their stage without carrying provider details', () => {
  const error = new WorkspaceLoadError('profile-query')
  assert.equal(error.stage, 'profile-query')
  assert.equal(error.message, 'Workspace data could not be loaded.')
})
