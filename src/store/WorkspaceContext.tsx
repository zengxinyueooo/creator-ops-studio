/* oxlint-disable react/only-export-components -- Provider and hook intentionally share one typed context. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Database, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { demoState } from '../data/demo'
import { dataMode } from '../lib/supabase'
import {
  captureXiaohongshuNote,
  downloadCapturedImage,
} from '../lib/opencliBridge'
import {
  createCloudComic,
  createCloudTopic,
  createCloudTopicFromReferences,
  createCloudResearchTask,
  importCloudResearchResults,
  loadCloudWorkspace,
  markCloudResearchImported,
  seedCloudWorkspace,
  setCloudTopicAsset,
  uploadCloudAssets,
  markCloudTopicPublished,
  updateCloudAssetReview,
  updateCloudComicStatus,
  markCloudReferenceDetailFailed,
  updateCloudReferenceDetail,
  updateCloudReferenceReview,
  updateCloudTopicBrief,
  updateCloudTopicStatus,
} from '../lib/workspaceRepository'
import type { AssetContentType, AssetItem, AssetReviewStatus, AssetVisualFormat, Comic, ComicStatus, ContentBrief, CopyrightStatus, ReferenceItem, Topic, TopicStatus, WorkspaceState, XhsResearchResult } from '../types'

const STORAGE_KEY = 'creator-ops-studio:workspace:v1'
const EMPTY_STATE: WorkspaceState = { accounts: [], activeAccountId: '', comics: [], topics: [], references: [], researchTasks: [], schedules: [], assets: [] }

interface WorkspaceContextValue {
  state: WorkspaceState
  activeAccount: WorkspaceState['accounts'][number]
  accountTopics: Topic[]
  setActiveAccount: (accountId: string) => void
  addComic: (input: Pick<Comic, 'title' | 'platform' | 'selectionNote'> & { sourceUrl: string }) => Promise<void>
  updateComicStatus: (comicId: string, status: ComicStatus) => Promise<void>
  updateTopicStatus: (topicId: string, status: TopicStatus) => void
  generateTopicBrief: (topicId: string) => Promise<void>
  setTopicBriefStatus: (topicId: string, status: 'candidate' | 'approved' | 'rejected') => Promise<void>
  addTopic: (input: Pick<Topic, 'title' | 'subtitle' | 'pillar' | 'comicId'>) => void
  markResearchImported: (taskId: string) => void
  addResearchTask: (input: { comicId: string; keywords: string[]; purpose: string; limit: number }) => Promise<void>
  importResearchResults: (taskId: string, results: XhsResearchResult[]) => Promise<void>
  updateReferenceReview: (referenceId: string, status: ReferenceItem['reviewStatus']) => Promise<void>
  captureReferenceAssets: (referenceId: string) => Promise<{ imageCount: number }>
  createTopicFromReferences: (input: Pick<Topic, 'title' | 'subtitle' | 'pillar' | 'comicId'>, referenceIds: string[]) => Promise<void>
  uploadAssets: (files: File[], metadata: { sourceUrl: string; sourceType: string; workName: string; chapter: string; copyrightStatus: CopyrightStatus; tags: string[]; comicId?: string; topicId?: string; sourceReferenceId?: string; sourceNoteId?: string; sourceNoteTags?: string[]; visualFormat?: AssetVisualFormat; contentType?: AssetContentType; characters?: string[] }) => Promise<void>
  reviewAsset: (assetId: string, visualFormat: AssetVisualFormat, reviewStatus: AssetReviewStatus) => Promise<void>
  toggleTopicAsset: (topicId: string, assetId: string) => Promise<void>
  markTopicPublished: (topicId: string) => Promise<void>
  resetDemo: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function loadLocalState(): WorkspaceState {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return demoState
  try {
    const parsed = JSON.parse(stored) as Partial<WorkspaceState>
    return {
      ...demoState,
      ...parsed,
      accounts: parsed.accounts ?? demoState.accounts,
      comics: parsed.comics ?? [],
      topics: parsed.topics ?? [],
      references: (parsed.references ?? []).map((reference) => ({
        ...reference,
        topicIds: reference.topicIds ?? (reference.topicId ? [reference.topicId] : []),
        hashtags: reference.hashtags ?? [],
        body: reference.body ?? '',
        imageCount: reference.imageCount ?? 0,
        detailError: reference.detailError ?? '',
        detailStatus: reference.detailStatus ?? 'list_only',
        reviewStatus: reference.reviewStatus ?? 'candidate',
      })),
      researchTasks: (parsed.researchTasks ?? []).map((task) => ({
        ...task,
        keywords: task.keywords?.length ? task.keywords : [task.keyword],
        filters: task.filters ?? { noteType: 'image', publishedWithin: 'week', scope: 'unseen', sort: 'most_liked' },
      })),
      schedules: parsed.schedules ?? [],
      assets: (parsed.assets ?? []).map((asset) => ({
        ...asset,
        topicIds: asset.topicIds ?? (asset.topicId ? [asset.topicId] : []),
        visualFormat: asset.visualFormat ?? 'uncertain',
        classificationNote: asset.classificationNote ?? '',
        reviewStatus: asset.reviewStatus ?? 'pending',
        contentType: asset.contentType ?? 'other',
        characters: asset.characters ?? [],
        usageCount: asset.usageCount ?? 0,
        coverUsageCount: asset.coverUsageCount ?? 0,
      })),
    }
  } catch {
    return demoState
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const [state, setState] = useState<WorkspaceState>(() => dataMode === 'local' ? loadLocalState() : EMPTY_STATE)
  const [loading, setLoading] = useState(dataMode === 'supabase')
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (dataMode !== 'supabase' || !user) return
    setLoading(true)
    setError('')
    try {
      setState(await loadCloudWorkspace(user.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '云端数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (dataMode !== 'supabase') return
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    if (dataMode === 'local') localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeAccount = state.accounts.find((account) => account.id === state.activeAccountId) ?? state.accounts[0] ?? demoState.accounts[0]
  const accountTopics = state.topics.filter((topic) => topic.accountId === activeAccount.id)

  const value = useMemo<WorkspaceContextValue>(() => ({
    state,
    activeAccount,
    accountTopics,
    setActiveAccount: (accountId) => {
      localStorage.setItem('creator-ops-studio:active-account', accountId)
      setState((current) => ({ ...current, activeAccountId: accountId }))
    },
    addComic: async (input) => {
      if (dataMode === 'supabase' && user) {
        const row = await createCloudComic(user.id, state.activeAccountId, input)
        setState((current) => ({
          ...current,
          comics: [{
            id: row.id,
            accountId: row.account_id,
            title: row.title,
            platform: row.platform,
            sourceUrl: row.source_url ?? undefined,
            coverUrl: row.cover_url ?? undefined,
            status: row.status,
            serializationStatus: 'unknown',
            updateWeekday: row.update_weekday ?? undefined,
            updateNote: row.update_note,
            selectionNote: row.selection_note,
            createdAt: '刚刚',
          }, ...current.comics],
        }))
        return
      }
      setState((current) => ({
        ...current,
        comics: [{
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          title: input.title,
          platform: input.platform,
          sourceUrl: input.sourceUrl || undefined,
          status: 'candidate',
          serializationStatus: 'unknown',
          updateNote: '',
          selectionNote: input.selectionNote,
          createdAt: '刚刚',
        }, ...current.comics],
      }))
    },
    updateComicStatus: async (comicId, status) => {
      const previous = state
      setState((current) => ({
        ...current,
        comics: current.comics.map((comic) => comic.id === comicId ? { ...comic, status } : comic),
      }))
      if (dataMode === 'supabase') {
        try {
          await updateCloudComicStatus(comicId, status)
        } catch (caught) {
          setState(previous)
          setError(caught instanceof Error ? caught.message : '漫画审核结果保存失败')
          throw caught
        }
      }
    },
    updateTopicStatus: (topicId, status) => {
      const previous = state
      setState((current) => ({
        ...current,
        topics: current.topics.map((topic) => topic.id === topicId ? { ...topic, status, updatedAt: '刚刚' } : topic),
      }))
      if (dataMode === 'supabase') {
        void updateCloudTopicStatus(topicId, status).catch((caught) => {
          setState(previous)
          setError(caught instanceof Error ? caught.message : '选题状态保存失败')
        })
      }
    },
    generateTopicBrief: async (topicId) => {
      const topic = state.topics.find((item) => item.id === topicId)
      if (!topic) throw new Error('选题不存在')
      const comic = state.comics.find((item) => item.id === topic.comicId)
      const references = state.references
        .filter((reference) => reference.topicIds.includes(topicId) && reference.reviewStatus === 'kept')
        .sort((left, right) => right.likes - left.likes)
      const strongestReference = references[0]
      const emotion = topic.tags.slice(0, 3).join('、') || '情绪反差、角色关系'
      const brief: ContentBrief = {
        status: 'candidate',
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
      if (dataMode === 'supabase') await updateCloudTopicBrief(topicId, brief)
      setState((current) => ({
        ...current,
        topics: current.topics.map((item) => item.id === topicId ? { ...item, brief, updatedAt: '刚刚' } : item),
      }))
    },
    setTopicBriefStatus: async (topicId, status) => {
      const topic = state.topics.find((item) => item.id === topicId)
      if (!topic?.brief) throw new Error('这个选题还没有可审核的 Brief')
      const brief = { ...topic.brief, status }
      if (dataMode === 'supabase') await updateCloudTopicBrief(topicId, brief)
      setState((current) => ({
        ...current,
        topics: current.topics.map((item) => item.id === topicId ? { ...item, brief, updatedAt: '刚刚' } : item),
      }))
    },
    addTopic: (input) => {
      if (dataMode === 'supabase' && user) {
        void createCloudTopic(user.id, state.activeAccountId, input).then((row) => {
          setState((current) => ({
            ...current,
            topics: [{
              id: row.id,
              accountId: row.account_id,
              comicId: row.comic_id ?? undefined,
              title: row.title,
              subtitle: row.subtitle,
              status: row.status,
              score: row.score,
              pillar: row.pillar,
              tags: row.tags ?? [],
              referenceCount: 0,
              assetCount: 0,
              updatedAt: '刚刚',
            }, ...current.topics],
          }))
        }).catch((caught) => setError(caught instanceof Error ? caught.message : '选题创建失败'))
        return
      }
      setState((current) => ({
        ...current,
        topics: [{
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          comicId: input.comicId,
          title: input.title,
          subtitle: input.subtitle || '新建选题',
          status: 'idea',
          score: 60,
          pillar: input.pillar,
          tags: [],
          referenceCount: 0,
          assetCount: 0,
          updatedAt: '刚刚',
        }, ...current.topics],
      }))
    },
    markResearchImported: (taskId) => {
      const previous = state
      setState((current) => ({
        ...current,
        researchTasks: current.researchTasks.map((task) => task.id === taskId ? { ...task, status: 'imported' } : task),
      }))
      if (dataMode === 'supabase') {
        void markCloudResearchImported(taskId).catch((caught) => {
          setState(previous)
          setError(caught instanceof Error ? caught.message : '调研任务保存失败')
        })
      }
    },
    addResearchTask: async (input) => {
      const comic = state.comics.find((item) => item.id === input.comicId)
      const publishedWithin = comic?.serializationStatus === 'completed' ? 'all' as const : 'week' as const
      if (dataMode === 'supabase' && user) {
        const row = await createCloudResearchTask(user.id, state.activeAccountId, { ...input, publishedWithin })
        setState((current) => ({
          ...current,
          researchTasks: [{
            id: row.id,
            accountId: row.account_id,
            comicId: row.comic_id ?? undefined,
            keyword: row.keyword,
            keywords: row.keywords?.length ? row.keywords : [row.keyword],
            purpose: row.purpose,
            status: 'queued',
            limit: row.result_limit,
            createdAt: '刚刚',
            filters: { noteType: 'image', publishedWithin, scope: 'unseen', sort: 'most_liked' },
          }, ...current.researchTasks],
        }))
        return
      }
      setState((current) => ({
        ...current,
        researchTasks: [{
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          comicId: input.comicId,
          keyword: input.keywords[0],
          keywords: input.keywords,
          purpose: input.purpose,
          status: 'queued',
          limit: input.limit,
          createdAt: '刚刚',
          filters: { noteType: 'image', publishedWithin, scope: 'unseen', sort: 'most_liked' },
        }, ...current.researchTasks],
      }))
    },
    importResearchResults: async (taskId, results) => {
      if (dataMode === 'supabase' && user) {
        await importCloudResearchResults(user.id, state.activeAccountId, taskId, results)
        await reload()
        return
      }
      setState((current) => ({
        ...current,
        references: [...results.map((result) => ({
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          comicId: state.researchTasks.find((task) => task.id === taskId)?.comicId,
          title: result.title,
          author: result.author,
          sourceUrl: result.url,
          likes: result.likes,
          collects: 0,
          comments: 0,
          capturedAt: '刚刚',
          insight: '',
          noteId: result.noteId || undefined,
          topicIds: [],
          researchTaskId: taskId,
          matchedKeyword: result.matchedKeyword,
          discoveryRank: result.rank,
          body: '',
          publishedAt: result.publishedAt || undefined,
          imageCount: 0,
          hashtags: [],
          detailError: '',
          detailStatus: 'list_only' as const,
          reviewStatus: 'candidate' as const,
        })), ...current.references],
        researchTasks: current.researchTasks.map((task) => task.id === taskId ? { ...task, status: 'imported' } : task),
      }))
    },
    updateReferenceReview: async (referenceId, status) => {
      const previous = state
      setState((current) => ({
        ...current,
        references: current.references.map((reference) => reference.id === referenceId ? { ...reference, reviewStatus: status } : reference),
      }))
      if (dataMode === 'supabase') {
        try {
          await updateCloudReferenceReview(referenceId, status)
        } catch (caught) {
          setState(previous)
          setError(caught instanceof Error ? caught.message : '参考笔记审核结果保存失败')
          throw caught
        }
      }
    },
    captureReferenceAssets: async (referenceId) => {
      const reference = state.references.find((item) => item.id === referenceId)
      if (!reference) throw new Error('参考笔记不存在，请刷新后重试')
      if (reference.reviewStatus !== 'kept') throw new Error('请先将这篇笔记标记为“保留”，再采集详情与素材')
      if (!reference.comicId) throw new Error('这篇笔记未关联漫画，无法写入素材库')
      const comic = state.comics.find((item) => item.id === reference.comicId)
      if (!comic) throw new Error('关联漫画不存在，请刷新后重试')

      let capture
      try {
        capture = await captureXiaohongshuNote(reference.sourceUrl)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : '小红书笔记采集失败'
        if (dataMode === 'supabase') await markCloudReferenceDetailFailed(referenceId, message)
        setState((current) => ({
          ...current,
          references: current.references.map((item) => item.id === referenceId ? { ...item, detailStatus: 'failed', detailError: message } : item),
        }))
        throw caught
      }

      const detail = {
        noteId: capture.noteId,
        title: capture.title || reference.title,
        author: capture.author || reference.author,
        body: capture.body,
        likes: capture.likes,
        collects: capture.collects,
        comments: capture.comments,
        hashtags: capture.hashtags,
        imageCount: capture.imageCount,
      }
      if (dataMode === 'supabase' && user) {
        await updateCloudReferenceDetail(referenceId, detail)
      } else {
        setState((current) => ({
          ...current,
          references: current.references.map((item) => item.id === referenceId ? {
            ...item,
            ...detail,
            detailStatus: 'detailed',
            detailError: '',
            detailCapturedAt: '刚刚',
          } : item),
        }))
      }

      const files = await Promise.all(capture.images.map((image) => downloadCapturedImage(image)))
      const assetMetadata = {
        sourceUrl: reference.sourceUrl,
        sourceType: 'xiaohongshu',
        sourceReferenceId: referenceId,
        sourceNoteId: capture.noteId,
        sourceNoteTags: capture.hashtags,
        workName: comic.title,
        chapter: capture.title || '来源笔记片段',
        copyrightStatus: 'reference_only' as const,
        tags: [],
        comicId: reference.comicId,
        visualFormat: 'uncertain' as const,
        contentType: 'other' as const,
        characters: [],
      }
      if (dataMode === 'supabase' && user) {
        await uploadCloudAssets(user.id, state.activeAccountId, files, assetMetadata)
        await reload()
      } else {
        setState((current) => ({
          ...current,
          assets: [...files.map((file, fileIndex): AssetItem => ({
            id: crypto.randomUUID(),
            accountId: current.activeAccountId,
            comicId: reference.comicId,
            storagePath: '',
            originalName: file.name,
            mimeType: file.type,
            byteSize: file.size,
            sourceUrl: reference.sourceUrl,
            sourceReferenceId: referenceId,
            sourcePosition: fileIndex + 1,
            sourceType: 'xiaohongshu',
            tags: [],
            workName: comic.title,
            chapter: capture.title || '来源笔记片段',
            copyrightStatus: 'reference_only',
            createdAt: '刚刚',
            previewUrl: URL.createObjectURL(file),
            topicIds: [],
            visualFormat: 'uncertain',
            classificationNote: `第 ${fileIndex + 1} 张 · 自动采集，待确认是否为单张连续画面`,
            reviewStatus: 'pending',
            contentType: 'other',
            characters: [],
            usageCount: 0,
            coverUsageCount: 0,
          })), ...current.assets],
        }))
      }
      return { imageCount: files.length }
    },
    createTopicFromReferences: async (input, referenceIds) => {
      if (!referenceIds.length) throw new Error('请至少选择一条参考笔记')
      const selectedReferences = state.references.filter((reference) => referenceIds.includes(reference.id))
      if (selectedReferences.length !== referenceIds.length) throw new Error('部分参考笔记已不存在，请刷新后重试')
      if (selectedReferences.some((reference) => reference.comicId !== input.comicId)) throw new Error('一次只能合并同一部漫画的参考笔记')

      if (dataMode === 'supabase' && user) {
        await createCloudTopicFromReferences(user.id, state.activeAccountId, input, referenceIds)
        await reload()
        return
      }

      const topicId = crypto.randomUUID()
      setState((current) => ({
        ...current,
        topics: [{
          id: topicId,
          accountId: current.activeAccountId,
          comicId: input.comicId,
          title: input.title,
          subtitle: input.subtitle || '由参考笔记沉淀',
          status: 'idea',
          score: 60,
          pillar: input.pillar,
          tags: [],
          referenceCount: referenceIds.length,
          assetCount: 0,
          updatedAt: '刚刚',
        }, ...current.topics],
        references: current.references.map((reference) => referenceIds.includes(reference.id) ? { ...reference, topicId: reference.topicId ?? topicId, topicIds: [...new Set([...reference.topicIds, topicId])], reviewStatus: 'kept' } : reference),
      }))
    },
    uploadAssets: async (files, metadata) => {
      if (dataMode === 'supabase' && user) {
        await uploadCloudAssets(user.id, state.activeAccountId, files, metadata)
        await reload()
        return
      }
      setState((current) => ({
        ...current,
        assets: [...files.map((file, fileIndex): AssetItem => ({
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          comicId: metadata.comicId,
          storagePath: '',
          originalName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          sourceUrl: metadata.sourceUrl || undefined,
          sourceReferenceId: metadata.sourceReferenceId,
          sourcePosition: metadata.sourceReferenceId ? fileIndex + 1 : undefined,
          sourceType: metadata.sourceType,
          tags: metadata.tags,
          workName: metadata.workName,
          chapter: metadata.chapter,
          copyrightStatus: metadata.copyrightStatus,
          createdAt: '刚刚',
          previewUrl: URL.createObjectURL(file),
          topicId: metadata.topicId,
          topicIds: metadata.topicId ? [metadata.topicId] : [],
          visualFormat: metadata.visualFormat ?? 'uncertain',
          classificationNote: metadata.visualFormat === 'single' ? '人工确认为单图' : '',
          reviewStatus: metadata.visualFormat === 'single' ? 'available' : 'pending',
          contentType: metadata.contentType ?? 'other',
          characters: metadata.characters ?? [],
          usageCount: 0,
          coverUsageCount: 0,
        })), ...current.assets],
      }))
    },
    reviewAsset: async (assetId, visualFormat, reviewStatus) => {
      const asset = state.assets.find((item) => item.id === assetId)
      if (!asset) throw new Error('素材不存在')
      const classificationNote = visualFormat === 'single' ? '人工确认为单图' : visualFormat === 'collage' ? '人工确认为拼图' : asset.classificationNote
      if (dataMode === 'supabase') {
        await updateCloudAssetReview(assetId, { visualFormat, reviewStatus, classificationNote })
        await reload()
        return
      }
      setState((current) => ({
        ...current,
        assets: current.assets.map((item) => item.id === assetId ? {
          ...item,
          visualFormat,
          reviewStatus,
          classificationNote,
          topicIds: visualFormat === 'single' && reviewStatus === 'available' ? item.topicIds : [],
          topicId: visualFormat === 'single' && reviewStatus === 'available' ? item.topicId : undefined,
        } : item),
        topics: visualFormat === 'single' && reviewStatus === 'available'
          ? current.topics
          : current.topics.map((topic) => asset.topicIds.includes(topic.id)
            ? { ...topic, assetCount: Math.max(0, topic.assetCount - 1), updatedAt: '刚刚' }
            : topic),
      }))
    },
    toggleTopicAsset: async (topicId, assetId) => {
      const asset = state.assets.find((item) => item.id === assetId)
      if (!asset) throw new Error('素材不存在')
      if (asset.visualFormat !== 'single' || asset.reviewStatus !== 'available') throw new Error('只有审核通过的单图可以选择')
      const selected = !asset.topicIds.includes(topicId)
      const position = state.assets.filter((item) => item.topicIds.includes(topicId)).length
      if (dataMode === 'supabase') {
        await setCloudTopicAsset(topicId, assetId, selected, position)
        await reload()
        return
      }
      setState((current) => ({
        ...current,
        assets: current.assets.map((item) => item.id === assetId ? {
          ...item,
          topicIds: selected ? [...item.topicIds, topicId] : item.topicIds.filter((id) => id !== topicId),
          topicId: selected ? topicId : item.topicId === topicId ? undefined : item.topicId,
        } : item),
        topics: current.topics.map((topic) => topic.id === topicId ? { ...topic, assetCount: Math.max(0, topic.assetCount + (selected ? 1 : -1)), updatedAt: '刚刚' } : topic),
      }))
    },
    markTopicPublished: async (topicId) => {
      const topic = state.topics.find((item) => item.id === topicId)
      if (!topic) throw new Error('选题不存在')
      const selectedAssets = state.assets.filter((asset) => asset.topicIds.includes(topicId) && asset.visualFormat === 'single' && asset.reviewStatus === 'available')
      if (!selectedAssets.length) throw new Error('请先为这个 Brief 选择至少一张单图素材')
      if (dataMode === 'supabase') {
        await markCloudTopicPublished(topicId)
        await reload()
        return
      }
      setState((current) => ({
        ...current,
        topics: current.topics.map((item) => item.id === topicId ? { ...item, status: 'published', updatedAt: '刚刚' } : item),
        assets: current.assets.map((asset) => selectedAssets.some((selectedAsset) => selectedAsset.id === asset.id) ? { ...asset, usageCount: asset.usageCount + 1, coverUsageCount: asset.coverUsageCount + (selectedAssets[0]?.id === asset.id ? 1 : 0), lastUsedAt: '刚刚' } : asset),
      }))
    },
    resetDemo: () => dataMode === 'local' ? setState(demoState) : void reload(),
  }), [accountTopics, activeAccount, reload, state, user])

  if (loading) return <div className="app-state">正在读取 Supabase 数据…</div>

  if (error && state.accounts.length === 0) {
    return <div className="app-state-card"><Database size={28} /><h2>云端数据暂时无法读取</h2><p>{error}</p><button className="primary-button" onClick={() => void reload()}><RefreshCw size={15} />重新加载</button></div>
  }

  if (dataMode === 'supabase' && state.accounts.length === 0) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <span className="auth-logo"><Sparkles size={20} /></span>
          <span className="eyebrow">FIRST RUN</span>
          <h1>数据库已经准备好了</h1>
          <p>初始化后会创建“漫画放映室”和“成长实验室”两个账号，并加入少量示例选题，方便你直接开始整理。</p>
          {error && <p className="form-message error">{error}</p>}
          <button className="primary-button" disabled={seeding} onClick={() => {
            if (!user) return
            setSeeding(true)
            setError('')
            void seedCloudWorkspace(user.id).then(reload).catch((caught) => {
              setError(caught instanceof Error ? caught.message : '初始化失败')
            }).finally(() => setSeeding(false))
          }}>{seeding ? '正在初始化…' : '初始化我的工作台'}</button>
          <button className="auth-switch" onClick={() => void signOut()}>退出当前账号</button>
        </section>
      </main>
    )
  }

  return <WorkspaceContext.Provider value={value}>{error && <div className="sync-error">{error}</div>}{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}
