import type { XhsResearchResult } from '../types'

export async function searchXiaohongshuBatch(keywords: string[], limit = 10): Promise<XhsResearchResult[]> {
  const response = await fetch('/api/opencli/xhs-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Creator-Ops-Bridge': '1' },
    body: JSON.stringify({ keywords, limit }),
  })
  const payload = await response.json() as { results?: XhsResearchResult[]; error?: string }
  if (!response.ok) throw new Error(payload.error || '本机 OpenCLI 调研服务不可用')
  return payload.results ?? []
}
