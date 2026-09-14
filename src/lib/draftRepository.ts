import { dataMode, supabase } from './supabase'
import type { ContentBrief } from '../types'

export interface SavedDraft {
  id: string
  version: number
  title: string
  body: string
  hashtags: string[]
  generation_meta: { label: string; brief: ContentBrief; assetIds: string[]; generatedAt: string }
}

function cacheKey(userId: string, topicId: string) { return `creator-ops:drafts:${userId}:${topicId}` }

export async function loadDrafts(userId: string, topicId: string): Promise<SavedDraft[]> {
  if (dataMode !== 'supabase') return JSON.parse(localStorage.getItem(cacheKey(userId, topicId)) || '[]')
  if (!supabase || !userId) throw new Error('请登录后读取草稿')
  const { data, error } = await supabase.from('drafts').select('*').eq('user_id', userId).eq('topic_id', topicId).order('version', { ascending: false })
  if (error) throw error
  return data as SavedDraft[]
}

export async function saveDraft(userId: string, accountId: string, topicId: string, draft: SavedDraft, existing = false) {
  if (dataMode !== 'supabase') {
    const rows = await loadDrafts(userId, topicId)
    localStorage.setItem(cacheKey(userId, topicId), JSON.stringify([draft, ...rows.filter(row => row.id !== draft.id)].sort((a, b) => b.version - a.version)))
    return
  }
  if (!supabase || !userId) throw new Error('请登录后保存草稿')
  const { error } = existing
    ? await supabase.from('drafts').update({ title: draft.title, body: draft.body, hashtags: draft.hashtags }).eq('id', draft.id).eq('user_id', userId).eq('topic_id', topicId)
    : await supabase.from('drafts').insert({ ...draft, user_id: userId, account_id: accountId, topic_id: topicId, review_status: 'draft' })
  if (error) throw new Error(`草稿保存失败：${error.message}`)
}
