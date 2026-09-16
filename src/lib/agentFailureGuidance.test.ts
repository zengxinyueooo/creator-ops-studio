import { expect, it } from 'vitest'
import { agentFailureGuidance } from './agentFailureGuidance'

it('gives actionable guidance for common workflow failures', () => {
  expect(agentFailureGuidance('模型额度不足')).toContain('额度')
  expect(agentFailureGuidance('HTTP 401 unauthorized')).toContain('登录')
  expect(agentFailureGuidance('fetch failed ECONNRESET')).toContain('网络')
  expect(agentFailureGuidance('TimeoutError')).toContain('在线')
})
