/** Retry queue reads without replaying business tools after a task has started. */
export async function claimWithRecovery<T>(
  claim: () => PromiseLike<{ data: T | null; error: unknown }>,
  options: { once: boolean; sleep: (ms: number) => Promise<void>; onRetry: (ms: number) => void },
): Promise<T | null> {
  let failures = 0
  while (true) {
    try {
      const result = await claim()
      if (result.error) throw result.error
      return result.data
    } catch (error) {
      if (options.once) throw error
      const delay = Math.min(30_000, 2500 * 2 ** Math.min(failures++, 4))
      options.onRetry(delay)
      await options.sleep(delay)
    }
  }
}
