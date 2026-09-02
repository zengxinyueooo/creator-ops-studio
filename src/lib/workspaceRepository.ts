import { demoState } from '../data/demo'
import type { ComicStatus, CopyrightStatus, Topic, TopicStatus, WorkspaceState, XhsResearchResult } from '../types'
import { supabase } from './supabase'

function client() {
  if (!supabase) throw new Error('Supabase 尚未配置')
  return supabase
}

function formatTime(value?: string | null) {
  if (!value) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export async function loadCloudWorkspace(userId: string): Promise<WorkspaceState> {
  const db = client()
  const [accountsResult, comicsResult, topicsResult, referencesResult, tasksResult, schedulesResult, topicAssetsResult, assetsResult] = await Promise.all([
    db.from('accounts').select('*').eq('user_id', userId).is('archived_at', null).order('created_at'),
    db.from('comics').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
    db.from('topics').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
    db.from('references').select('*').eq('user_id', userId).order('captured_at', { ascending: false }),
    db.from('research_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    db.from('schedules').select('*').eq('user_id', userId).order('created_at'),
    db.from('topic_assets').select('topic_id, asset_id'),
    db.from('assets').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
  ])

  const failed = [accountsResult, comicsResult, topicsResult, referencesResult, tasksResult, schedulesResult, topicAssetsResult, assetsResult].find((result) => result.error)
  if (failed?.error) throw failed.error

  const assetRows = assetsResult.data ?? []
  const signedUrls = new Map<string, string>()
  if (assetRows.length) {
    const { data: signedData } = await db.storage.from('content-assets').createSignedUrls(assetRows.map((row) => row.storage_path), 3600)
    for (const item of signedData ?? []) {
      if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl)
    }
  }

  const accounts = (accountsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    handle: row.platform_handle ?? '待创建',
    kind: row.kind,
    positioning: row.positioning,
    accent: row.accent,
    pillars: Array.isArray(row.pillars) ? row.pillars.map(String) : [],
  }))

  const references = (referencesResult.data ?? []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    author: row.author_name ?? '未知作者',
    sourceUrl: row.source_url,
    likes: row.likes,
    collects: row.collects,
    comments: row.comments,
    capturedAt: formatTime(row.captured_at),
    insight: row.insight,
  }))

  const referenceCounts = new Map<string, number>()
  for (const row of referencesResult.data ?? []) {
    if (row.topic_id) referenceCounts.set(row.topic_id, (referenceCounts.get(row.topic_id) ?? 0) + 1)
  }
  const assetCounts = new Map<string, number>()
  for (const row of topicAssetsResult.data ?? []) {
    assetCounts.set(row.topic_id, (assetCounts.get(row.topic_id) ?? 0) + 1)
  }

  const storedAccount = localStorage.getItem('creator-ops-studio:active-account')
  const activeAccountId = accounts.some((account) => account.id === storedAccount) ? storedAccount! : accounts[0]?.id ?? ''

  return {
    accounts,
    activeAccountId,
    comics: (comicsResult.data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      title: row.title,
      platform: row.platform,
      sourceUrl: row.source_url ?? undefined,
      coverUrl: row.cover_url ?? undefined,
      status: row.status,
      updateWeekday: row.update_weekday ?? undefined,
      updateNote: row.update_note,
      selectionNote: row.selection_note,
      createdAt: formatTime(row.created_at),
    })),
    topics: (topicsResult.data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      title: row.title,
      subtitle: row.subtitle,
      status: row.status,
      score: row.score,
      pillar: row.pillar,
      tags: row.tags ?? [],
      dueAt: row.due_at ? formatTime(row.due_at) : undefined,
      referenceCount: referenceCounts.get(row.id) ?? 0,
      assetCount: assetCounts.get(row.id) ?? 0,
      updatedAt: formatTime(row.updated_at),
    })),
    references,
    researchTasks: (tasksResult.data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      keyword: row.keyword,
      purpose: row.purpose,
      status: ['queued', 'running', 'imported', 'failed'].includes(row.status) ? row.status : 'queued',
      limit: row.result_limit,
      createdAt: formatTime(row.created_at),
    })),
    schedules: (schedulesResult.data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      title: row.title,
      dateLabel: typeof row.custom_fields?.dateLabel === 'string' ? row.custom_fields.dateLabel : formatTime(row.starts_at),
      kind: row.kind,
    })),
    assets: assetRows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      storagePath: row.storage_path,
      originalName: row.original_name,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sourceUrl: row.source_url ?? undefined,
      sourceType: row.source_type,
      tags: row.tags ?? [],
      workName: typeof row.custom_fields?.workName === 'string' ? row.custom_fields.workName : '',
      chapter: typeof row.custom_fields?.chapter === 'string' ? row.custom_fields.chapter : '',
      copyrightStatus: (typeof row.custom_fields?.copyrightStatus === 'string' ? row.custom_fields.copyrightStatus : 'unknown') as CopyrightStatus,
      createdAt: formatTime(row.created_at),
      previewUrl: signedUrls.get(row.storage_path),
      topicId: (topicAssetsResult.data ?? []).find((link) => link.asset_id === row.id)?.topic_id,
    })),
  }
}

export async function createCloudComic(
  userId: string,
  accountId: string,
  input: { title: string; platform: string; sourceUrl: string; selectionNote: string },
) {
  const { data, error } = await client().from('comics').insert({
    user_id: userId,
    account_id: accountId,
    title: input.title,
    platform: input.platform || 'unknown',
    source_url: input.sourceUrl || null,
    selection_note: input.selectionNote,
    status: 'candidate',
  }).select('*').single()
  if (error) throw error
  return data
}

export async function updateCloudComicStatus(comicId: string, status: ComicStatus) {
  const { error } = await client().from('comics').update({ status }).eq('id', comicId)
  if (error) throw error
}

export async function createCloudTopic(userId: string, accountId: string, input: Pick<Topic, 'title' | 'subtitle' | 'pillar'>) {
  const { data, error } = await client().from('topics').insert({
    user_id: userId,
    account_id: accountId,
    title: input.title,
    subtitle: input.subtitle || '新建选题',
    pillar: input.pillar,
    status: 'idea',
    score: 60,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function updateCloudTopicStatus(topicId: string, status: TopicStatus) {
  const { error } = await client().from('topics').update({ status }).eq('id', topicId)
  if (error) throw error
}

export async function markCloudResearchImported(taskId: string) {
  const { error } = await client().from('research_tasks').update({ status: 'imported', completed_at: new Date().toISOString() }).eq('id', taskId)
  if (error) throw error
}

export async function createCloudResearchTask(userId: string, accountId: string, input: { keyword: string; purpose: string; limit: number }) {
  const { data, error } = await client().from('research_tasks').insert({
    user_id: userId,
    account_id: accountId,
    keyword: input.keyword,
    purpose: input.purpose,
    result_limit: Math.min(20, Math.max(1, input.limit)),
    status: 'queued',
    provider: 'opencli',
    command_preview: `opencli xiaohongshu search ${JSON.stringify(input.keyword)} --limit ${input.limit} -f json`,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function importCloudResearchResults(userId: string, accountId: string, taskId: string, results: XhsResearchResult[]) {
  const db = client()
  if (results.length) {
    const { error: referenceError } = await db.from('references').upsert(results.map((result) => ({
      user_id: userId,
      account_id: accountId,
      platform: 'xiaohongshu',
      source_url: result.url,
      source_note_id: result.noteId || null,
      author_name: result.author,
      title: result.title,
      likes: result.likes,
      published_at: result.publishedAt,
      insight: '',
      raw_payload: { rank: result.rank, imported_from: 'opencli-search' },
    })), { onConflict: 'user_id,source_url', ignoreDuplicates: true })
    if (referenceError) throw referenceError
  }

  const { error: taskError } = await db.from('research_tasks').update({
    status: 'imported',
    completed_at: new Date().toISOString(),
    result_summary: { imported_count: results.length, reviewed_by_user: true },
  }).eq('id', taskId)
  if (taskError) throw taskError
}

export async function uploadCloudAssets(
  userId: string,
  accountId: string,
  files: File[],
  metadata: { sourceUrl: string; sourceType: string; workName: string; chapter: string; copyrightStatus: CopyrightStatus; tags: string[]; topicId?: string },
) {
  const db = client()
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  if (!files.length || files.length > 10) throw new Error('每次请选择 1–10 张图片')

  for (const file of files) {
    if (!allowedTypes.has(file.type)) throw new Error(`${file.name} 不是支持的图片格式`)
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} 超过 15MB`)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100) || 'image'
    const storagePath = `${userId}/${accountId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await db.storage.from('content-assets').upload(storagePath, file, { upsert: false, contentType: file.type })
    if (uploadError) throw uploadError

    const { data: asset, error: assetError } = await db.from('assets').insert({
      user_id: userId,
      account_id: accountId,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      byte_size: file.size,
      source_url: metadata.sourceUrl || null,
      source_type: metadata.sourceType,
      tags: metadata.tags,
      custom_fields: {
        workName: metadata.workName,
        chapter: metadata.chapter,
        copyrightStatus: metadata.copyrightStatus,
      },
    }).select('id').single()
    if (assetError) throw assetError

    if (metadata.topicId) {
      const { error: linkError } = await db.from('topic_assets').insert({ topic_id: metadata.topicId, asset_id: asset.id })
      if (linkError) throw linkError
    }
  }
}

export async function seedCloudWorkspace(userId: string) {
  const db = client()
  const { data: accountRows, error: accountError } = await db.from('accounts').insert(demoState.accounts.map((account) => ({
    user_id: userId,
    name: account.name,
    platform_handle: account.handle,
    kind: account.kind,
    positioning: account.positioning,
    accent: account.accent,
    pillars: account.pillars,
  }))).select('id, kind')
  if (accountError) throw accountError

  const accountIds = new Map(accountRows.map((row) => [row.kind, row.id]))
  const resolveAccount = (demoAccountId: string) => {
    const kind = demoState.accounts.find((account) => account.id === demoAccountId)?.kind
    const id = kind ? accountIds.get(kind) : undefined
    if (!id) throw new Error('初始化账号映射失败')
    return id
  }

  const { error: topicError } = await db.from('topics').insert(demoState.topics.map((topic) => ({
    user_id: userId,
    account_id: resolveAccount(topic.accountId),
    title: topic.title,
    subtitle: topic.subtitle,
    pillar: topic.pillar,
    status: topic.status,
    score: topic.score,
    tags: topic.tags,
  })))
  if (topicError) throw topicError

  const { error: referenceError } = await db.from('references').insert(demoState.references.map((reference) => ({
    user_id: userId,
    account_id: resolveAccount(reference.accountId),
    source_url: `${reference.sourceUrl.replace(/\/$/, '')}/explore/${reference.id}`,
    author_name: reference.author,
    title: reference.title,
    likes: reference.likes,
    collects: reference.collects,
    comments: reference.comments,
    insight: reference.insight,
  })))
  if (referenceError) throw referenceError

  const { error: taskError } = await db.from('research_tasks').insert(demoState.researchTasks.map((task) => ({
    user_id: userId,
    account_id: resolveAccount(task.accountId),
    keyword: task.keyword,
    purpose: task.purpose,
    result_limit: task.limit,
    status: task.status,
  })))
  if (taskError) throw taskError

  const { error: scheduleError } = await db.from('schedules').insert(demoState.schedules.map((schedule) => ({
    user_id: userId,
    account_id: resolveAccount(schedule.accountId),
    title: schedule.title,
    kind: schedule.kind,
    custom_fields: { dateLabel: schedule.dateLabel },
  })))
  if (scheduleError) throw scheduleError
}
