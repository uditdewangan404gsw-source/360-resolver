import test from 'node:test'
import assert from 'node:assert/strict'
import { customerStatus, minutesRemaining, resolutionEstimate, slaState } from '../lib/customer-portal.ts'

const now = Date.parse('2026-10-09T12:00:00Z')

test('maps internal complaint states to customer-safe labels', () => {
  assert.equal(customerStatus('Open'), 'Received')
  assert.equal(customerStatus('In progress'), 'Under review')
  assert.equal(customerStatus('Pending customer'), 'Waiting for your information')
  assert.equal(customerStatus('Resolved'), 'Resolved')
})

test('computes SLA status from stored deadline and risk threshold', () => {
  assert.equal(slaState('In progress', '2026-10-09T14:00:00Z', '2026-10-09T13:00:00Z', now), 'on-track')
  assert.equal(slaState('In progress', '2026-10-09T14:00:00Z', '2026-10-09T11:00:00Z', now), 'at-risk')
  assert.equal(slaState('In progress', '2026-10-09T11:00:00Z', '2026-10-09T10:00:00Z', now), 'breached')
  assert.equal(slaState('Resolved', '2026-10-09T11:00:00Z', '2026-10-09T10:00:00Z', now), 'resolved')
  assert.equal(slaState('Open', null, null, now), 'unavailable')
})

test('reports remaining time from the recorded SLA deadline', () => {
  assert.equal(minutesRemaining('2026-10-09T13:30:00Z', now), 90)
  assert.equal(minutesRemaining(null, now), null)
})

test('does not invent a resolution estimate when no commitment is recorded', () => {
  assert.deepEqual(resolutionEstimate(null), { available: false, label: 'Resolution time not yet available' })
  assert.deepEqual(resolutionEstimate('2026-10-10T12:00:00Z'), { available: true, commitmentAt: '2026-10-10T12:00:00Z' })
})
