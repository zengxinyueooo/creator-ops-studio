import { describe, it, expect } from 'vitest'
import { buildExecutionReport, redactReport } from './executionReport'
describe('execution report', () => {
  it('orders every event and preserves failed outcomes', () => {
    const report = buildExecutionReport({ id: 'r', run_type: 'note_capture', status: 'failed', created_at: '2026-09-11T00:00:00Z', completed_at: '2026-09-11T00:00:05Z', error_message: 'network' }, [2, 1].map(id => ({ id, created_at: '', event_type: 'progress', step: 'image', message: String(id) })))
    expect(report.timeline.map(e => e.id)).toEqual([1, 2]); expect(report.durationMs).toBe(5000); expect(report.status).toBe('failed')
  })
  it('redacts nested credentials and URLs', () => {
    expect(redactReport({ token: 'secret', nested: { message: 'https://example.com/?token=secret', authorization: 'secret' } })).toEqual({ nested: { message: '[链接已隐藏]' } })
  })
})
