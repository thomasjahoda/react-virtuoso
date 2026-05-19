function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function defaultRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000)
}

export async function executeWithRetry<T>(
  fn: () => Promise<T> | T,
  options: {
    retry: number
    retryDelay: (n: number) => number
    signal: AbortSignal
  }
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= options.retry; attempt++) {
    if (options.signal.aborted) {
      throw new Error('Aborted')
    }

    try {
      // oxlint-disable-next-line no-await-in-loop
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt < options.retry) {
        const delay = options.retryDelay(attempt)
        // oxlint-disable-next-line no-await-in-loop
        await sleep(delay)
      }
    }
  }

  // oxlint-disable-next-line no-throw-literal -- re-throwing the original caught error
  throw lastError
}
