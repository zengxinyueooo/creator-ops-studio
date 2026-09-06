import { describe, expect, it } from 'vitest'
import { AiGenerationError, parseAiJson } from './aiClient'

describe('parseAiJson', () => {
  it('parses an object returned in a fenced JSON block', () => {
    expect(parseAiJson<{ title: string }>('```json\n{"title":"测试"}\n```')).toEqual({ title: '测试' })
  })

  it('extracts a JSON object when a vision model adds a short preface', () => {
    expect(parseAiJson<{ tags: string[] }>('分析结果如下：\n{"tags":["对视","花朵"]}\n请审核。')).toEqual({ tags: ['对视', '花朵'] })
  })

  it('rejects arrays and malformed responses', () => {
    expect(() => parseAiJson('[]')).toThrow(AiGenerationError)
    expect(() => parseAiJson('not json')).toThrow(AiGenerationError)
  })
})
