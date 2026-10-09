export type TriageStage = 'complaint-lookup' | 'processing-claim' | 'classification' | 'result-persist' | 'activity-event' | 'failure-persist'

export function logTriageDiagnostic(stage: TriageStage, error?: unknown, outcome?: 'not-found' | 'not-claimed') {
  if (process.env.NODE_ENV !== 'development') return
  const candidate = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; name?: unknown } : {}
  const errorCode = typeof candidate.code === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(candidate.code) ? candidate.code : null
  const httpStatus = typeof candidate.status === 'number' && Number.isInteger(candidate.status) && candidate.status >= 100 && candidate.status <= 599 ? candidate.status : null
  const errorName = typeof candidate.name === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(candidate.name) ? candidate.name : null
  console.info('[triage-diagnostic]', { stage, success: !error && !outcome, outcome: outcome ?? null, errorCode, httpStatus, errorName })
}
