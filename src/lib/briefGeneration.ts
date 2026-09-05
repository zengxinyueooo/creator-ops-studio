import { AiGenerationError, generateAiJson } from './aiClient'
import type { Comic, ContentBrief, ReferenceItem, Topic } from '../types'

type BriefFields = Pick<ContentBrief, 'angle' | 'coreEmotion' | 'hook' | 'structure' | 'assetGuidance' | 'avoidances'>

function strings(value: unknown, limit: number) {
  if (!Array.isArray(value)) return []
  return value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean).slice(0, limit)
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function createTemplateBrief(topic: Topic, comic: Comic | undefined, references: ReferenceItem[]): ContentBrief {
  const strongestReference = references.slice().sort((left, right) => right.likes - left.likes)[0]
  const emotion = topic.tags.slice(0, 3).join('、') || '情绪反差、角色关系'
  return {
    status: 'candidate',
    generationMode: 'template',
    angle: references.length
      ? `综合 ${references.length} 条已保留参考笔记，围绕${comic ? `《${comic.title}》` : topic.subtitle}的“${topic.title}”提炼新的表达角度；重点参考高互动笔记“${strongestReference.title}”传递的关注点，但不复刻原文。`
      : `围绕${comic ? `《${comic.title}》` : topic.subtitle}的“${topic.title}”展开，用具体画面呈现角色关系和情绪变化。`,
    coreEmotion: emotion,
    hook: `${topic.title}，真正戳人的其实是这一刻的反应。`,
    structure: references.length
      ? ['用能直接兑现标题的关键画面开场', `承接参考笔记共同关注的情绪或关系变化（${references.slice(0, 2).map((reference) => reference.title).join(' / ')}）`, '加入自己的判断，并用具体问题邀请讨论']
      : ['用最直观的关键画面开场', '补充角色反应或前后反差', '加入个人感受并用问题邀请讨论'],
    assetGuidance: ['能直接对应标题的主画面', '角色表情或动作特写', '关系变化清晰的同框画面'],
    avoidances: ['不照搬来源笔记句式', '不泄露超出当前选题的关键剧情'],
  }
}

function normalizeBrief(value: Partial<BriefFields>, fallback: ContentBrief): BriefFields {
  const structure = strings(value.structure, 3)
  const assetGuidance = strings(value.assetGuidance, 3)
  const avoidances = strings(value.avoidances, 4)
  return {
    angle: text(value.angle, 360) || fallback.angle,
    coreEmotion: text(value.coreEmotion, 80) || fallback.coreEmotion,
    hook: text(value.hook, 90) || fallback.hook,
    structure: structure.length === 3 ? structure : fallback.structure,
    assetGuidance: assetGuidance.length === 3 ? assetGuidance : fallback.assetGuidance,
    avoidances: avoidances.length >= 2 ? avoidances : fallback.avoidances,
  }
}

export async function generateContentBrief(topic: Topic, comic: Comic | undefined, references: ReferenceItem[]) {
  const fallback = createTemplateBrief(topic, comic, references)
  const evidence = references.slice(0, 4).map((reference) => ({
    title: reference.title,
    body: reference.body.slice(0, 1_500),
    hashtags: reference.hashtags.slice(0, 12),
    likes: reference.likes,
    collects: reference.collects,
    comments: reference.comments,
  }))
  try {
    const result = await generateAiJson<Partial<BriefFields>>({
      system: '你是小红书漫画内容策划。仅根据用户提供的同一部漫画资料，输出原创、克制、可审核的 JSON。不得复刻参考笔记的标题、正文或句式；不要杜撰剧情；不要建议发布或规避平台规则。',
      prompt: JSON.stringify({
        task: '为一个漫画内容选题生成候选 Brief。返回字段 angle、coreEmotion、hook、structure、assetGuidance、avoidances。structure 与 assetGuidance 必须各 3 条，avoidances 至少 2 条。',
        comic: comic ? { title: comic.title, serializationStatus: comic.serializationStatus } : undefined,
        topic: { title: topic.title, subtitle: topic.subtitle, pillar: topic.pillar, tags: topic.tags },
        references: evidence,
      }),
      maxTokens: 900,
      temperature: 0.7,
    })
    return { ...normalizeBrief(result.data, fallback), status: 'candidate' as const, generationMode: 'model' as const, model: result.model }
  } catch (caught) {
    if (caught instanceof AiGenerationError && caught.code === 'AI_NOT_CONFIGURED') return fallback
    throw caught
  }
}
