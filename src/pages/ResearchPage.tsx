import { Check, Clipboard, ExternalLink, Import, LoaderCircle, Play, Plus, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { searchXiaohongshu } from '../lib/opencliBridge'
import { useWorkspace } from '../store/WorkspaceContext'
import type { XhsResearchResult } from '../types'

export function ResearchPage() {
  const { activeAccount, state, addResearchTask, importResearchResults } = useWorkspace()
  const [keyword, setKeyword] = useState('')
  const [purpose, setPurpose] = useState('')
  const [limit, setLimit] = useState(10)
  const [creating, setCreating] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [importingTaskId, setImportingTaskId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, XhsResearchResult[]>>({})
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const tasks = state.researchTasks.filter((task) => task.accountId === activeAccount.id)

  async function createTask(event: FormEvent) {
    event.preventDefault()
    if (!keyword.trim()) return
    setCreating(true)
    setError('')
    try {
      await addResearchTask({ keyword: keyword.trim(), purpose: purpose.trim(), limit })
      setKeyword('')
      setPurpose('')
      setLimit(10)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '调研任务创建失败')
    } finally {
      setCreating(false)
    }
  }

  async function runTask(taskId: string, taskKeyword: string, taskLimit: number) {
    setRunningTaskId(taskId)
    setError('')
    try {
      const results = await searchXiaohongshu(taskKeyword, taskLimit)
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

  async function copyCommand(taskId: string, taskKeyword: string, taskLimit: number) {
    const command = `npm run opencli:xhs -- search ${JSON.stringify(taskKeyword)} --limit ${taskLimit} --window background -f json`
    await navigator.clipboard.writeText(command)
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
      <section className="page-heading compact-heading"><div><span className="eyebrow">RESEARCH INBOX</span><h1>调研导入箱</h1><p>创建关键词任务，本机只读查询；你勾选确认后才写入参考库。</p></div><span className="safe-label"><ShieldCheck size={15} />只读 · 手动触发</span></section>
      <section className="integration-banner"><div className="integration-logo"><TerminalSquare size={25} /></div><div><h2>OpenCLI 小红书连接器</h2><p>每次仅执行一次搜索，最多 20 条；不循环、不关注、不发布，并移除链接中的临时令牌。</p></div><a href="https://github.com/jackwener/OpenCLI" target="_blank" rel="noreferrer">查看项目 <ExternalLink size={14} /></a></section>

      <form className="research-create-form" onSubmit={createTask}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="关键词，例如：漫画 高能片段" maxLength={80} required />
        <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="调研目的，例如：寻找高互动标题角度" maxLength={160} />
        <label>返回数量<input type="number" min={1} max={20} value={limit} onChange={(event) => setLimit(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <button className="primary-button" type="submit" disabled={creating}><Plus size={15} />{creating ? '创建中…' : '创建任务'}</button>
      </form>

      {error && <p className="research-error">{error}</p>}

      <section className="research-layout">
        <div className="panel">
          <div className="panel-heading"><div><h2>调研任务</h2><p>运行后先预览，再选择需要保留的笔记</p></div><span className="count-chip">{tasks.filter((task) => task.status === 'queued').length} 个待执行</span></div>
          <div className="task-list">{tasks.length ? tasks.map((task) => {
            const results = previews[task.id] ?? []
            const selectedUrls = new Set(selected[task.id] ?? [])
            return <article className="research-task research-task-card" key={task.id}>
              <div className="research-task-summary"><div><span className={`status-badge ${task.status === 'imported' ? 'green' : 'blue'}`}>{task.status === 'imported' ? '已导入' : '待执行'}</span><h3>{task.keyword}</h3><p>{task.purpose || '未填写调研目的'}</p><small>上限 {task.limit} 条 · {task.createdAt}</small></div><div className="task-actions"><button className="secondary-button" onClick={() => copyCommand(task.id, task.keyword, task.limit)}>{copied === task.id ? <Check size={16} /> : <Clipboard size={16} />}{copied === task.id ? '已复制' : '复制命令'}</button>{task.status !== 'imported' && <button className="primary-button" onClick={() => runTask(task.id, task.keyword, task.limit)} disabled={runningTaskId === task.id}>{runningTaskId === task.id ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{runningTaskId === task.id ? '查询中…' : results.length ? '重新查询' : '本机执行'}</button>}</div></div>
              {results.length > 0 && <div className="research-preview"><div className="research-preview-heading"><strong>查询结果</strong><span>已选择 {selectedUrls.size}/{results.length} 条</span></div>{results.map((result) => <div className="research-result" key={result.url}><input aria-label={`选择 ${result.title}`} type="checkbox" checked={selectedUrls.has(result.url)} onChange={() => toggleResult(task.id, result.url)} /><span className="result-rank">{result.rank}</span><span><strong>{result.title}</strong><small>{result.author} · {result.likes.toLocaleString()} 赞{result.publishedAt ? ` · ${result.publishedAt}` : ''}</small></span><a aria-label={`打开 ${result.title}`} href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a></div>)}<button className="primary-button import-confirm" disabled={importingTaskId === task.id} onClick={() => confirmImport(task.id)}><Import size={15} />{importingTaskId === task.id ? '正在导入…' : `确认导入 ${selectedUrls.size} 条`}</button></div>}
            </article>
          }) : <div className="empty-state tall">当前账号暂无调研任务。</div>}</div>
        </div>
        <aside className="panel policy-panel"><h2>安全边界</h2><ul><li><Check size={15} />仅在你主动点击时执行</li><li><Check size={15} />复用浏览器正常登录状态</li><li><Check size={15} />限制单次返回数量</li><li><Check size={15} />移除临时访问令牌</li><li><Check size={15} />写入前必须人工勾选</li></ul><div className="warning-note">部署到 Cloudflare 后无法直接运行你电脑上的 OpenCLI；届时仍由本机伴随服务执行，工作台负责审核与保存。</div></aside>
      </section>
    </>
  )
}
