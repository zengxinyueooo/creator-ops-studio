import { beforeEach, expect, it, vi } from 'vitest'
import { loadDrafts, saveDraft, type SavedDraft } from './draftRepository'
import { demoState } from '../data/demo'
import { createTemplateBrief } from './briefGeneration'

vi.mock('./supabase', () => ({ dataMode: 'local', supabase: null }))
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
})

it('restores versions and edits without changing other versions or owners', async () => {
  const draft: SavedDraft = { id: 'one', version: 1, title: '旧标题', body: '正文', hashtags: ['漫画'], generation_meta: { label: 'template', brief: createTemplateBrief(demoState.topics[0], demoState.comics[0], []), assetIds: ['cover', 'page2'], generatedAt: '2026-09-07' } }
  await saveDraft('user', 'account', 'topic', draft)
  await saveDraft('user', 'account', 'topic', { ...draft, id: 'two', version: 2 })
  await saveDraft('user', 'account', 'topic', { ...draft, title: '编辑标题' }, true)
  const restored = await loadDrafts('user', 'topic')
  expect(restored.map(row => row.version)).toEqual([2, 1])
  expect(restored[0].title).toBe('旧标题')
  expect(restored[1].title).toBe('编辑标题')
  expect(restored[1].generation_meta.assetIds).toEqual(['cover', 'page2'])
  expect(await loadDrafts('other-user', 'topic')).toEqual([])
  expect(await loadDrafts('user', 'other-topic')).toEqual([])
})

it('surfaces persistence failure instead of reporting a saved draft', async () => {
  vi.stubGlobal('localStorage', { getItem: () => '[]', setItem: () => { throw new Error('storage full') } })
  await expect(saveDraft('user', 'account', 'topic', { id: 'one' } as SavedDraft)).rejects.toThrow('storage full')
})
