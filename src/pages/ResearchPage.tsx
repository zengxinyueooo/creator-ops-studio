import { BookOpenCheck, Check, Clipboard, ExternalLink, ImageDown, Import, Layers3, LoaderCircle, Play, Plus, Search, ShieldCheck, TerminalSquare, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { searchXiaohongshuBatch } from '../lib/opencliBridge'
import { useWorkspace } from '../store/WorkspaceContext'
import type { ReferenceItem, XhsResearchResult } from '../types'

type ReferenceFilter = 'all' | ReferenceItem['reviewStatus']

const reviewLabels: Record<ReferenceItem['reviewStatus'], { label: string; tone: string }> = {
  candidate: { label: '待审核', tone: 'amber' },
  kept: { label: '已保留', tone: 'green' },
  rejected: { label: '已排除', tone: 'gray' },
}

export function ResearchPage() {
  const { activeAccount, state, addResearchTask, saveResearchResults, importResearchResults, updateReferenceReview, captureReferenceAssets, createTopicFromReferences } = useWorkspace()
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const validComicIds = new Set(comics.map((comic) => comic.id))
  const references = state.references.filter((reference) => reference.accountId === activeAccount.id && reference.comicId && validComicIds.has(reference.comicId))
  const [comicId, setComicId] = useState(() => comics.find((comic) => comic.status === 'following' || comic.status === 'selected')?.id ?? comics[0]?.id ?? '')
  const selectedComic = comics.find((comic) => comic.id === comicId)
  const isCompletedComic = selectedComic?.serializationStatus === 'completed'
  const [keywordText, setKeywordText] = useState('')
  const [purpose, setPurpose] = useState('')
  const [creating, setCreating] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [importingTaskId, setImportingTaskId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, XhsResearchResult[]>>({})
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [referenceFilter, setReferenceFilter] = useState<ReferenceFilter>('all')
  const [referenceQuery, setReferenceQuery] = useState('')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [reviewingReferenceId, setReviewingReferenceId] = useState<string | null>(null)
  const [capturingReferenceId, setCapturingReferenceId] = useState<string | null>(null)
  const [topicTitle, setTopicTitle] = useState('')
  const [topicSubtitle, setTopicSubtitle] = useState('')
  const [topicPillar, setTopicPillar] = useState(activeAccount.pillars[0] ?? '高能片段')
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const tasks = state.researchTasks.filter((task) => task.accountId === activeAccount.id && task.comicId && validComicIds.has(task.comicId))
  const selectedReferences = references.filter((reference) => selectedReferenceIds.includes(reference.id))
  const selectionComicId = selectedReferences[0]?.comicId
  const visibleReferences = references.filter((reference) => {
    if (referenceFilter !== 'all' && reference.reviewStatus !== referenceFilter) return false
    const query = referenceQuery.trim().toLowerCase()
    if (!query) return true
    const comic = comics.find((item) => item.id === reference.comicId)
    return [reference.title, reference.author, reference.body, comic?.title].some((value) => value?.toLowerCase().includes(query))
  })

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
    const keywords = parseKeywords(keywordText)
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

  async function runTask(taskId: string, taskComicId: string | undefined, taskKeywords: string[], taskLimit: number, publishedWithin: 'all' | 'day' | 'week' | 'half_year') {
    setRunningTaskId(taskId)
    setError('')
    setMessage('')
    try {
      const comic = validateKeywords(taskKeywords, taskComicId ?? '')
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
    const approved = results.filter((result) => selectedUrls.has(result.url))
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
      setMessage(`已将 ${approved.length} 条笔记写入参考候选库，仍需你决定保留或排除。`)
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
    setError('')
    setMessage('')
    try {
      const result = await captureReferenceAssets(reference.id)
      setMessage(`已采集《${reference.title}》的正文、话题与 ${result.imageCount} 张图片；素材已进入素材筛选台，等待图片结构审核。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '笔记详情与素材采集失败')
    } finally {
      setCapturingReferenceId(null)
    }
  }

  async function createTopic(event: FormEvent) {
    event.preventDefault()
    if (!selectedReferences.length || !selectionComicId) {
      setError('请先选择同一部漫画的参考笔记')
      return
    }
    if (!topicTitle.trim()) {
      setError('请填写选题标题')
      return
    }
    setCreatingTopic(true)
    setError('')
    setMessage('')
    try {
      await createTopicFromReferences({ title: topicTitle.trim(), subtitle: topicSubtitle.trim() || `由 ${selectedReferences.length} 条参考笔记提炼`, pillar: topicPillar, comicId: selectionComicId }, selectedReferenceIds)
      setSelectedReferenceIds([])
      setTopicTitle('')
      setTopicSubtitle('')
      setMessage('选题已创建，所选参考笔记已标记为“已保留”并关联到选题。下一步可到选题库生成 Brief。')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '选题创建失败')
    } finally {
      setCreatingTopic(false)
    }
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">RESEARCH INBOX</span><h1>调研导入箱</h1><p>按漫画检索笔记，人工审核后沉淀为选题；搜索、导入和转选题都不会自动发布。</p></div><span className="safe-label"><ShieldCheck size={15} />只读搜索 · 人工审核</span></section>
      <section className="integration-banner"><div className="integration-logo"><TerminalSquare size={25} /></div><div><h2>OpenCLI 小红书浏览器调研</h2><p>固定读取图文首屏；连载作品按近一周过滤、结果按点赞排序，并排除已导入工作台的笔记。不自动滚动或发布。</p></div><a href="https://github.com/jackwener/OpenCLI" target="_blank" rel="noreferrer">查看项目 <ExternalLink size={14} /></a></section>

      <form className="research-create-form" onSubmit={createTask}>
        <select value={comicId} onChange={(event) => setComicId(event.target.value)} required><option value="">选择所属漫画</option>{comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}</select>
        <textarea value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder={isCompletedComic
          ? `每行一个关键词，且必须完整包含漫画名，例如：\n${selectedComic?.title ?? '漫画名'} 名场面\n${selectedComic?.title ?? '漫画名'} 高甜互动\n${selectedComic?.title ?? '漫画名'} 经典台词`
          : `每行一个关键词，且必须完整包含漫画名，例如：\n${selectedComic?.title ?? '漫画名'} 最新话\n${selectedComic?.title ?? '漫画名'} 特典`} maxLength={240} required />
        <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder={isCompletedComic ? '调研目的，例如：寻找高赞名场面的选题角度' : '调研目的，例如：寻找最新话的高赞选题角度'} maxLength={160} />
        <div className="research-fixed-limit"><strong>10 条</strong><span>{isCompletedComic ? '不限时间 · 去重上限' : '一周内 · 去重上限'}</span></div>
        <button className="primary-button" type="submit" disabled={creating}><Plus size={15} />{creating ? '创建中…' : '创建任务'}</button>
      </form>

      {error && <p className="research-error">{error}</p>}
      {message && <p className="research-success">{message}</p>}

      <section className="research-layout">
        <div className="panel">
          <div className="panel-heading"><div><h2>调研任务</h2><p>运行后先预览，再选择需要写入候选库的笔记</p></div><span className="count-chip">{tasks.filter((task) => task.status === 'queued').length} 个待执行</span></div>
          <div className="task-list">{tasks.length ? tasks.map((task) => {
            const results = previews[task.id] ?? task.results ?? []
            const selectedUrls = new Set(selected[task.id] ?? [])
            const taskComic = comics.find((comic) => comic.id === task.comicId)
            return <article className="research-task research-task-card" key={task.id}>
              <div className="research-task-summary"><div><span className={`status-badge ${task.status === 'imported' ? 'green' : 'blue'}`}>{task.status === 'imported' ? '已导入' : '待执行'}</span>{taskComic && <span className="research-comic-label">《{taskComic.title}》</span>}<div className="keyword-tags">{task.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div><p>{task.purpose || '未填写调研目的'}</p><div className="research-filter-row"><span>图文</span>{task.filters.publishedWithin !== 'all' && <span>近一周</span>}<span>工作台未导入</span><span>按点赞排序</span></div><small>跨词去重，上限 {task.limit} 条{task.lastRunAt ? ` · 最近查询 ${task.lastRunAt}` : ` · ${task.createdAt}`}</small></div><div className="task-actions"><button className="secondary-button" type="button" onClick={() => copyKeywords(task.id, task.keywords)}>{copied === task.id ? <Check size={16} /> : <Clipboard size={16} />}{copied === task.id ? '已复制' : '复制关键词'}</button>{task.status !== 'imported' && <button className="primary-button" type="button" onClick={() => runTask(task.id, task.comicId, task.keywords, task.limit, task.filters.publishedWithin)} disabled={runningTaskId === task.id}>{runningTaskId === task.id ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{runningTaskId === task.id ? '筛选查询中…' : results.length ? '重新查询' : '本机执行'}</button>}</div></div>
              {results.length > 0 && <div className="research-preview"><div className="research-preview-heading"><strong>查询结果</strong><span>已选择 {selectedUrls.size}/{results.length} 条</span></div>{results.map((result) => <div className="research-result" key={result.url}><input aria-label={`选择 ${result.title}`} type="checkbox" checked={selectedUrls.has(result.url)} onChange={() => toggleResult(task.id, result.url)} /><span className="result-rank">{result.rank}</span><span><strong>{result.title}</strong><small>{result.matchedKeyword ? `${result.matchedKeyword} · ` : ''}{result.author} · {result.likes.toLocaleString()} 赞{result.publishedAt ? ` · ${result.publishedAt}` : ''}</small></span><a aria-label={`打开 ${result.title}`} href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a></div>)}<button className="primary-button import-confirm" type="button" disabled={importingTaskId === task.id || selectedUrls.size === 0} onClick={() => confirmImport(task.id)}><Import size={15} />{importingTaskId === task.id ? '正在导入…' : `确认导入 ${selectedUrls.size} 条`}</button></div>}
            </article>
          }) : <div className="empty-state tall">当前账号暂无调研任务。</div>}</div>
        </div>
        <aside className="panel policy-panel"><h2>安全边界</h2><ul><li><Check size={15} />仅在你主动点击时执行</li><li><Check size={15} />每个关键词必须包含漫画名</li><li><Check size={15} />每个关键词只读取首屏</li><li><Check size={15} />跨关键词最多保留 10 条</li><li><Check size={15} />写入候选库前必须人工勾选</li></ul><div className="warning-note">如果小红书出现验证或异常提示，任务会停止且不会自动重试。Cloudflare 版本仍需由本机伴随服务执行浏览器步骤。</div></aside>
      </section>

      <section className="panel reference-library">
        <div className="panel-heading"><div><h2>参考笔记候选库</h2><p>导入不等于采用；保留后可采集完整正文与素材，再把同一部漫画的参考笔记合并为一个选题。</p></div><span className="count-chip">{references.length} 条笔记</span></div>
        <div className="reference-toolbar"><label className="reference-search"><Search size={15} /><input value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="搜索标题、作者或漫画" /></label><div className="reference-filter-tabs">{(['all', 'candidate', 'kept', 'rejected'] as ReferenceFilter[]).map((filter) => <button type="button" className={referenceFilter === filter ? 'active' : ''} onClick={() => setReferenceFilter(filter)} key={filter}>{filter === 'all' ? '全部' : reviewLabels[filter].label}</button>)}</div></div>

        {visibleReferences.length ? <div className="reference-list">{visibleReferences.map((reference) => {
          const comic = comics.find((item) => item.id === reference.comicId)
          const review = reviewLabels[reference.reviewStatus]
          const isSelected = selectedReferenceIds.includes(reference.id)
          const wrongComic = Boolean(selectionComicId && reference.comicId !== selectionComicId)
          return <article className={`reference-card ${isSelected ? 'selected' : ''}`} key={reference.id}>
            <label className="reference-select"><input type="checkbox" checked={isSelected} disabled={wrongComic} onChange={() => toggleReference(reference)} /><span /></label>
            <div className="reference-main"><div className="reference-card-top"><span className={`status-badge ${review.tone}`}>{review.label}</span>{comic && <span className="research-comic-label">《{comic.title}》</span>}{reference.topicIds.length > 0 && <span className="linked-topic-chip"><Layers3 size={12} />已关联 {reference.topicIds.length} 个选题</span>}</div><h3>{reference.title}</h3><p>{reference.body || (reference.detailStatus === 'failed' ? `上次采集未完成：${reference.detailError}` : '当前仅保存了列表信息；保留后可采集正文、话题和全部图片。')}</p>{reference.hashtags.length > 0 && <div className="reference-tags">{reference.hashtags.slice(0, 6).map((tag) => <span key={tag}>#{tag}</span>)}</div>}<small>{reference.author} · {reference.likes.toLocaleString()} 赞{reference.publishedAt ? ` · ${reference.publishedAt}` : ''} · {reference.detailStatus === 'detailed' ? `详情已采集 · ${reference.imageCount} 张图` : reference.detailStatus === 'failed' ? '采集失败，可人工重试' : '待采集详情'}</small></div>
            <div className="reference-actions"><a className="icon-button" aria-label="打开原笔记" href={reference.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>{reference.reviewStatus === 'kept' && <button className="secondary-button capture-button" type="button" disabled={capturingReferenceId === reference.id} onClick={() => void captureReference(reference)}>{capturingReferenceId === reference.id ? <LoaderCircle className="spin" size={14} /> : <ImageDown size={14} />}{capturingReferenceId === reference.id ? '采集中…' : reference.detailStatus === 'detailed' ? '重新采集' : '采集详情与素材'}</button>}<button className="secondary-button" type="button" disabled={reviewingReferenceId === reference.id || capturingReferenceId === reference.id} onClick={() => void reviewReference(reference.id, 'rejected')}><X size={14} />排除</button><button className="secondary-button keep-button" type="button" disabled={reviewingReferenceId === reference.id || capturingReferenceId === reference.id} onClick={() => void reviewReference(reference.id, 'kept')}><Check size={14} />保留</button></div>
          </article>
        })}</div> : <div className="empty-state tall">当前筛选下没有参考笔记。执行调研并导入后会显示在这里。</div>}

        <form className="reference-topic-builder" onSubmit={createTopic}>
          <div className="topic-builder-heading"><BookOpenCheck size={20} /><div><strong>沉淀为选题</strong><span>已选 {selectedReferences.length} 条{selectionComicId ? ` · 《${comics.find((comic) => comic.id === selectionComicId)?.title ?? ''}》` : ''}</span></div></div>
          <input value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} placeholder="选题标题（可改写参考笔记标题）" maxLength={120} />
          <input value={topicSubtitle} onChange={(event) => setTopicSubtitle(event.target.value)} placeholder="选题说明（选填）" maxLength={160} />
          <select value={topicPillar} onChange={(event) => setTopicPillar(event.target.value)}>{(activeAccount.pillars.length ? activeAccount.pillars : ['高能片段']).map((pillar) => <option key={pillar} value={pillar}>{pillar}</option>)}</select>
          <button className="primary-button" type="submit" disabled={!selectedReferences.length || creatingTopic}><Layers3 size={15} />{creatingTopic ? '创建中…' : '创建选题'}</button>
        </form>
      </section>
    </>
  )
}
