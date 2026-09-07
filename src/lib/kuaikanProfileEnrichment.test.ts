import { describe, expect, it } from 'vitest'
import { normalizeEnrichedProfile } from './kuaikanProfileEnrichment'
import type { KuaikanOfficialProfile } from './opencliBridge'

const official: KuaikanOfficialProfile = {
  canonicalTitle: '测试漫画',
  officialSynopsis: '这是来自官网的简介。',
  officialSourceUrl: 'https://www.kuaikanmanhua.com/web/topic/123',
  author: '官方作者',
  tags: ['恋爱', '校园'],
  titleWarning: '',
  cover: { filename: 'cover.webp', mimeType: 'image/webp', byteSize: 10, downloadUrl: '/cover' },
}

describe('normalizeEnrichedProfile', () => {
  it('keeps official facts authoritative and normalizes model fields', () => {
    const profile = normalizeEnrichedProfile(official, {
      setting: '  校园  ',
      mainCharacters: [' 林鹿 ', '', '林鹿'],
      relationshipSummary: ' 同学 ',
      coreConflicts: ['守护秘密'],
      contentThemes: ['青春'],
      toneTags: ['清新'],
      spoilerBoundary: '不涉及结局',
    })
    expect(profile.officialSynopsis).toBe(official.officialSynopsis)
    expect(profile.officialSourceUrl).toBe(official.officialSourceUrl)
    expect(profile.mainCharacters).toEqual(['林鹿'])
    expect(profile.contentThemes).toEqual(['青春'])
  })

  it('uses conservative labels instead of inventing missing facts', () => {
    const profile = normalizeEnrichedProfile(official, {})
    expect(profile.setting).toContain('未明确')
    expect(profile.relationshipSummary).toContain('未明确')
    expect(profile.contentThemes).toEqual(['恋爱', '校园'])
    expect(profile.spoilerBoundary).toContain('不延伸')
  })
})
