export class AiGenerationError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AiGenerationError'
    this.code = code
  }
}

export type AiGeneration = { content: string; model: string }

function messageFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { error: '', code: undefined }
  const value = payload as { error?: unknown; code?: unknown }
  return { error: typeof value.error === 'string' ? value.error : '', code: typeof value.code === 'string' ? value.code : undefined }
}

export function parseAiJson<T extends object>(content: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return parsed as T
  } catch {
    throw new AiGenerationError('模型返回的结构不符合预期，请重试生成')
  }
}

export async function generateAiJson<T extends object>(input: { system: string; prompt: string; maxTokens?: number; temperature?: number }) {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Creator-Ops-Bridge': '1' },
    body: JSON.stringify(input),
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    const message = messageFromPayload(payload)
    throw new AiGenerationError(message.error || '文案模型请求失败', message.code)
  }
  if (!payload || typeof payload !== 'object' || typeof (payload as { content?: unknown }).content !== 'string' || typeof (payload as { model?: unknown }).model !== 'string') {
    throw new AiGenerationError('文案模型返回格式异常')
  }
  return { data: parseAiJson<T>((payload as { content: string }).content), model: (payload as { model: string }).model }
}
