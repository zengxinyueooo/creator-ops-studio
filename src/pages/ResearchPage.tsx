import { Check, Clipboard, ExternalLink, Import, LoaderCircle, Play, Plus, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { searchXiaohongshuBatch } from '../lib/opencliBridge'
import { useWorkspace } from '../store/WorkspaceContext'
import type { XhsResearchResult } from '../types'

export function ResearchPage() {
  const { activeAccount, state, addResearchTask, importResearchResults } = useWorkspace()
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const [comicId, setComicId] = useState(() => comics.find((comic) => comic.status === 'following' || comic.status === 'selected')?.id ?? comics[0]?.id ?? '')
  const [keywordText, setKeywordText] = useState('')
  const [purpose, setPurpose] = useState('')
  const [creating, setCreating] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [importingTaskId, setImportingTaskId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, XhsResearchResult[]>>({})
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const tasks = state.researchTasks.filter((task) => task.accountId === activeAccount.id)

  function parseKeywords(value: string) {
    return [...new Set(value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))]
  }

  async function createTask(event: FormEvent) {
    event.preventDefault()
    const keywords = parseKeywords(keywordText)
    if (!comicId) {
      setError('请先从漫画候选库选择一部漫画')
      return
    }
    if (keywords.length < 2 || keywords.length > 3) {
      setError('每个调研批次需要填写 2–3 个不重复关键词')
      return
    }
    setCreating(true)
    setError('')
    try {
      await addResearchTask({ comicId, keywords, purpose: purpose.trim(), limit: 10 })
      setKeywordText('')
      setPurpose('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '调研任务创建失败')
    } finally {
      setCreating(false)
    }
  }

  async function runTask(taskId: string, taskKeywords: string[], taskLimit: number) {
    setRunningTaskId(taskId)
    setError('')
    try {
      const results = await searchXiaohongshuBatch(taskKeywords, taskLimit)
      setPreviews((current) => ({ ...current, [taskId]: results }))
      setSelected((current) => ({ ...current, [taskId]: results.map((result) => result.url) }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'OpenCLI 查询失败')
    } finally {
      setRunningTaskId(null)
    }
  }

  async function confirmImport(taskId: string) {
    const results = previews[taskId] ?? []
    const selectedUrls = new Set(selected[taskId] ?? [])
    const approved = results.filter((result) => selectedUrls.has(result.url))
    setImportingTaskId(taskId)
    setError('')
    try {
      await importResearchResults(taskId, approved)
      setPreviews((current) => {
        const next = { ...current }
        delete next[taskId]
        return next
      })
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

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">RESEARCH INBOX</span><h1>调研导入箱</h1><p>每批 2–3 个明确关键词，跨关键词去重后保留 10 条；你勾选确认后才写入参考库。</p></div><span className="safe-label"><ShieldCheck size={15} />只读 · 手动触发</span></section>
      <section className="integration-banner"><div className="integration-logo"><TerminalSquare size={25} /></div><div><h2>OpenCLI 小红书浏览器调研</h2><p>复用你的登录状态，逐个点击图文、一周内、未看过和最多点赞；只读取首屏，不自动滚动。</p></div><a href="https://github.com/jackwener/OpenCLI" target="_blank" rel="noreferrer">查看项目 <ExternalLink size={14} /></a></section>

      <form className="research-create-form" onSubmit={createTask}>
        <select value={comicId} onChange={(event) => setComicId(event.target.value)} required><option value="">选择所属漫画</option>{comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}</select>
        <textarea value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder={'每行一个关键词，例如：\n溯洄春时\n溯洄春时 最新话\n溯洄春时 特典'} maxLength={240} required />
        <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="调研目的，例如：寻找最新话的高赞选题角度" maxLength={160} />
        <div className="research-fixed-limit"><strong>10 条</strong><span>去重后上限</span></div>
        <button className="primary-button" type="submit" disabled={creating}><Plus size={15} />{creating ? '创建中…' : '创建任务'}</button>
      </form>

      {error && <p className="research-error">{error}</p>}

      <section className="research-layout">
        <div className="panel">
          <div className="panel-heading"><div><h2>调研任务</h2><p>运行后先预览，再选择需要保留的笔记</p></div><span className="count-chip">{tasks.filter((task) => task.status === 'queued').length} 个待执行</span></div>
          <div className="task-list">{tasks.length ? tasks.map((task) => {
            const results = previews[task.id] ?? []
            const selectedUrls = new Set(selected[task.id] ?? [])
            const taskComic = comics.find((comic) => comic.id === task.comicId)
            return <article className="research-task research-task-card" key={task.id}>
              <div className="research-task-summary"><div><span className={`status-badge ${task.status === 'imported' ? 'green' : 'blue'}`}>{task.status === 'imported' ? '已导入' : '待执行'}</span>{taskComic && <span className="research-comic-label">《{taskComic.title}》</span>}<div className="keyword-tags">{task.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div><p>{task.purpose || '未填写调研目的'}</p><div className="research-filter-row"><span>图文</span><span>一周内</span><span>未看过</span><span>最多点赞</span></div><small>跨词去重，上限 {task.limit} 条 · {task.createdAt}</small></div><div className="task-actions"><button className="secondary-button" type="button" onClick={() => copyKeywords(task.id, task.keywords)}>{copied === task.id ? <Check size={16} /> : <Clipboard size={16} />}{copied === task.id ? '已复制' : '复制关键词'}</button>{task.status !== 'imported' && <button className="primary-button" type="button" onClick={() => runTask(task.id, task.keywords, task.limit)} disabled={runningTaskId === task.id}>{runningTaskId === task.id ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{runningTaskId === task.id ? '筛选查询中…' : results.length ? '重新查询' : '本机执行'}</button>}</div></div>
              {results.length > 0 && <div className="research-preview"><div className="research-preview-heading"><strong>查询结果</strong><span>已选择 {selectedUrls.size}/{results.length} 条</span></div>{results.map((result) => <div className="research-result" key={result.url}><input aria-label={`选择 ${result.title}`} type="checkbox" checked={selectedUrls.has(result.url)} onChange={() => toggleResult(task.id, result.url)} /><span className="result-rank">{result.rank}</span><span><strong>{result.title}</strong><small>{result.matchedKeyword ? `${result.matchedKeyword} · ` : ''}{result.author} · {result.likes.toLocaleString()} 赞{result.publishedAt ? ` · ${result.publishedAt}` : ''}</small></span><a aria-label={`打开 ${result.title}`} href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a></div>)}<button className="primary-button import-confirm" type="button" disabled={importingTaskId === task.id || selectedUrls.size === 0} onClick={() => confirmImport(task.id)}><Import size={15} />{importingTaskId === task.id ? '正在导入…' : `确认导入 ${selectedUrls.size} 条`}</button></div>}
            </article>
          }) : <div className="empty-state tall">当前账号暂无调研任务。</div>}</div>
        </div>
        <aside className="panel policy-panel"><h2>安全边界</h2><ul><li><Check size={15} />仅在你主动点击时执行</li><li><Check size={15} />逐项点击平台公开筛选</li><li><Check size={15} />每个关键词只读取首屏</li><li><Check size={15} />跨关键词最多保留 10 条</li><li><Check size={15} />写入前必须人工勾选</li></ul><div className="warning-note">筛选结果仍受小红书页面状态影响；如果出现验证或异常提示，任务会停止，不会自动重试。Cloudflare 版本仍需由本机伴随服务执行浏览器步骤。</div></aside>
      </section>
    </>
  )
}
