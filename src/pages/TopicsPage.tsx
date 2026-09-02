import { Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { TopicCard } from '../components/TopicCard'
import { statusMeta } from '../data/status'
import { useWorkspace } from '../store/WorkspaceContext'
import type { TopicStatus } from '../types'

const columns: TopicStatus[] = ['idea', 'research', 'materials', 'draft', 'review', 'approved']

export function TopicsPage() {
  const { activeAccount, accountTopics, updateTopicStatus, addTopic } = useWorkspace()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [pillar, setPillar] = useState(activeAccount.pillars[0])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    addTopic({ title: title.trim(), subtitle: subtitle.trim(), pillar })
    setTitle(''); setSubtitle(''); setShowForm(false)
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">CONTENT PIPELINE</span><h1>选题工作流</h1><p>从灵感到发布准备，所有关键节点由你审核。</p></div><div className="button-row"><button className="secondary-button"><SlidersHorizontal size={16} />筛选</button><button className="primary-button" onClick={() => setShowForm((value) => !value)}><Plus size={17} />新建选题</button></div></section>
      {showForm && <form className="quick-form" onSubmit={submit}><input autoFocus placeholder="选题标题" value={title} onChange={(e) => setTitle(e.target.value)} /><input placeholder="作品、章节或内容角度" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /><select value={pillar} onChange={(e) => setPillar(e.target.value)}>{activeAccount.pillars.map((item) => <option key={item}>{item}</option>)}</select><button className="primary-button" type="submit">加入灵感池</button></form>}
      <section className="kanban-board">
        {columns.map((status) => {
          const topics = accountTopics.filter((topic) => topic.status === status)
          return <div className="kanban-column" key={status}><div className="kanban-title"><span className={`status-dot ${statusMeta[status].className}`} /><strong>{statusMeta[status].label}</strong><b>{topics.length}</b></div><div className="kanban-list">{topics.map((topic) => <TopicCard key={topic.id} topic={topic} onStatusChange={(next) => updateTopicStatus(topic.id, next)} />)}{!topics.length && <div className="column-empty">暂无内容</div>}</div></div>
        })}
      </section>
    </>
  )
}
