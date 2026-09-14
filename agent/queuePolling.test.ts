import { expect, it, vi } from 'vitest'
import { claimWithRecovery } from './queuePolling.js'

it('survives thrown network errors and returned database errors before claiming', async () => {
  const claim = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET'))
    .mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } })
    .mockResolvedValueOnce({ data: [{ id: 'run' }], error: null })
  const sleep = vi.fn().mockResolvedValue(undefined)
  expect(await claimWithRecovery(claim, { once: false, sleep, onRetry: vi.fn() })).toEqual([{ id: 'run' }])
  expect(sleep.mock.calls).toEqual([[2500], [5000]])
  expect(claim).toHaveBeenCalledTimes(3)
})

it('reports once-mode failure instead of keeping a one-shot command alive', async () => {
  const sleep = vi.fn()
  await expect(claimWithRecovery(async () => ({ data: null, error: new Error('offline') }), {
    once: true, sleep, onRetry: vi.fn(),
  })).rejects.toThrow('offline')
  expect(sleep).not.toHaveBeenCalled()
})
