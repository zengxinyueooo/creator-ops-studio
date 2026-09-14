import { it, expect } from 'vitest'
import { RecoveryGate } from './captureRecovery.js'

it('records paired attempts, recovery and skip without raw output', async () => {
  const events: Record<string, unknown>[] = []
  const gate = new RecoveryGate(async entry => { events.push(entry) })
  await gate.run('image:1', async () => { throw new Error('ECONNRESET') })
  await gate.run('image:1', async () => ({ skipped: true, position: 1, raw: 'private' }))
  expect(events).toHaveLength(4)
  expect(events[1]).toMatchObject({ attempt: 1, retryable: true, action: 'observe_then_retry' })
  expect(events[3]).toMatchObject({ attempt: 2, skipped: true, position: 1 })
  expect(events[3]).not.toHaveProperty('raw')
  expect(events[0].callId).toBe(events[1].callId)
})

it('audit failure does not fail successful work', async () => {
  const gate = new RecoveryGate(async () => { throw new Error('log unavailable') })
  expect(await gate.run('observe', async () => ({ completed: true }))).toMatchObject({ ok: true })
})
