import { isTransientReadError } from './runErrors.js'

export async function retryTransientRead<T>(
  action: () => Promise<T>,
  options: { attempts?: number; delay?: (ms: number) => Promise<void>; onRetry?: (attempt: number, error: unknown) => void } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3)
  const delay = options.delay ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      if (attempt >= attempts || !isTransientReadError(error)) throw error
      options.onRetry?.(attempt + 1, error)
      await delay(500 * 2 ** (attempt - 1))
    }
  }
}
