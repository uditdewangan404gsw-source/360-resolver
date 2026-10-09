import test from 'node:test'
import assert from 'node:assert/strict'
import { classificationSchema, triageCorrectionSchema } from '../lib/complaint-triage-schema.ts'
import { preserveSavedComplaintOnTriageFailure } from '../lib/triage-workflow.ts'

const valid = {
  category: 'Card payments', product: 'Payment card', severity: 'High', sentiment: 'Negative',
  language: 'English', summary: 'A card payment was duplicated.',
  recommendedAction: 'Review the payment records and update the customer.',
  possibleFraud: false, fraudReason: '', confidence: 0.82,
  explanation: 'The message reports a duplicated card payment.',
}

test('accepts a valid structured triage result', () => {
  assert.deepEqual(classificationSchema.parse(valid), valid)
})

test('rejects malformed model output and out-of-range confidence', () => {
  assert.equal(classificationSchema.safeParse({ ...valid, severity: 'Urgent' }).success, false)
  assert.equal(classificationSchema.safeParse({ ...valid, confidence: 1.2 }).success, false)
  assert.equal(classificationSchema.safeParse({ ...valid, possibleFraud: 'maybe' }).success, false)
})

test('keeps an already saved complaint successful when triage fails', async () => {
  const saved = { id: 'CMP-28501', persisted: true }
  const result = await preserveSavedComplaintOnTriageFailure(saved, async () => { throw new Error('provider timeout') })
  assert.equal(result.complaint, saved)
  assert.equal(result.triage, null)
})

test('accepts an agent correction through the same strict result schema', () => {
  const corrected = { ...valid, category: 'Disputes', severity: 'Medium', confidence: 0.82 }
  assert.deepEqual(triageCorrectionSchema.parse(corrected), corrected)
})
