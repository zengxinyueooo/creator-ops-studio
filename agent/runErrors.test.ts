import { describe, expect, it } from 'vitest'
import { classifyRunError } from './runErrors.js'

describe('classifyRunError', () => {
  it.each([
    ['The usage limit has been reached', 'quota', false],
    ['HTTP 401 unauthorized', 'authentication', false],
    ['Navigation rejected SECURITY_BLOCK', 'access', false],
    ['TimeoutError: request aborted', 'timeout', true],
    ['TypeError: fetch failed ECONNRESET', 'network', true],
    ['Brief 缺少 angle', 'validation', false],
  ])('classifies %s', (message, category, retryable) => {
    expect(classifyRunError(new Error(message))).toMatchObject({ category, retryable })
  })

  it('redacts URLs from persisted errors', () => {
    expect(classifyRunError(new Error('failed https://example.com/private')).original).not.toContain('example.com')
  })
})
