import { describe, expect, it } from 'vitest'
import { AiGenerationError, parseAiJson } from './aiClient'

describe('parseAiJson', () => {
  it('parses an object returned in a fenced JSON block', () => {
    expect(parseAiJson<{ title: string }>('```json\n{"title":"测试"}\n```')).toEqual({ title: '测试' })
  })

  it('rejects arrays and malformed responses', () => {
    expect(() => parseAiJson('[]')).toThrow(AiGenerationError)
    expect(() => parseAiJson('not json')).toThrow(AiGenerationError)
  })
})
