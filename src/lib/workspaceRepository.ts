import { demoState } from '../data/demo'
import type { Topic, TopicStatus, WorkspaceState } from '../types'
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
  const [accountsResult, topicsResult, referencesResult, tasksResult, schedulesResult, topicAssetsResult] = await Promise.all([
    db.from('accounts').select('*').eq('user_id', userId).is('archived_at', null).order('created_at'),
    db.from('topics').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }),
    db.from('references').select('*').eq('user_id', userId).order('captured_at', { ascending: false }),
    db.from('research_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    db.from('schedules').select('*').eq('user_id', userId).order('created_at'),
    db.from('topic_assets').select('topic_id, asset_id'),
  ])

  const failed = [accountsResult, topicsResult, referencesResult, tasksResult, schedulesResult, topicAssetsResult].find((result) => result.error)
  if (failed?.error) throw failed.error

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
      status: row.status === 'imported' ? 'imported' : 'queued',
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
  }
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
