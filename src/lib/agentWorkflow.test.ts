import { expect, it, vi } from 'vitest'
import { agentProgressMessage, workflowTargetId } from './agentWorkflow'
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

it('uses a stable target for the same topic synthesis reference set', async () => {
  const first = await workflowTargetId({ runType: 'topic_synthesis', targetId: crypto.randomUUID(), accountId: 'account', payload: { referenceIds: ['b', 'a'] } })
  const second = await workflowTargetId({ runType: 'topic_synthesis', targetId: crypto.randomUUID(), accountId: 'account', payload: { referenceIds: ['a', 'b'] } })
  expect(first).toBe(second)
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

it('keeps the business target for workflows with a persistent object', async () => {
  await expect(workflowTargetId({ runType: 'brief_generation', targetId: 'topic-1', accountId: 'account' })).resolves.toBe('topic-1')
})
