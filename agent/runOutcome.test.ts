import { describe, expect, it } from 'vitest'
import { readSearchResponse, runFailure } from './runOutcome.js'

describe('research execution failures', () => {
  it('reports the tool failure instead of a missing-save symptom', () => {
    expect(runFailure([{ role: 'toolResult', isError: true, content: [{ type: 'text', text: '搜索服务不可用' }] }], false)).toContain('搜索服务不可用')
  })
  it('reports model errors even when prompt resolved', () => {
    expect(runFailure([{ role: 'assistant', stopReason: 'error', errorMessage: 'fetch failed' }], false)).toContain('fetch failed')
  })
  it('uses a workflow-specific label outside research runs', () => {
    expect(runFailure([], false, 'Agent 工作流')).toBe('Agent 工作流未完成：模型没有调用保存工具')
  })
  it('rejects another app HTML response with a configuration hint', async () => {
    await expect(readSearchResponse(new Response('<html/>', { headers: { 'content-type': 'text/html' } }))).rejects.toThrow('CREATOR_OPS_APP_URL')
  })
  it('allows an empty but valid candidate set', async () => {
    expect(await readSearchResponse(Response.json({ results: [] }))).toEqual({ results: [] })
    expect(runFailure([], true)).toBeUndefined()
  })
})
