export type WorkspaceStage = 'auth' | 'profile-query' | 'complaints-query' | 'events-query' | 'duplicates-query' | 'knowledge-query' | 'settings-query' | 'profile-match'

function safeErrorFields(error: unknown) {
  const candidate = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {}
  return {
    errorCode: typeof candidate.code === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(candidate.code) ? candidate.code : null,
    httpStatus: typeof candidate.status === 'number' && Number.isInteger(candidate.status) && candidate.status >= 100 && candidate.status <= 599 ? candidate.status : null,
  }
}

export function logWorkspaceDiagnostic(stage: WorkspaceStage, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return
  console.info('[workspace-diagnostic]', { stage, ...safeErrorFields(error) })
}

export class WorkspaceLoadError extends Error {
  readonly stage: WorkspaceStage

  constructor(stage: WorkspaceStage) {
    super('Workspace data could not be loaded.')
    this.name = 'WorkspaceLoadError'
    this.stage = stage
  }
}
