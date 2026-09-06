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
    system: '你是漫画内容运营的素材语义标注助手。目标是让创作者按“人物关系或剧情动作 + 情绪氛围”检索并选图，而不是按外貌细节检索。只基于画面可见信息，不猜测角色姓名、身份或后续剧情，不判断版权，不生成文案。tags 必须是对内容运营有价值的语义标签：至少一个主体/关系/动作或剧情标签，且至少一个情绪标签。禁止输出发色、眼睛颜色、服饰、饰品、植物、背景色等外观细节，除非该物件直接构成剧情动作。连续漫画长图即使包含多格分镜也属于 single；只有明显由两张及以上独立图片拼接、有分割边界的画面才是 collage。',
    prompt: '分析这张漫画素材，严格返回 JSON：visualFormat（single/collage/uncertain/invalid）、contentType（cover/character/interaction/plot/dialogue/atmosphere/other）、tags（3-5个中文语义标签，去重且不带#；优先人物关系/动作/剧情，如双人同框、对视、靠近、拥抱、守护、承诺、争执、重逢、台词；并必须含情绪，如甜、暧昧、心动、治愈、虐、心酸、紧张、压抑、悬念、搞笑）、characters（仅画面文字明确给出姓名时填写，否则[]）、classificationNote（不超过32字，概括“什么关系或情节 + 什么情绪”，例如“男女主对视靠近，氛围暧昧心动。”）、confidence（0到1）。不要输出任何外貌、服饰或背景装饰标签。',
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
    reviewStatus: visualFormat === 'invalid' ? 'rejected' : visualFormat === 'uncertain' ? 'pending' : 'available',
    contentType,
    tags: cleanList(result.data.tags, 5),
    characters: cleanList(result.data.characters, 4),
    classificationNote: typeof result.data.classificationNote === 'string' ? result.data.classificationNote.trim().slice(0, 64) : '',
    confidence,
    model: result.model,
  } satisfies AssetAnalysis
}
