import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoState } from '../data/demo'
import { AiGenerationError, generateAiJson } from './aiClient'
import { createTemplateBrief, generateContentBrief, selectBriefReferences } from './briefGeneration'
import { normalizeComicProfile, validateComicProfile, validateComicCover } from './comicProfile'

import * as aiClient from './aiClient'
vi.spyOn(aiClient, 'generateAiJson')
const comic = { ...demoState.comics[0], contentProfile: normalizeComicProfile({ setting: '海边书店', spoilerBoundary: '仅官方简介' }) }
const topic = { ...demoState.topics[0], comicId: comic.id, accountId: comic.accountId }
const reference = { ...demoState.references[0], id: 'evidence-1', comicId: comic.id, accountId: comic.accountId, topicIds: [topic.id], reviewStatus: 'kept' as const, detailStatus: 'detailed' as const, body: '完整正文'.repeat(500) }

beforeEach(() => { vi.mocked(generateAiJson).mockReset() })
describe('comic evidence boundaries', () => {
  it('excludes cross-account, cross-comic, unlinked, unkept and incomplete evidence', () => {
    const invalid = [{ ...reference, accountId: 'other' }, { ...reference, comicId: 'other' }, { ...reference, topicIds: [] }, { ...reference, reviewStatus: 'candidate' as const }, { ...reference, detailStatus: 'list_only' as const }, { ...reference, body: '' }]
    expect(selectBriefReferences(topic, comic, [reference, ...invalid])).toEqual([reference])
    expect(() => selectBriefReferences(topic, comic, invalid)).toThrow()
    expect(() => selectBriefReferences(topic, { ...comic, platform: 'other' }, [reference])).toThrow()
  })
  it('sends full reference bodies and profile, and persists evidence snapshot', async () => {
    vi.mocked(generateAiJson).mockResolvedValue({ data: {}, model: 'test' })
    const brief = await generateContentBrief(topic, comic, [reference])
    const request = vi.mocked(generateAiJson).mock.calls[0][0]
    const prompt = JSON.parse(request.prompt)
    expect(prompt.references[0].body).toBe(reference.body)
    expect(prompt.comic.profile.setting).toBe('海边书店')
    expect(prompt.comic.profile.mainCharacters).toBe('未知')
    expect(brief.evidence?.referenceIds).toEqual(['evidence-1'])
    expect(brief.status).toBe('candidate')
  })
  it('labels unavailable model fallback without invented emotions or hook', async () => {
    vi.mocked(generateAiJson).mockRejectedValue(new AiGenerationError('missing', 'AI_NOT_CONFIGURED'))
    const brief = await generateContentBrief(topic, comic, [reference])
    expect(brief.generationMode).toBe('template')
    expect(brief.coreEmotion).toContain('未知')
    expect(brief.hook).toContain('待人工')
    expect(createTemplateBrief(topic, comic, [reference]).avoidances[0]).toContain('仅官方简介')
  })
  it('validates official source domains and cover limits', () => {
    expect(() => validateComicProfile(normalizeComicProfile({ officialSourceUrl: 'https://www.kuaikanmanhua.com/web/topic/1/' }))).not.toThrow()
    expect(() => validateComicProfile(normalizeComicProfile({ officialSourceUrl: 'https://kuaikanmanhua.com.evil.test/' }))).toThrow()
    expect(() => validateComicCover({ type: 'image/svg+xml', size: 1 } as File)).toThrow()
    expect(() => validateComicCover({ type: 'image/png', size: 6 * 1024 * 1024 } as File)).toThrow()
  })
})
