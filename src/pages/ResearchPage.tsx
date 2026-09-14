import { BookOpenCheck, Check, ChevronDown, ChevronRight, Clipboard, Compass, ExternalLink, ImageDown, Import, Layers3, Library, LoaderCircle, PenLine, Play, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, TerminalSquare, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { searchXiaohongshuBatch } from '../lib/opencliBridge'
import { enqueueCloudResearchRun, loadLatestCloudResearchRun } from '../lib/workspaceRepository'
import { agentProgressMessage, runAgentWorkflow } from '../lib/agentWorkflow'
import { useRecoveredAgentRun } from '../lib/useRecoveredAgentRun'
import { AgentRunStatus } from '../components/AgentRunStatus'
import { dataMode } from '../lib/supabase'
import { PillSelect } from '../components/PillSelect'
import { ExecutionHistory } from '../components/ExecutionHistory'
import { useWorkspace } from '../store/WorkspaceContext'
import type { AgentRun, ReferenceItem, XhsResearchResult } from '../types'

type ReferenceFilter = 'all' | ReferenceItem['reviewStatus']

const reviewLabels: Record<ReferenceItem['reviewStatus'], { label: string; tone: string }> = {
  candidate: { label: '待审核', tone: 'amber' },
  kept: { label: '已保留', tone: 'green' },
  rejected: { label: '已排除', tone: 'gray' },
}

function defaultKeywordSuggestions(title: string, serializationStatus: 'ongoing' | 'completed' | 'unknown' | undefined) {
  const angles = serializationStatus === 'completed'
    ? ['名场面', '高甜互动', '经典台词']
    : ['最新话', '高光片段', '角色互动']
  return angles.map((angle) => `${title} ${angle}`)
}

function resultAlreadySaved(result: XhsResearchResult, references: ReferenceItem[]) {
  return references.some((reference) => (
    Boolean(result.noteId && reference.noteId && result.noteId === reference.noteId)
    || reference.sourceUrl === result.url
  ))
}

function ReferenceActions({ reference, locallyCapturing, reviewing, onCapture, onReview, onRecoveredSuccess }: {
  reference: ReferenceItem
  locallyCapturing: boolean
  reviewing: boolean
  onCapture: () => void
  onReview: (status: ReferenceItem['reviewStatus']) => void
  onRecoveredSuccess: () => void | Promise<void>
}) {
  const recovered = useRecoveredAgentRun(
    { runType: 'note_capture', targetType: 'reference', targetId: reference.id },
    onRecoveredSuccess,
  )
  const busy = locallyCapturing || recovered.active
  return <>
    <div className="reference-actions">
      <a className="icon-button" aria-label="打开原笔记" href={reference.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>
      {reference.reviewStatus === 'kept' && <button className="secondary-button capture-button" type="button" disabled={busy} onClick={onCapture}>{busy ? <LoaderCircle className="spin" size={14} /> : <ImageDown size={14} />}{busy ? '采集中…' : reference.detailStatus === 'detailed' ? '重新采集' : '采集详情与素材'}</button>}
      <button className="secondary-button" type="button" disabled={reviewing || busy} onClick={() => onReview('rejected')}><X size={14} />排除</button>
      <button className="secondary-button keep-button" type="button" disabled={reviewing || busy} onClick={() => onReview('kept')}><Check size={14} />保留</button>
    </div>
    <AgentRunStatus run={recovered.run} error={recovered.error} successText="详情与图片素材已采集" />
  </>
}

export function ResearchPage() {
  const { activeAccount, state, addResearchTask, saveResearchResults, importResearchResults, updateReferenceReview, captureReferenceAssets, createTopicFromReferences, reloadWorkspace } = useWorkspace()
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const validComicIds = new Set(comics.map((comic) => comic.id))
  const references = state.references.filter((reference) => reference.accountId === activeAccount.id && reference.comicId && validComicIds.has(reference.comicId))
  const [comicId, setComicId] = useState(() => comics.find((comic) => comic.status === 'following' || comic.status === 'selected')?.id ?? comics[0]?.id ?? '')
  const selectedComic = comics.find((comic) => comic.id === comicId)
  const isCompletedComic = selectedComic?.serializationStatus === 'completed'
  const suggestedKeywords = selectedComic ? defaultKeywordSuggestions(selectedComic.title, selectedComic.serializationStatus) : []
  const [keywordText, setKeywordText] = useState('')
  const [keywordSelection, setKeywordSelection] = useState<string[] | null>(null)
  const [purpose, setPurpose] = useState('')
  const [creating, setCreating] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun>>({})
  const [importingTaskId, setImportingTaskId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showImported, setShowImported] = useState(false)
  const [previews, setPreviews] = useState<Record<string, XhsResearchResult[]>>({})
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [referenceFilter, setReferenceFilter] = useState<ReferenceFilter>('all')
  const [referenceQuery, setReferenceQuery] = useState('')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [reviewingReferenceId, setReviewingReferenceId] = useState<string | null>(null)
  const [capturingReferenceId, setCapturingReferenceId] = useState<string | null>(null)
  const [captureFeedback, setCaptureFeedback] = useState<Record<string, { text: string; error: boolean }>>({})
  const [topicTitle, setTopicTitle] = useState('')
  const [topicSubtitle, setTopicSubtitle] = useState('')
  const [topicPillar, setTopicPillar] = useState(activeAccount.pillars[0] ?? '高能片段')
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [topicFeedback, setTopicFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const selectedKeywords = keywordSelection ?? suggestedKeywords
  const tasks = useMemo(() => {
    const currentComicIds = new Set(state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived').map((comic) => comic.id))
    return state.researchTasks.filter((task) => task.accountId === activeAccount.id && task.comicId && currentComicIds.has(task.comicId))
  }, [activeAccount.id, state.comics, state.researchTasks])
  const taskHasUnsavedResults = (task: (typeof tasks)[number]) => (task.results ?? []).some((result) => !resultAlreadySaved(result, references))
  const pendingTasks = tasks.filter((task) => task.status !== 'imported' || taskHasUnsavedResults(task))
  const importedTasks = tasks.filter((task) => task.status === 'imported' && !taskHasUnsavedResults(task))
  const selectedReferences = references.filter((reference) => selectedReferenceIds.includes(reference.id))
  const selectionComicId = selectedReferences[0]?.comicId
  const visibleReferences = references.filter((reference) => {
    if (referenceFilter !== 'all' && reference.reviewStatus !== referenceFilter) return false
    const query = referenceQuery.trim().toLowerCase()
    if (!query) return true
    const comic = comics.find((item) => item.id === reference.comicId)
    return [reference.title, reference.author, reference.body, comic?.title].some((value) => value?.toLowerCase().includes(query))
  })

  useEffect(() => {
    if (dataMode !== 'supabase' || !tasks.length) return
    let stopped = false
    let timer: number | undefined
    const poll = async () => {
      const rows = await Promise.all(tasks.map(async (task) => [task.id, await loadLatestCloudResearchRun(task.id)] as const))
      if (stopped) return
      const next = Object.fromEntries(rows.filter((entry): entry is readonly [string, AgentRun] => Boolean(entry[1])))
      setAgentRuns(next)
      for (const [taskId, run] of Object.entries(next)) {
        if (run.status === 'succeeded' && run.output.results) {
          const current = tasks.find((task) => task.id === taskId)?.results ?? []
          if (JSON.stringify(current) !== JSON.stringify(run.output.results)) {
            await saveResearchResults(taskId, run.output.results)
            setPreviews((value) => ({ ...value, [taskId]: run.output.results ?? [] }))
            setSelected((value) => ({ ...value, [taskId]: (run.output.results ?? []).map((result) => result.url) }))
          }
        }
      }
      if (!stopped && Object.values(next).some((run) => run.status === 'queued' || run.status === 'running')) timer = window.setTimeout(() => void poll(), 1800)
    }
    void poll().catch((caught) => !stopped && setError(caught instanceof Error ? caught.message : '读取 Worker 进度失败'))
    return () => { stopped = true; if (timer) window.clearTimeout(timer) }
  }, [runningTaskId, saveResearchResults, tasks])

  function parseKeywords(value: string) {
    return [...new Set(value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))]
  }

  function validateKeywords(keywords: string[], selectedComicId: string) {
    if (!selectedComicId) throw new Error('请先从漫画候选库选择一部漫画')
    if (keywords.length < 2 || keywords.length > 3) throw new Error('每个调研批次需要填写 2–3 个不重复关键词')
    const comic = comics.find((item) => item.id === selectedComicId)
    if (!comic) throw new Error('所选漫画不存在')
    if (keywords.some((keyword) => !keyword.includes(comic.title))) throw new Error(`每个关键词都必须完整包含漫画名“${comic.title}”`)
    if (comic.serializationStatus === 'completed' && keywords.some((keyword) => /最新话|新话|本周更新|更新日/.test(keyword))) {
      throw new Error(`《${comic.title}》已完结，请用“名场面、角色互动、经典台词”等关键词调研`)
    }
    return comic
  }

  async function createTask(event: FormEvent) {
    event.preventDefault()
    if (!comicId) {
      setError('请先选择所属漫画')
      return
    }
    const keywords = [...new Set([...selectedKeywords, ...parseKeywords(keywordText)])]
    setCreating(true)
    setError('')
    setMessage('')
    try {
      validateKeywords(keywords, comicId)
      await addResearchTask({ comicId, keywords, purpose: purpose.trim(), limit: 10 })
      setKeywordText('')
      setPurpose('')
      setMessage('调研任务已创建，可以在下方手动执行。')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '调研任务创建失败')
    } finally {
      setCreating(false)
    }
  }

  function toggleSuggestedKeyword(keyword: string) {
    setKeywordSelection((current) => {
      const active = current ?? suggestedKeywords
      if (active.includes(keyword)) return active.filter((item) => item !== keyword)
      if (active.length >= 3) {
        setError('每个调研批次最多选择 3 个关键词；如需自定义，请先取消一个建议词')
        return active
      }
      setError('')
      return [...active, keyword]
    })
  }

  async function runTask(taskId: string, taskComicId: string | undefined, taskKeywords: string[], taskLimit: number, publishedWithin: 'all' | 'day' | 'week' | 'half_year') {
    setRunningTaskId(taskId)
    setError('')
    setMessage('')
    try {
      const comic = validateKeywords(taskKeywords, taskComicId ?? '')
      if (dataMode === 'supabase') {
        await enqueueCloudResearchRun(taskId, activeAccount.id)
        const run = await loadLatestCloudResearchRun(taskId)
        if (run) setAgentRuns((current) => ({ ...current, [taskId]: run }))
        setMessage('任务已进入本机 Worker 队列；页面会自动刷新执行进度。')
        return
      }
      const importedNoteIds = new Set(references.map((reference) => reference.noteId).filter(Boolean))
      const results = (await searchXiaohongshuBatch(taskKeywords, comic.title, taskLimit, publishedWithin === 'all' ? 'all' : 'week'))
        .filter((result) => !result.noteId || !importedNoteIds.has(result.noteId))
      await saveResearchResults(taskId, results)
      setPreviews((current) => ({ ...current, [taskId]: results }))
      setSelected((current) => ({ ...current, [taskId]: results.map((result) => result.url) }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'OpenCLI 查询失败')
    } finally {
      setRunningTaskId(null)
    }
  }

  async function confirmImport(taskId: string) {
    const results = previews[taskId] ?? tasks.find((task) => task.id === taskId)?.results ?? []
    const selectedUrls = new Set(selected[taskId] ?? [])
    const approved = results.filter((result) => selectedUrls.has(result.url) && !resultAlreadySaved(result, references))
    if (!approved.length) return
    setImportingTaskId(taskId)
    setError('')
    setMessage('')
    try {
      await importResearchResults(taskId, approved)
      setPreviews((current) => {
        const next = { ...current }
        delete next[taskId]
        return next
      })
      setSelected((current) => {
        const next = { ...current }
        delete next[taskId]
        return next
      })
      setMessage(`已将 ${approved.length} 条笔记保留为参考资产。下一步可直接采集正文和素材，或选择同一漫画的笔记创建选题草案。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入 Supabase 失败')
    } finally {
      setImportingTaskId(null)
    }
  }

  async function copyKeywords(taskId: string, keywords: string[]) {
    await navigator.clipboard.writeText(keywords.join('\n'))
    setCopied(taskId)
    window.setTimeout(() => setCopied(null), 1600)
  }

  function toggleResult(taskId: string, url: string) {
    setSelected((current) => {
      const values = new Set(current[taskId] ?? [])
      if (values.has(url)) values.delete(url)
      else values.add(url)
      return { ...current, [taskId]: [...values] }
    })
  }

  function toggleReference(reference: ReferenceItem) {
    if (selectionComicId && reference.comicId !== selectionComicId) {
      setError('一次只能选择同一部漫画的参考笔记')
      return
    }
    if (!selectedReferenceIds.includes(reference.id) && selectedReferenceIds.length >= 4) {
      setError('一次最多选择 4 条参考笔记')
      return
    }
    setError('')
    setSelectedReferenceIds((current) => current.includes(reference.id) ? current.filter((id) => id !== reference.id) : [...current, reference.id])
    setTopicTitle((current) => current || reference.title)
  }

  async function reviewReference(referenceId: string, status: ReferenceItem['reviewStatus']) {
    setReviewingReferenceId(referenceId)
    setError('')
    try {
      await updateReferenceReview(referenceId, status)
      if (status === 'rejected') setSelectedReferenceIds((current) => current.filter((id) => id !== referenceId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '参考笔记审核失败')
    } finally {
      setReviewingReferenceId(null)
    }
  }

  async function captureReference(reference: ReferenceItem) {
    setCapturingReferenceId(reference.id)
    setCaptureFeedback((current) => ({ ...current, [reference.id]: { text: '正在提交采集任务…', error: false } }))
    setError('')
    setMessage('')
    try {
      if (dataMode === 'supabase') {
        const run = await runAgentWorkflow({ runType: 'note_capture', targetType: 'reference', targetId: reference.id, accountId: reference.accountId }, (value) => {
          const progress = agentProgressMessage(value)
          setCaptureFeedback((current) => ({ ...current, [reference.id]: { text: progress, error: value.status === 'failed' || value.status === 'cancelled' } }))
          setMessage(progress)
        })
        setMessage(run.events.at(-1)?.message ?? '详情与素材已采集。')
        window.location.reload()
        return
      }
      const result = await captureReferenceAssets(reference.id)
      setCaptureFeedback((current) => ({ ...current, [reference.id]: { text: `已采集 ${result.imageCount} 张图片，素材已入库。`, error: false } }))
      setMessage(`已采集《${reference.title}》的正文、话题与 ${result.imageCount} 张图片；素材已进入素材筛选台，等待图片结构审核。`)
    } catch (caught) {
      setCaptureFeedback((current) => ({ ...current, [reference.id]: { text: caught instanceof Error ? caught.message : '笔记详情与素材采集失败', error: true } }))
      setError(caught instanceof Error ? caught.message : '笔记详情与素材采集失败')
    } finally {
      setCapturingReferenceId(null)
    }
  }

  async function createTopic(event: FormEvent) {
    event.preventDefault()
    if (creatingTopic) return
    setTopicFeedback(null)
    if (!selectedReferences.length || !selectionComicId) {
      setTopicFeedback({ error: true, text: '请先勾选下方参考笔记库中同一部漫画的笔记。' })
      return
    }
    if (selectedReferences.length > 4) {
      setTopicFeedback({ error: true, text: '一次最多使用 4 条参考笔记。' })
      return
    }
    const incomplete = selectedReferences.find((reference) => {
      if (reference.reviewStatus !== 'kept' || reference.detailStatus !== 'detailed' || !reference.body.trim() || reference.imageCount < 1) return true
      const positions = new Set(state.assets.filter((asset) => asset.accountId === reference.accountId && asset.comicId === reference.comicId && asset.sourceReferenceId === reference.id).map((asset) => asset.sourcePosition))
      return Array.from({ length: reference.imageCount }, (_, index) => index + 1).some((position) => !positions.has(position))
    })
    if (incomplete) {
      setTopicFeedback({ error: true, text: `《${incomplete.title}》尚未完整采集正文和全部图片，请先完成采集。` })
      return
    }
    if (!topicTitle.trim()) {
      setTopicFeedback({ error: true, text: '请填写选题标题。' })
      return
    }
    setCreatingTopic(true)
    setError('')
    setMessage('')
    try {
      if (dataMode === 'supabase') {
        await runAgentWorkflow({ runType: 'topic_synthesis', targetType: 'reference_set', targetId: crypto.randomUUID(), accountId: activeAccount.id, payload: { referenceIds: selectedReferenceIds, title: topicTitle.trim(), subtitle: topicSubtitle.trim(), pillar: topicPillar } }, (run) => {
          const progress = run.events.at(-1)?.message
          if (progress) setTopicFeedback({ error: false, text: progress })
        })
        window.location.reload()
        return
      }
      await createTopicFromReferences({ title: topicTitle.trim(), subtitle: topicSubtitle.trim() || `由 ${selectedReferences.length} 条参考笔记提炼`, pillar: topicPillar, comicId: selectionComicId }, selectedReferenceIds)
      setSelectedReferenceIds([])
      setTopicTitle('')
      setTopicSubtitle('')
      setTopicFeedback({ error: false, text: `选题《${topicTitle.trim()}》已创建，参考笔记已关联。` })
    } catch (caught) {
      const detail = caught && typeof caught === 'object' && 'message' in caught ? String(caught.message) : '请稍后重试'
      setTopicFeedback({ error: true, text: `创建失败：${detail}` })
    } finally {
      setCreatingTopic(false)
    }
  }

  function renderTask(task: (typeof tasks)[number], imported = false) {
    const results = previews[task.id] ?? task.results ?? []
    const selectedUrls = new Set(selected[task.id] ?? [])
    const taskComic = comics.find((comic) => comic.id === task.comicId)
    const savedResultUrls = new Set(results.filter((result) => resultAlreadySaved(result, references)).map((result) => result.url))
    const selectedImportCount = results.filter((result) => selectedUrls.has(result.url) && !savedResultUrls.has(result.url)).length
    const isPartiallyImported = task.status === 'imported' && savedResultUrls.size < results.length
    const run = agentRuns[task.id]
    const runActive = run?.status === 'queued' || run?.status === 'running'
    const statusLabel = run?.status === 'failed' ? '执行失败' : runActive ? (run.status === 'queued' ? '排队中' : '执行中') : isPartiallyImported ? '待补充' : task.status === 'imported' ? '已导入' : results.length ? '待审核' : '待执行'
    const statusTone = run?.status === 'failed' ? 'red' : runActive ? 'amber' : isPartiallyImported ? 'amber' : task.status === 'imported' ? 'green' : 'blue'
    return <article className={`research-task research-task-card ${imported ? 'is-imported' : ''}`} key={task.id}>
<div className="research-task-summary"><div><span className={`status-badge ${statusTone}`}>{statusLabel}</span>{taskComic && <span className="research-comic-label">《{taskComic.title}》</span>}<div className="keyword-tags">{task.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>{task.purpose ? <p className="task-purpose"><Compass size={13} />{task.purpose}</p> : <span className="purpose-hint">待补充调研目的</span>}<div className="research-filter-row"><span>图文</span>{task.filters.publishedWithin !== 'all' && <span>近一周</span>}<span>工作台未导入</span><span>按点赞排序</span></div><div className="task-meta-row"><span>跨词去重</span><span>上限 {task.limit} 条</span>{task.lastRunAt ? <span>最近查询 {task.lastRunAt}</span> : <span>创建于 {task.createdAt}</span>}</div>{run && <div className={`agent-progress ${run.status}`}><LoaderCircle className={runActive ? 'spin' : ''} size={14} /><div><strong>{run.status === 'failed' ? '调研执行失败' : run.events.at(-1)?.message ?? run.currentStep}</strong>{run.errorMessage && <small>{run.errorMessage}</small>}<span>{run.status === 'succeeded' ? 'Pi 调研已完成，等待你勾选导入' : 'Node Worker · Pi AgentSession'}</span></div></div>}</div><div className="task-actions"><button className="secondary-button" type="button" onClick={() => copyKeywords(task.id, task.keywords)}>{copied === task.id ? <Check size={16} /> : <Clipboard size={16} />}{copied === task.id ? '已复制' : '复制关键词'}</button>{task.status !== 'imported' && <button className="primary-button" type="button" onClick={() => runTask(task.id, task.comicId, task.keywords, task.limit, task.filters.publishedWithin)} disabled={runningTaskId === task.id || runActive}>{runningTaskId === task.id || runActive ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{runActive ? (run.status === 'queued' ? '等待 Worker…' : 'Pi 执行中…') : runningTaskId === task.id ? '正在入队…' : results.length ? '重新查询' : '本机执行'}</button>}</div></div>
              {results.length > 0 && <div className="research-preview"><div className="research-preview-heading"><strong>查询结果</strong><span>已选择 {selectedImportCount}/{results.length - savedResultUrls.size} 条{savedResultUrls.size > 0 ? ` · 已保存 ${savedResultUrls.size} 条` : ''}</span></div>{results.map((result) => {
                const isSaved = savedResultUrls.has(result.url)
                return <div className={`research-result ${isSaved ? 'is-saved' : ''}`} key={result.url}><input aria-label={isSaved ? `${result.title} 已保存` : `选择 ${result.title}`} type="checkbox" checked={isSaved || selectedUrls.has(result.url)} disabled={isSaved} onChange={() => toggleResult(task.id, result.url)} /><span className="result-rank">{result.rank}</span><span><strong>{result.title}{isSaved && <b className="result-saved-badge">已保存</b>}</strong><small>{result.matchedKeyword && <b className="result-keyword">{result.matchedKeyword}</b>}{result.author} · {result.likes.toLocaleString()} 赞{result.publishedAt ? ` · ${result.publishedAt}` : ''}</small></span><a aria-label={`打开 ${result.title}`} href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a></div>
              })}<button className="primary-button import-confirm" type="button" disabled={importingTaskId === task.id || selectedImportCount === 0} onClick={() => confirmImport(task.id)}><Import size={15} />{importingTaskId === task.id ? '正在导入…' : `${task.status === 'imported' ? '补充导入' : '确认导入'} ${selectedImportCount} 条`}</button></div>}
            </article>
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">RESEARCH INBOX</span><h1>调研导入箱</h1><p>按漫画检索笔记，人工审核后沉淀为选题；搜索、导入和转选题都不会自动发布。</p></div><span className="safe-label"><ShieldCheck size={15} />只读搜索 · 人工审核</span></section>
      <section className="integration-banner"><div className="integration-logo"><TerminalSquare size={25} /></div><div><h2>OpenCLI 小红书浏览器调研</h2><p>固定读取图文首屏；连载作品按近一周过滤、结果按点赞排序，并排除已导入工作台的笔记。不自动滚动或发布。</p></div><a href="https://github.com/jackwener/OpenCLI" target="_blank" rel="noreferrer">查看项目 <ExternalLink size={14} /></a></section>

      <form className="research-create-form" onSubmit={createTask}>
        <div className="field-group">
          <span className="field-label"><Library size={13} />所属漫画</span>
          <PillSelect value={comicId} ariaLabel="所属漫画" placeholder="选择所属漫画" options={[{ value: '', label: '选择所属漫画' }, ...comics.map((comic) => ({ value: comic.id, label: comic.title }))]} onChange={(nextId) => { setComicId(nextId); setKeywordSelection(null); setKeywordText('') }} />
        </div>
        <div className="field-group">
          <span className="field-label"><PenLine size={13} />调研目的</span>
          <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder={isCompletedComic ? '例如：寻找高赞名场面的选题角度' : '例如：寻找最新话的高赞选题角度'} maxLength={160} />
        </div>
        <div className="field-group">
          <span className="field-label"><SlidersHorizontal size={13} />抓取规则</span>
          <div className="research-fixed-limit"><strong>10 条</strong><span>{isCompletedComic ? '不限时间 · 去重上限' : '一周内 · 去重上限'}</span></div>
        </div>
        <div className="field-group field-full">
          <span className="field-label"><Sparkles size={13} />调研关键词<span className="field-hint">已选 {selectedKeywords.length}/3 · 点选建议词，或补充自定义关键词</span></span>
          <div className="research-keyword-picker">
            <div className="keyword-options">{suggestedKeywords.map((keyword) => <label key={keyword}><input type="checkbox" checked={selectedKeywords.includes(keyword)} onChange={() => toggleSuggestedKeyword(keyword)} />{keyword}</label>)}</div>
            <input value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder="补充自定义关键词（最多 3 个；先取消一个建议词，才能再选新的）" maxLength={80} />
          </div>
        </div>
        <button className="primary-button" type="submit" disabled={creating}><Plus size={15} />{creating ? '创建中…' : '创建任务'}</button>
      </form>

      {error && <p className="research-error">{error}</p>}
      {message && <p className="research-success">{message}</p>}

      <section className="research-layout">
        <div className="panel tint-sky">
          <div className="panel-heading"><div><h2>调研任务</h2><p>运行后先预览，再选择需要写入候选库的笔记</p></div><span className="count-chip">{pendingTasks.length} 个待处理</span></div>
          <div className="task-list">{tasks.length ? <>
            {pendingTasks.map((task) => renderTask(task))}
            {importedTasks.length > 0 && <div className="imported-section"><button className="imported-toggle" type="button" onClick={() => setShowImported((value) => !value)}>{showImported ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span>已导入任务 · {importedTasks.length}</span><small>{showImported ? '收起' : '展开查看'}</small></button>{showImported && importedTasks.map((task) => renderTask(task, true))}</div>}
          </> : <div className="empty-state tall">当前账号暂无调研任务。</div>}</div>
        </div>
        <aside className="panel policy-panel"><span className="section-tag green"><ShieldCheck size={12} />安全边界</span><ul><li><Check size={15} />仅在你主动点击时执行</li><li><Check size={15} />每个关键词必须包含漫画名</li><li><Check size={15} />每个关键词只读取首屏</li><li><Check size={15} />跨关键词最多保留 10 条</li><li><Check size={15} />写入候选库前必须人工勾选</li></ul><div className="warning-note">如果小红书出现验证或异常提示，任务会停止且不会自动重试。Cloudflare 版本仍需由本机伴随服务执行浏览器步骤。</div></aside>
      </section>

      <section className="panel tint-lilac reference-library">
        <div className="panel-heading"><div><h2>参考笔记库</h2><p>你确认导入的笔记已直接保留；可采集完整正文与素材，再选择同一部漫画的 1–4 条笔记创建选题草案。</p></div><span className="count-chip">{references.length} 条笔记</span></div>
        <div className="reference-toolbar"><label className="reference-search"><Search size={15} /><input value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="搜索标题、作者或漫画" /></label><div className="reference-filter-tabs">{(['all', 'candidate', 'kept', 'rejected'] as ReferenceFilter[]).map((filter) => <button type="button" className={referenceFilter === filter ? 'active' : ''} onClick={() => setReferenceFilter(filter)} key={filter}>{filter === 'all' ? '全部' : reviewLabels[filter].label}</button>)}</div></div>

        {visibleReferences.length ? <div className="reference-list">{visibleReferences.map((reference) => {
          const comic = comics.find((item) => item.id === reference.comicId)
          const review = reviewLabels[reference.reviewStatus]
          const isSelected = selectedReferenceIds.includes(reference.id)
          const wrongComic = Boolean(selectionComicId && reference.comicId !== selectionComicId)
          return <article className={`reference-card ${isSelected ? 'selected' : ''} ${reference.coverUrl ? 'has-cover' : ''}`} key={reference.id}>
            <label className="reference-select"><input type="checkbox" checked={isSelected} disabled={wrongComic} onChange={() => toggleReference(reference)} /><span /></label>
            {reference.coverUrl && <div className="reference-cover"><img src={reference.coverUrl} alt={reference.title} loading="lazy" /></div>}
            <div className="reference-main"><div className="reference-card-top"><span className={`status-badge ${review.tone}`}>{review.label}</span>{comic && <span className="research-comic-label">《{comic.title}》</span>}{reference.topicIds.length > 0 && <span className="linked-topic-chip"><Layers3 size={12} />已关联 {reference.topicIds.length} 个选题</span>}</div><h3>{reference.title}</h3><p>{reference.body || (reference.detailStatus === 'failed' ? `上次采集未完成：${reference.detailError}` : '当前仅保存了列表信息；保留后可采集正文、话题和全部图片。')}</p>{reference.hashtags.length > 0 && <div className="reference-tags">{reference.hashtags.slice(0, 6).map((tag) => <span key={tag}>#{tag}</span>)}</div>}<small>{reference.author} · {reference.likes.toLocaleString()} 赞{reference.publishedAt ? ` · ${reference.publishedAt}` : ''} · {reference.detailStatus === 'detailed' ? `详情已采集 · ${reference.imageCount} 张图` : reference.detailStatus === 'failed' ? '采集失败，可人工重试' : '待采集详情'}</small></div>
            <ReferenceActions reference={reference} locallyCapturing={capturingReferenceId === reference.id} reviewing={reviewingReferenceId === reference.id} onCapture={() => void captureReference(reference)} onReview={(status) => void reviewReference(reference.id, status)} onRecoveredSuccess={reloadWorkspace} />
            {(captureFeedback[reference.id] || reference.detailStatus === 'failed') && <p className={`capture-feedback ${captureFeedback[reference.id]?.error || (!captureFeedback[reference.id] && reference.detailStatus === 'failed') ? 'is-error' : ''}`} role="status" aria-live="polite">{captureFeedback[reference.id]?.text ?? `上次采集失败：${reference.detailError}`}</p>}
            {dataMode === 'supabase' && <ExecutionHistory targetId={reference.id} />}
          </article>
        })}</div> : <div className="empty-state tall">当前筛选下没有参考笔记。执行调研并导入后会显示在这里。</div>}

        <form className="reference-topic-builder" onSubmit={createTopic}>
          <div className="topic-builder-heading"><BookOpenCheck size={20} /><div><strong>沉淀为选题</strong><span>已选 {selectedReferences.length} 条{selectionComicId ? ` · 《${comics.find((comic) => comic.id === selectionComicId)?.title ?? ''}》` : ''}</span></div></div>
          <input value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} placeholder="选题标题（可改写参考笔记标题）" maxLength={120} />
          <input value={topicSubtitle} onChange={(event) => setTopicSubtitle(event.target.value)} placeholder="选题说明（选填）" maxLength={160} />
          <PillSelect value={topicPillar} ariaLabel="内容支柱" placeholder="选择内容支柱" options={(activeAccount.pillars.length ? activeAccount.pillars : ['高能片段']).map((pillar) => ({ value: pillar, label: pillar }))} onChange={setTopicPillar} />
          <button className="primary-button" type="submit" disabled={creatingTopic}><Layers3 size={15} />{creatingTopic ? '创建中…' : '创建选题'}</button>
          <div className="topic-builder-feedback" role={topicFeedback?.error ? 'alert' : 'status'}>
            {creatingTopic ? '正在保存选题及关联笔记…' : topicFeedback ? <><span className={topicFeedback.error ? 'topic-feedback-error' : ''}>{topicFeedback.text}</span>{!topicFeedback.error && <Link to="/topics">查看选题 →</Link>}</> : '先勾选参考笔记，并完成“采集详情与素材”，再创建选题。'}
          </div>
        </form>
      </section>
    </>
  )
}
