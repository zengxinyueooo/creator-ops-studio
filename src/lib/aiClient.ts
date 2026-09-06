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

function firstBalancedJsonObject(value: string, start: number) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return value.slice(start, index + 1)
    }
  }
  return ''
}

export function parseAiJson<T extends object>(content: string): T {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? ''
  const candidates = [trimmed, fenced]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T
    } catch {
      // Some vision responses preface JSON with a short explanation. Try its first balanced object below.
    }
    for (let start = candidate.indexOf('{'); start >= 0; start = candidate.indexOf('{', start + 1)) {
      const objectText = firstBalancedJsonObject(candidate, start)
      if (!objectText) continue
      try {
        const parsed = JSON.parse(objectText) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T
      } catch {
        // Keep scanning: braces may have appeared in explanatory text.
      }
    }
  }
  throw new AiGenerationError('模型返回的结构不符合预期，请重试生成')
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

function asDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new AiGenerationError(`无法读取图片“${file.name}”`))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new AiGenerationError(`无法读取图片“${file.name}”`))
    reader.readAsDataURL(file)
  })
}

export async function generateAiVisionJson<T extends object>(input: { file: File; system: string; prompt: string }) {
  const { file, ...request } = input
  if (!file.type.startsWith('image/')) throw new AiGenerationError('只能分析图片文件')
  if (file.size > 15 * 1024 * 1024) throw new AiGenerationError('图片超过 15MB，无法分析')
  const imageDataUrl = await asDataUrl(file)
  const response = await fetch('/api/ai/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Creator-Ops-Bridge': '1' },
    body: JSON.stringify({ ...request, imageDataUrl }),
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    const message = messageFromPayload(payload)
    throw new AiGenerationError(message.error || '图片分析失败', message.code)
  }
  if (!payload || typeof payload !== 'object' || typeof (payload as { content?: unknown }).content !== 'string' || typeof (payload as { model?: unknown }).model !== 'string') {
    throw new AiGenerationError('图片分析返回格式异常')
  }
  return { data: parseAiJson<T>((payload as { content: string }).content), model: (payload as { model: string }).model }
}
