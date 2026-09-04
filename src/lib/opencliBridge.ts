import type { XhsResearchResult } from '../types'

export interface XhsNoteCapture {
  noteId: string
  title: string
  author: string
  body: string
  likes: number
  collects: number
  comments: number
  hashtags: string[]
  imageCount: number
  images: Array<{
    filename: string
    mimeType: string
    byteSize: number
    position: number
    downloadUrl: string
  }>
}

export async function searchXiaohongshuBatch(
  keywords: string[],
  requiredComicTitle: string,
  limit = 10,
  publishedWithin: 'all' | 'week' = 'week',
): Promise<XhsResearchResult[]> {
  const response = await fetch('/api/opencli/xhs-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Creator-Ops-Bridge': '1' },
    body: JSON.stringify({ keywords, requiredComicTitle, limit, publishedWithin }),
  })
  const payload = await response.json() as { results?: XhsResearchResult[]; error?: string }
  if (!response.ok) throw new Error(payload.error || '本机 OpenCLI 调研服务不可用')
  return payload.results ?? []
}

export async function captureXiaohongshuNote(sourceUrl: string): Promise<XhsNoteCapture> {
  const response = await fetch('/api/opencli/xhs-note-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Creator-Ops-Bridge': '1' },
    body: JSON.stringify({ sourceUrl }),
  })
  const payload = await response.json() as XhsNoteCapture & { error?: string }
  if (!response.ok) throw new Error(payload.error || '本机 OpenCLI 笔记采集服务不可用')
  return payload
}

export async function downloadCapturedImage(image: XhsNoteCapture['images'][number]) {
  const response = await fetch(image.downloadUrl, { headers: { 'X-Creator-Ops-Bridge': '1' } })
  if (!response.ok) throw new Error(`读取图片“${image.filename}”失败`)
  const blob = await response.blob()
  return new File([blob], image.filename, { type: image.mimeType || blob.type })
}
