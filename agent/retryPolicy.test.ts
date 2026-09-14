import { expect, it, vi } from 'vitest'
import { retryTransientRead } from './retryPolicy.js'

it('retries transient read failures with a finite budget', async () => {
  const action = vi.fn().mockRejectedValueOnce(new Error('fetch failed ECONNRESET')).mockResolvedValue('ok')
  await expect(retryTransientRead(action, { delay: async () => undefined })).resolves.toBe('ok')
  expect(action).toHaveBeenCalledTimes(2)
})

it('does not retry quota failures', async () => {
  const action = vi.fn().mockRejectedValue(new Error('usage limit reached'))
  await expect(retryTransientRead(action, { delay: async () => undefined })).rejects.toThrow('usage limit')
  expect(action).toHaveBeenCalledTimes(1)
})
