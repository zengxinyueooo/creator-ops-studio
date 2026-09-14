import { describe, expect, it, vi } from 'vitest'
import { RunLease, finishOwnedRun } from './runLease.js'

function dbReturning(data: boolean, error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) } as never
}

describe('RunLease', () => {
  it('marks a run as lost when the database rejects renewal ownership', async () => {
    const lease = new RunLease(dbReturning(false), 'run-1', 'worker-1')
    await expect(lease.renew('fetching')).rejects.toThrow('执行权已失效')
    expect(() => lease.assertOwned()).toThrow('执行权已失效')
  })

  it('keeps transient database errors retryable without declaring ownership lost', async () => {
    const lease = new RunLease(dbReturning(false, new Error('network')), 'run-1', 'worker-1')
    await expect(lease.renew()).rejects.toThrow('network')
    expect(() => lease.assertOwned()).not.toThrow()
  })
})

describe('finishOwnedRun', () => {
  it('rejects a stale worker completion', async () => {
    await expect(finishOwnedRun(dbReturning(false), {
      runId: 'run-1', workerId: 'worker-old', status: 'succeeded',
    })).rejects.toThrow('拒绝覆盖')
  })
})
