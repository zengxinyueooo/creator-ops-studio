import { expect, it, vi } from 'vitest'
import { agentProgressMessage } from './agentWorkflow'
import type { AgentRun } from '../types'

vi.mock('./supabase', () => ({ supabase: null }))

it('distinguishes an unclaimed queued job from an executing capture', () => {
  const run: AgentRun = { id: 'one', status: 'queued', currentStep: 'queued', output: {}, createdAt: new Date(Date.now() - 60_000).toISOString(), events: [] }
  expect(agentProgressMessage(run)).toContain('尚未开始采集')
  expect(agentProgressMessage(run)).toContain('可能')
  expect(agentProgressMessage({ ...run, status: 'running', events: [{ id: 1, eventType: 'progress', step: 'image_saved', message: '已保存第 2/3 张图片', createdAt: run.createdAt }] })).toBe('已保存第 2/3 张图片')
})

it('shows terminal errors instead of stale starting progress', () => {
  expect(agentProgressMessage({ id: 'one', status: 'failed', currentStep: 'failed', output: {}, createdAt: '', errorMessage: '模型额度不足', events: [] })).toBe('模型额度不足')
})
