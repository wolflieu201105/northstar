export class ServiceError extends Error {
  constructor(message: string, public readonly code = '', public readonly uncertain = false) {
    super(message)
    this.name = 'ServiceError'
  }
}

export function serviceError(error: unknown, fallback = 'The request failed.') {
  if (error instanceof ServiceError) return error
  const details = error as { message?: string; code?: string } | null
  const message = details?.message || (error instanceof Error ? error.message : fallback)
  // Keep one client conflict contract while old/new database installations coexist.
  // PT409 is an HTTP conflict; raw 40001 makes some PostgREST versions retry forever.
  const code = details?.code === 'PT409' ? '40001' : details?.code ?? ''
  const network = /failed to fetch|network|fetch failed|timeout|timed out/i.test(message)
  return new ServiceError(
    code === '40001'
      ? 'This record changed. Reload it and review your draft before saving again.'
      : network ? 'We could not reach the service. Check your connection and try again.' : message,
    code,
    network,
  )
}

export function unresolvedMutation() {
  return new ServiceError('The save outcome could not be confirmed. Keep your draft and retry to check the same request.', 'UNCERTAIN', true)
}
