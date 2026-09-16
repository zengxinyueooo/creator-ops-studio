import { describe, it, expect } from 'vitest'
import { buildExecutionReport, redactReport } from './executionReport'
describe('execution report', () => {
  it('orders every event and preserves failed outcomes', () => {
    const report = buildExecutionReport({ id: 'r', run_type: 'note_capture', status: 'failed', created_at: '2026-09-11T00:00:00Z', completed_at: '2026-09-11T00:00:05Z', error_message: 'network', attempt_count: 2 }, [2, 1].map(id => ({ id, created_at: '', event_type: 'progress', step: 'image', message: String(id) })))
    expect(report.timeline.map(e => e.id)).toEqual([1, 2]); expect(report.durationMs).toBe(5000); expect(report.status).toBe('failed'); expect(report.attemptCount).toBe(2)
  })
  it('redacts nested credentials and URLs', () => {
    expect(redactReport({ token: 'secret', nested: { message: 'https://example.com/?token=secret', authorization: 'secret' } })).toEqual({ nested: { message: '[链接已隐藏]' } })
  })
  it('summarizes environment, error category and recovery metrics', () => {
    const report = buildExecutionReport({ id: 'r', run_type: 'note_capture', status: 'failed', created_at: '2026-09-11T00:00:00Z', worker_id: 'worker' }, [
      { id: 1, created_at: '2026-09-11T00:00:01Z', event_type: 'run_started', step: 'starting', message: 'start', payload: { release: 'abc123', model: 'provider/model', skills: ['capture'] } },
      { id: 2, created_at: '2026-09-11T00:00:03Z', event_type: 'capture_tool_finished', step: 'image:1', message: 'retry', payload: { ok: false, retryable: true, action: 'observe_then_retry', durationMs: 1200 } },
      { id: 3, created_at: '2026-09-11T00:00:04Z', event_type: 'run_failed', step: 'failed', message: 'network', payload: { category: 'network' } },
    ])
    expect(report.environment).toEqual({ release: 'abc123', model: 'provider/model', skills: ['capture'], workerId: 'worker' })
    expect(report.errorCategory).toBe('network')
    expect(report.recovery).toMatchObject({ retryableFailures: 1, recordedToolDurationMs: 1200 })
    expect(report.stepDurations[0]).toMatchObject({ step: 'starting', durationMs: 2000 })
  })
})
