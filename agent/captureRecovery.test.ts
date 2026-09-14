import { expect, it } from 'vitest'
import { errorText, missingPositions, RecoveryGate } from './captureRecovery.js'

it('preserves object errors and redacts source URLs', () => {
  expect(errorText({ code: 'ECONNRESET', message: 'fetch failed' })).toContain('ECONNRESET')
  expect(errorText({ message: 'failed https://example.com/?token=secret' })).not.toContain('secret')
})
it('exposes transient errors for observation and enforces retry budget', async () => {
  const gate = new RecoveryGate()
  const fail = async () => { throw { message: 'fetch failed' } }
  expect(await gate.run('image:2', fail)).toMatchObject({ ok: false, retryable: true, action: 'observe_then_retry' })
  expect(await gate.run('observe', async () => ({ saved: [1] }))).toMatchObject({ ok: true })
  expect(await gate.run('image:2', fail)).toMatchObject({ retryable: true })
  expect(await gate.run('image:2', fail)).toMatchObject({ retryable: false })
  let called = false
  await gate.run('image:2', async () => { called = true })
  expect(called).toBe(false)
})
it('allows recovery but blocks navigation replay and quota bypass', async () => {
  const gate = new RecoveryGate()
  await gate.run('image:2', async () => { throw new Error('fetch failed') })
  expect(await gate.run('image:2', async () => 'saved')).toMatchObject({ ok: true })
  await gate.run('capture', async () => { throw new Error('Navigation rejected') })
  expect(await gate.run('image:3', async () => 'saved')).toMatchObject({ ok: false, action: 'stop' })
  const quota = new RecoveryGate()
  expect(await quota.run('image:1', async () => { throw new Error('usage limit reached') })).toMatchObject({ retryable: false })
})
it('finds missing positions instead of trusting only the count', () => {
  expect(missingPositions([1, 2, 3], [1, 1, 3])).toEqual([2])
})
