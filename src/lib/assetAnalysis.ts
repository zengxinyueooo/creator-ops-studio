import { generateAiVisionJson } from './aiClient'
import type { AssetContentType, AssetReviewStatus, AssetVisualFormat } from '../types'

export interface AssetAnalysis {
  visualFormat: AssetVisualFormat
  reviewStatus: AssetReviewStatus
  contentType: AssetContentType
  tags: string[]
  characters: string[]
  classificationNote: string
  confidence?: number
  model: string
}

const validFormats = new Set<AssetVisualFormat>(['single', 'collage', 'uncertain', 'invalid'])
const validContentTypes = new Set<AssetContentType>(['cover', 'character', 'interaction', 'plot', 'dialogue', 'atmosphere', 'other'])

function cleanList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => typeof item === 'string' ? item.trim().replace(/^#/, '').slice(0, 16) : '').filter(Boolean))].slice(0, limit)
}

export async function analyzeComicAsset(file: File) {
  const result = await generateAiVisionJson<{
    visualFormat?: unknown
    contentType?: unknown
    tags?: unknown
    characters?: unknown
    classificationNote?: unknown
    confidence?: unknown
  }>({
    file,
    system: '你是漫画素材库的视觉标注助手。只描述图中可见信息，输出严格 JSON；不识别或猜测角色真实姓名，不判断版权，不生成文案。连续的漫画长图即使包含多格分镜也属于 single；只有明显由两张及以上独立图片拼接、有分割边界的画面才是 collage。',
    prompt: '分析这张漫画素材，返回 visualFormat（single/collage/uncertain/invalid）、contentType（cover/character/interaction/plot/dialogue/atmosphere/other）、tags（2-5个可见内容标签，去重，不带#）、characters（仅图中有明确姓名文字时填写，否则[]）、classificationNote（一句不超过32字的可见画面描述）、confidence（0到1）。',
  })
  const visualFormat = typeof result.data.visualFormat === 'string' && validFormats.has(result.data.visualFormat as AssetVisualFormat)
    ? result.data.visualFormat as AssetVisualFormat
    : 'uncertain'
  const contentType = typeof result.data.contentType === 'string' && validContentTypes.has(result.data.contentType as AssetContentType)
    ? result.data.contentType as AssetContentType
    : 'other'
  const confidenceValue = Number(result.data.confidence)
  const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : undefined
  return {
    visualFormat,
    reviewStatus: visualFormat === 'single' ? 'available' : visualFormat === 'collage' || visualFormat === 'invalid' ? 'rejected' : 'pending',
    contentType,
    tags: cleanList(result.data.tags, 5),
    characters: cleanList(result.data.characters, 4),
    classificationNote: typeof result.data.classificationNote === 'string' ? result.data.classificationNote.trim().slice(0, 64) : '',
    confidence,
    model: result.model,
  } satisfies AssetAnalysis
}
