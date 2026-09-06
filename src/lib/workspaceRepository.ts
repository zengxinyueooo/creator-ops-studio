import { demoState } from '../data/demo'
import type { AssetContentType, AssetReviewStatus, AssetVisualFormat, ComicSerializationStatus, ComicStatus, ContentBrief, CopyrightStatus, ReferenceItem, Topic, TopicStatus, WorkspaceState, XhsResearchResult } from '../types'
import type { AssetAnalysis } from './assetAnalysis'
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
  const [accountsResult, comicsResult, topicsResult, referencesResult, tasksResult, schedulesResult, topicReferencesResult, topicAssetsResult, assetsResult, assetUsagesResult] = await Promise.all([
    db.from('accounts').select('*').eq('user_id', userId).is('archived_at', null).order('created_at'),
    db.from('comics').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
    db.from('topics').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
    db.from('references').select('*').eq('user_id', userId).order('captured_at', { ascending: false }),
    db.from('research_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    db.from('schedules').select('*').eq('user_id', userId).order('created_at'),
    db.from('topic_references').select('topic_id, reference_id, position, is_primary'),
    db.from('topic_assets').select('topic_id, asset_id'),
    db.from('assets').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
    db.from('asset_usages').select('*').eq('user_id', userId).order('used_at', { ascending: false }),
  ])

  const usageTableMissing = assetUsagesResult.error?.code === '42P01' || assetUsagesResult.error?.code === 'PGRST205'
  const failed = [accountsResult, comicsResult, topicsResult, referencesResult, tasksResult, schedulesResult, topicReferencesResult, topicAssetsResult, assetsResult, usageTableMissing ? null : assetUsagesResult].find((result) => result?.error)
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

  const topicIdsByReference = new Map<string, string[]>()
  const referenceCounts = new Map<string, number>()
  for (const row of topicReferencesResult.data ?? []) {
    topicIdsByReference.set(row.reference_id, [...(topicIdsByReference.get(row.reference_id) ?? []), row.topic_id])
    referenceCounts.set(row.topic_id, (referenceCounts.get(row.topic_id) ?? 0) + 1)
  }

  const references = (referencesResult.data ?? []).map((row) => {
    const topicIds = [...new Set([...(topicIdsByReference.get(row.id) ?? []), ...(row.topic_id ? [row.topic_id] : [])])]
    return {
    id: row.id,
    accountId: row.account_id,
    comicId: row.comic_id ?? undefined,
    topicId: topicIds[0],
    topicIds,
    researchTaskId: row.research_task_id ?? undefined,
    matchedKeyword: row.matched_keyword ?? undefined,
    discoveryRank: row.discovery_rank ?? undefined,
    title: row.title,
    author: row.author_name ?? '未知作者',
    sourceUrl: row.source_url,
    likes: row.likes,
    collects: row.collects,
    comments: row.comments,
    capturedAt: formatTime(row.captured_at),
    insight: row.insight,
    noteId: row.source_note_id ?? undefined,
    body: row.body_text ?? row.body_excerpt ?? '',
    publishedAt: row.published_at ? formatTime(row.published_at) : undefined,
    imageCount: row.image_count ?? 0,
    coverUrl: row.cover_url ?? undefined,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags.map(String) : [],
    reviewedAt: row.reviewed_at ? formatTime(row.reviewed_at) : undefined,
    detailCapturedAt: row.detail_captured_at ? formatTime(row.detail_captured_at) : undefined,
    detailError: row.detail_error ?? '',
    detailStatus: ['list_only', 'detailed', 'failed'].includes(row.detail_status) ? row.detail_status : 'list_only',
    reviewStatus: ['candidate', 'kept', 'rejected'].includes(row.review_status) ? row.review_status : 'candidate',
    }
  })
  const assetCounts = new Map<string, number>()
  for (const row of topicAssetsResult.data ?? []) {
    assetCounts.set(row.topic_id, (assetCounts.get(row.topic_id) ?? 0) + 1)
  }
  const usagesByAsset = new Map<string, { count: number; covers: number; lastUsedAt?: string }>()
  for (const row of usageTableMissing ? [] : assetUsagesResult.data ?? []) {
    const current = usagesByAsset.get(row.asset_id) ?? { count: 0, covers: 0 }
    current.count += 1
    if (row.use_type === 'cover') current.covers += 1
    if (!current.lastUsedAt) current.lastUsedAt = formatTime(row.used_at)
    usagesByAsset.set(row.asset_id, current)
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
      sourceReferenceId: row.source_reference_id ?? undefined,
      sourcePosition: row.source_position ?? undefined,
      coverUrl: row.cover_url ?? undefined,
      status: row.status,
      serializationStatus: (['ongoing', 'completed'].includes(row.custom_fields?.serialization_status)
        ? row.custom_fields.serialization_status
        : 'unknown') as ComicSerializationStatus,
      updateWeekday: row.update_weekday ?? undefined,
      updateNote: row.update_note,
      selectionNote: row.selection_note,
      createdAt: formatTime(row.created_at),
    })),
    topics: (topicsResult.data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      comicId: row.comic_id ?? undefined,
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
      brief: row.brief && typeof row.brief === 'object' && typeof row.brief.angle === 'string' ? row.brief as ContentBrief : undefined,
    })),
    references,
    researchTasks: (tasksResult.data ?? []).map((row) => {
      const snapshot = Array.isArray(row.result_snapshot) ? row.result_snapshot as unknown[] : []
      const results = snapshot
        .filter((item): item is Record<string, unknown> => {
          const candidate = item && typeof item === 'object' ? item as Record<string, unknown> : null
          return Boolean(candidate && typeof candidate.url === 'string' && typeof candidate.title === 'string')
        })
        .map((item, index) => ({
          rank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : index + 1,
          noteId: typeof item.noteId === 'string' ? item.noteId : '',
          title: item.title as string,
          author: typeof item.author === 'string' ? item.author : '未知作者',
          likes: Number.isFinite(Number(item.likes)) ? Number(item.likes) : 0,
          publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : null,
          url: item.url as string,
          matchedKeyword: typeof item.matchedKeyword === 'string' ? item.matchedKeyword : undefined,
        }))
      return {
      id: row.id,
      accountId: row.account_id,
      comicId: row.comic_id ?? undefined,
      keyword: row.keyword,
      keywords: Array.isArray(row.keywords) && row.keywords.length ? row.keywords.map(String) : [row.keyword],
      purpose: row.purpose,
      status: ['queued', 'running', 'imported', 'failed'].includes(row.status) ? row.status : 'queued',
      limit: row.result_limit,
      createdAt: formatTime(row.created_at),
      results,
      lastRunAt: row.last_run_at ? formatTime(row.last_run_at) : undefined,
      filters: {
        noteType: 'image' as const,
        publishedWithin: (['all', 'day', 'week', 'half_year'].includes(row.filter_config?.publishedWithin) ? row.filter_config.publishedWithin : 'week') as 'all' | 'day' | 'week' | 'half_year',
        scope: 'unseen' as const,
        sort: 'most_liked' as const,
      },
      }
    }),
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
      comicId: row.comic_id ?? undefined,
      storagePath: row.storage_path,
      originalName: row.original_name,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sourceUrl: row.source_url ?? undefined,
      sourceReferenceId: row.source_reference_id ?? undefined,
      sourcePosition: row.source_position ?? undefined,
      sourceType: row.source_type,
      tags: row.tags ?? [],
      workName: typeof row.custom_fields?.workName === 'string' ? row.custom_fields.workName : '',
      chapter: typeof row.custom_fields?.chapter === 'string' ? row.custom_fields.chapter : '',
      copyrightStatus: (typeof row.custom_fields?.copyrightStatus === 'string' ? row.custom_fields.copyrightStatus : 'unknown') as CopyrightStatus,
      createdAt: formatTime(row.created_at),
      previewUrl: signedUrls.get(row.storage_path),
      topicId: (topicAssetsResult.data ?? []).find((link) => link.asset_id === row.id)?.topic_id,
      topicIds: (topicAssetsResult.data ?? []).filter((link) => link.asset_id === row.id).map((link) => link.topic_id),
      visualFormat: (['single', 'collage', 'uncertain', 'invalid'].includes(row.visual_format) ? row.visual_format : 'uncertain') as AssetVisualFormat,
      classificationConfidence: row.classification_confidence == null ? undefined : Number(row.classification_confidence),
      classificationNote: row.classification_note ?? '',
      reviewStatus: (['pending', 'available', 'rejected', 'archived'].includes(row.review_status) ? row.review_status : 'pending') as AssetReviewStatus,
      contentType: (['cover', 'character', 'interaction', 'plot', 'dialogue', 'atmosphere', 'other'].includes(row.content_type) ? row.content_type : 'other') as AssetContentType,
      characters: row.characters ?? [],
      usageCount: usagesByAsset.get(row.id)?.count ?? 0,
      coverUsageCount: usagesByAsset.get(row.id)?.covers ?? 0,
      lastUsedAt: usagesByAsset.get(row.id)?.lastUsedAt,
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

export async function updateCloudAccount(accountId: string, patch: { name: string; handle: string; positioning: string; accent: string; pillars: string[] }) {
  const { error } = await client().from('accounts').update({
    name: patch.name,
    platform_handle: patch.handle,
    positioning: patch.positioning,
    accent: patch.accent,
    pillars: patch.pillars,
    updated_at: new Date().toISOString(),
  }).eq('id', accountId)
  if (error) throw error
}

export async function createCloudSchedule(
  userId: string,
  accountId: string,
  input: { title: string; kind: 'update' | 'publish' | 'review'; dateLabel: string },
) {
  const { data, error } = await client().from('schedules').insert({
    user_id: userId,
    account_id: accountId,
    title: input.title,
    kind: input.kind,
    custom_fields: { dateLabel: input.dateLabel },
  }).select('id, account_id, title, kind').single()
  if (error) throw error
  return data
}

export async function deleteCloudSchedule(scheduleId: string) {
  const { error } = await client().from('schedules').delete().eq('id', scheduleId)
  if (error) throw error
}

export async function createCloudTopic(userId: string, accountId: string, input: Pick<Topic, 'title' | 'subtitle' | 'pillar' | 'comicId'>) {
  const { data, error } = await client().from('topics').insert({
    user_id: userId,
    account_id: accountId,
    comic_id: input.comicId || null,
    title: input.title,
    subtitle: input.subtitle || '新建选题',
    pillar: input.pillar,
    status: 'idea',
    score: 60,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function createCloudTopicFromReferences(
  userId: string,
  accountId: string,
  input: Pick<Topic, 'title' | 'subtitle' | 'pillar' | 'comicId'>,
  referenceIds: string[],
) {
  if (!referenceIds.length) throw new Error('请至少选择一条参考笔记')
  const db = client()
  const topic = await createCloudTopic(userId, accountId, input)
  const { error: linkError } = await db.from('topic_references').insert(referenceIds.map((referenceId, position) => ({
    topic_id: topic.id,
    reference_id: referenceId,
    position,
    is_primary: position === 0,
    link_source: 'workflow',
  })))
  if (linkError) {
    await db.from('topics').delete().eq('id', topic.id)
    throw linkError
  }
  const { error: reviewError } = await db.from('references').update({ review_status: 'kept' })
    .eq('user_id', userId).eq('account_id', accountId).in('id', referenceIds)
  if (reviewError) {
    await db.from('topics').delete().eq('id', topic.id)
    throw reviewError
  }
  return topic
}

export async function updateCloudReferenceReview(referenceId: string, reviewStatus: 'candidate' | 'kept' | 'rejected') {
  const { error } = await client().from('references').update({ review_status: reviewStatus }).eq('id', referenceId)
  if (error) throw error
}

export async function updateCloudReferenceDetail(
  referenceId: string,
  detail: Pick<ReferenceItem, 'title' | 'author' | 'body' | 'likes' | 'collects' | 'comments' | 'hashtags' | 'imageCount'> & { noteId?: string },
) {
  const { error } = await client().from('references').update({
    title: detail.title || '无标题',
    author_name: detail.author || '未知作者',
    body_text: detail.body,
    likes: detail.likes,
    collects: detail.collects,
    comments: detail.comments,
    hashtags: detail.hashtags,
    image_count: detail.imageCount,
    source_note_id: detail.noteId || null,
    detail_status: 'detailed',
    detail_error: null,
    detail_captured_at: new Date().toISOString(),
  }).eq('id', referenceId)
  if (error) throw error
}

export async function markCloudReferenceDetailFailed(referenceId: string, message: string) {
  const { error } = await client().from('references').update({
    detail_status: 'failed',
    detail_error: message.slice(0, 500),
  }).eq('id', referenceId)
  if (error) throw error
}

export async function updateCloudTopicStatus(topicId: string, status: TopicStatus) {
  const { error } = await client().from('topics').update({ status }).eq('id', topicId)
  if (error) throw error
}

export async function updateCloudTopicBrief(topicId: string, brief: ContentBrief) {
  const { error } = await client().from('topics').update({ brief }).eq('id', topicId)
  if (error) throw error
}

export async function updateCloudAssetReview(
  assetId: string,
  input: { visualFormat: AssetVisualFormat; reviewStatus: AssetReviewStatus; classificationNote: string },
) {
  const { error } = await client().from('assets').update({
    visual_format: input.visualFormat,
    review_status: input.reviewStatus,
    classification_note: input.classificationNote,
  }).eq('id', assetId)
  if (error) throw error
  if (input.visualFormat !== 'single' || input.reviewStatus !== 'available') {
    const { error: linkError } = await client().from('topic_assets').delete().eq('asset_id', assetId)
    if (linkError) throw linkError
  }
}

export async function updateCloudAssetAnalysis(assetId: string, analysis: AssetAnalysis) {
  const { error } = await client().from('assets').update({
    visual_format: analysis.visualFormat,
    review_status: analysis.reviewStatus,
    tags: analysis.tags,
    content_type: analysis.contentType,
    characters: analysis.characters,
    classification_note: analysis.classificationNote,
    classification_confidence: analysis.confidence ?? null,
  }).eq('id', assetId)
  if (error) throw error
  if (analysis.visualFormat !== 'single' || analysis.reviewStatus !== 'available') {
    const { error: linkError } = await client().from('topic_assets').delete().eq('asset_id', assetId)
    if (linkError) throw linkError
  }
}

export async function setCloudTopicAsset(topicId: string, assetId: string, selected: boolean, position: number) {
  const db = client()
  if (!selected) {
    const { error } = await db.from('topic_assets').delete().eq('topic_id', topicId).eq('asset_id', assetId)
    if (error) throw error
    return
  }
  const { error } = await db.from('topic_assets').upsert({
    topic_id: topicId,
    asset_id: assetId,
    position,
    is_cover: position === 0,
  }, { onConflict: 'topic_id,asset_id' })
  if (error) throw error
}

export async function markCloudTopicPublished(topicId: string) {
  const { data, error } = await client().rpc('mark_topic_published', { p_topic_id: topicId })
  if (error) throw error
  return data as string
}

export async function markCloudResearchImported(taskId: string) {
  const { error } = await client().from('research_tasks').update({ status: 'imported', completed_at: new Date().toISOString() }).eq('id', taskId)
  if (error) throw error
}

export async function saveCloudResearchResults(taskId: string, results: XhsResearchResult[]) {
  const { error } = await client().from('research_tasks').update({
    result_snapshot: results,
    last_run_at: new Date().toISOString(),
  }).eq('id', taskId)
  if (error) throw error
}

export async function createCloudResearchTask(userId: string, accountId: string, input: { comicId: string; keywords: string[]; purpose: string; limit: number; publishedWithin: 'all' | 'week' }) {
  const { data, error } = await client().from('research_tasks').insert({
    user_id: userId,
    account_id: accountId,
    comic_id: input.comicId,
    keyword: input.keywords[0],
    keywords: input.keywords,
    purpose: input.purpose,
    result_limit: Math.min(10, Math.max(1, input.limit)),
    status: 'queued',
    provider: 'opencli',
    command_preview: `OpenCLI browser batch: ${input.keywords.map((keyword) => JSON.stringify(keyword)).join(', ')}; image + ${input.publishedWithin === 'all' ? 'all time' : 'week'} + unseen + most_liked; total ${input.limit}`,
    filter_config: { noteType: 'image', publishedWithin: input.publishedWithin, scope: 'unseen', sort: 'most_liked' },
  }).select('*').single()
  if (error) throw error
  return data
}

export async function importCloudResearchResults(userId: string, accountId: string, taskId: string, results: XhsResearchResult[]) {
  const db = client()
  const { data: task, error: taskLookupError } = await db.from('research_tasks').select('comic_id, topic_id').eq('id', taskId).single()
  if (taskLookupError) throw taskLookupError
  if (results.length) {
    const { error: referenceError } = await db.from('references').upsert(results.map((result) => ({
      user_id: userId,
      account_id: accountId,
      comic_id: task.comic_id,
      topic_id: task.topic_id,
      research_task_id: taskId,
      platform: 'xiaohongshu',
      source_url: result.url,
      source_note_id: result.noteId || null,
      author_name: result.author,
      title: result.title,
      likes: result.likes,
      published_at: result.publishedAt,
      matched_keyword: result.matchedKeyword ?? null,
      discovery_rank: result.rank,
      insight: '',
      body_text: '',
      image_count: 0,
      detail_status: 'list_only',
      review_status: 'kept',
      raw_payload: { rank: result.rank, matched_keyword: result.matchedKeyword ?? null, imported_from: 'opencli-browser-filtered-search' },
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
  metadata: { sourceUrl: string; sourceType: string; workName: string; chapter: string; copyrightStatus: CopyrightStatus; tags: string[]; comicId?: string; topicId?: string; sourceReferenceId?: string; sourceNoteId?: string; sourceNoteTags?: string[]; visualFormat?: AssetVisualFormat; contentType?: AssetContentType; characters?: string[]; classificationNote?: string; analyses?: AssetAnalysis[] },
) {
  const db = client()
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  if (!files.length || files.length > 20) throw new Error('每次请选择 1–20 张图片')

  const existingPositions = new Set<number>()
  if (metadata.sourceReferenceId) {
    const { data, error } = await db.from('assets').select('source_position')
      .eq('user_id', userId).eq('account_id', accountId).eq('source_reference_id', metadata.sourceReferenceId)
    if (error) throw error
    for (const row of data ?? []) {
      if (typeof row.source_position === 'number') existingPositions.add(row.source_position)
    }
  }

  for (const [fileIndex, file] of files.entries()) {
    if (metadata.sourceReferenceId && existingPositions.has(fileIndex + 1)) continue
    if (!allowedTypes.has(file.type)) throw new Error(`${file.name} 不是支持的图片格式`)
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} 超过 15MB`)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100) || 'image'
    const analysis = metadata.analyses?.[fileIndex]
    const visualFormat = analysis?.visualFormat ?? metadata.visualFormat ?? 'uncertain'
    const reviewStatus = analysis?.reviewStatus ?? (visualFormat === 'single' ? 'available' : 'pending')
    const storagePath = `${userId}/${accountId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await db.storage.from('content-assets').upload(storagePath, file, { upsert: false, contentType: file.type })
    if (uploadError) throw uploadError

    const { data: asset, error: assetError } = await db.from('assets').insert({
      user_id: userId,
      account_id: accountId,
      comic_id: metadata.comicId || null,
      source_reference_id: metadata.sourceReferenceId || null,
      source_position: metadata.sourceReferenceId ? fileIndex + 1 : null,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      byte_size: file.size,
      source_url: metadata.sourceUrl || null,
      source_type: metadata.sourceType,
      tags: analysis?.tags ?? metadata.tags,
      visual_format: visualFormat,
      review_status: reviewStatus,
      classification_note: analysis?.classificationNote ?? metadata.classificationNote ?? '',
      classification_confidence: analysis?.confidence ?? null,
      content_type: analysis?.contentType ?? metadata.contentType ?? 'other',
      characters: analysis?.characters ?? metadata.characters ?? [],
      chapter_label: metadata.chapter,
      custom_fields: {
        workName: metadata.workName,
        chapter: metadata.chapter,
        copyrightStatus: metadata.copyrightStatus,
        sourceNoteId: metadata.sourceNoteId || null,
        sourceNoteTags: metadata.sourceNoteTags ?? [],
        classificationModel: analysis?.model ?? null,
      },
    }).select('id').single()
    if (assetError) throw assetError

    if (metadata.topicId && visualFormat === 'single' && reviewStatus === 'available') {
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

  const { data: comicRows, error: comicError } = await db.from('comics').insert(demoState.comics.map((comic) => ({
    user_id: userId,
    account_id: resolveAccount(comic.accountId),
    title: comic.title,
    platform: comic.platform,
    source_url: comic.sourceUrl ?? null,
    cover_url: comic.coverUrl ?? null,
    status: comic.status,
    update_weekday: comic.updateWeekday ?? null,
    update_note: comic.updateNote,
    selection_note: comic.selectionNote,
    custom_fields: { serialization_status: comic.serializationStatus },
  }))).select('id, title')
  if (comicError) throw comicError
  const comicIds = new Map(demoState.comics.map((comic) => [comic.id, comicRows.find((row) => row.title === comic.title)?.id]))
  const resolveComic = (demoComicId?: string) => demoComicId ? comicIds.get(demoComicId) ?? null : null

  const { error: topicError } = await db.from('topics').insert(demoState.topics.map((topic) => ({
    user_id: userId,
    account_id: resolveAccount(topic.accountId),
    comic_id: resolveComic(topic.comicId),
    title: topic.title,
    subtitle: topic.subtitle,
    pillar: topic.pillar,
    status: topic.status,
    score: topic.score,
    tags: topic.tags,
    brief: topic.brief ?? {},
  })))
  if (topicError) throw topicError

  const { error: referenceError } = await db.from('references').insert(demoState.references.map((reference) => ({
    user_id: userId,
    account_id: resolveAccount(reference.accountId),
    comic_id: resolveComic(reference.comicId),
    source_url: `${reference.sourceUrl.replace(/\/$/, '')}/explore/${reference.id}`,
    author_name: reference.author,
    title: reference.title,
    likes: reference.likes,
    collects: reference.collects,
    comments: reference.comments,
    insight: reference.insight,
    body_text: reference.body,
    image_count: reference.imageCount,
    detail_status: reference.detailStatus,
    review_status: reference.reviewStatus,
  })))
  if (referenceError) throw referenceError

  const { error: taskError } = await db.from('research_tasks').insert(demoState.researchTasks.map((task) => ({
    user_id: userId,
    account_id: resolveAccount(task.accountId),
    comic_id: resolveComic(task.comicId),
    keyword: task.keyword,
    keywords: task.keywords,
    purpose: task.purpose,
    result_limit: task.limit,
    status: task.status,
    filter_config: task.filters,
  })))
  if (taskError) throw taskError

  const { error: scheduleError } = await db.from('schedules').insert(demoState.schedules.map((schedule) => ({
    user_id: userId,
    account_id: resolveAccount(schedule.accountId),
    comic_id: null,
    title: schedule.title,
    kind: schedule.kind,
    custom_fields: { dateLabel: schedule.dateLabel },
  })))
  if (scheduleError) throw scheduleError
}
