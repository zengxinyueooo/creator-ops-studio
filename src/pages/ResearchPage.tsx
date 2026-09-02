import { Check, Clipboard, ExternalLink, Import, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/WorkspaceContext'

export function ResearchPage() {
  const { activeAccount, state, markResearchImported } = useWorkspace()
  const [copied, setCopied] = useState<string | null>(null)
  const tasks = state.researchTasks.filter((task) => task.accountId === activeAccount.id)

  async function copyCommand(taskId: string, keyword: string, limit: number) {
    const command = `pnpm opencli:xhs search "${keyword}" --limit ${limit} -f json`
    await navigator.clipboard.writeText(command)
    setCopied(taskId)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">RESEARCH INBOX</span><h1>调研导入箱</h1><p>使用登录态浏览器做低频调研，结果审核后才进入参考库。</p></div><span className="safe-label"><ShieldCheck size={15} />只读 · 手动触发</span></section>
      <section className="integration-banner"><div className="integration-logo"><TerminalSquare size={25} /></div><div><h2>OpenCLI 小红书连接器</h2><p>本机执行查询，默认限制 20 条；不自动循环、不自动关注、不自动发布。</p></div><a href="https://github.com/jackwener/OpenCLI" target="_blank" rel="noreferrer">查看项目 <ExternalLink size={14} /></a></section>
      <section className="research-layout">
        <div className="panel">
          <div className="panel-heading"><div><h2>待执行任务</h2><p>复制命令后在项目终端运行</p></div><span className="count-chip">{tasks.filter((task) => task.status === 'queued').length} 个</span></div>
          <div className="task-list">{tasks.length ? tasks.map((task) => <article className="research-task" key={task.id}><div><span className={`status-badge ${task.status === 'imported' ? 'green' : 'blue'}`}>{task.status === 'imported' ? '已导入' : '待执行'}</span><h3>{task.keyword}</h3><p>{task.purpose}</p><small>上限 {task.limit} 条 · {task.createdAt}</small></div><div className="task-actions"><button className="secondary-button" onClick={() => copyCommand(task.id, task.keyword, task.limit)}>{copied === task.id ? <Check size={16} /> : <Clipboard size={16} />}{copied === task.id ? '已复制' : '复制命令'}</button>{task.status === 'queued' && <button className="ghost-button" onClick={() => markResearchImported(task.id)}><Import size={16} />标记已导入</button>}</div></article>) : <div className="empty-state tall">当前账号暂无调研任务。</div>}</div>
        </div>
        <aside className="panel policy-panel"><h2>安全边界</h2><ul><li><Check size={15} />仅在你主动点击时执行</li><li><Check size={15} />复用浏览器正常登录状态</li><li><Check size={15} />限制单次返回数量</li><li><Check size={15} />保存来源链接与采集时间</li><li><Check size={15} />写入前必须人工审核</li></ul><div className="warning-note">任何工具都不能保证规避平台风控。我们降低频率与自动化程度，并保留手动操作。</div></aside>
      </section>
    </>
  )
}
