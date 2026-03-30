const TRANSIENT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'])

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code
  }

  if ('sourceError' in error && error.sourceError && typeof error.sourceError === 'object') {
    const sourceError = error.sourceError as { code?: unknown; cause?: unknown }

    if (typeof sourceError.code === 'string') {
      return sourceError.code
    }

    if (sourceError.cause && typeof sourceError.cause === 'object' && 'code' in sourceError.cause) {
      const cause = sourceError.cause as { code?: unknown }
      if (typeof cause.code === 'string') {
        return cause.code
      }
    }
  }

  if ('cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
    const cause = error.cause as { code?: unknown }
    if (typeof cause.code === 'string') {
      return cause.code
    }
  }

  return null
}

function isTransientPrismaError(error: unknown): boolean {
  const code = getErrorCode(error)

  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return true
  }

  if (error instanceof Error) {
    return error.message.includes('fetch failed')
  }

  return false
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options?: {
    attempts?: number
    delaysMs?: number[]
  }
): Promise<T> {
  const attempts = options?.attempts ?? 3
  const delaysMs = options?.delaysMs ?? [150, 400]

  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!isTransientPrismaError(error) || attempt === attempts - 1) {
        throw error
      }

      await wait(delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 250)
    }
  }

  throw lastError
}
