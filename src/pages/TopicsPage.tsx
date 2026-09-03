import { CheckCircle2, FileImage, Plus, SlidersHorizontal, XCircle } from 'lucide-react'
import { useState } from 'react'
import { TopicCard } from '../components/TopicCard'
import { statusMeta } from '../data/status'
import { useWorkspace } from '../store/WorkspaceContext'
import type { TopicStatus } from '../types'

const columns: TopicStatus[] = ['idea', 'research', 'materials', 'draft', 'review', 'approved']

export function TopicsPage() {
  const { activeAccount, accountTopics, state, updateTopicStatus, addTopic, generateTopicBrief, setTopicBriefStatus } = useWorkspace()
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [pillar, setPillar] = useState(activeAccount.pillars[0])
  const [comicId, setComicId] = useState(() => comics.find((comic) => comic.status === 'following' || comic.status === 'selected')?.id ?? comics[0]?.id ?? '')
  const [selectedBriefId, setSelectedBriefId] = useState(() => accountTopics.find((topic) => topic.brief)?.id ?? '')
  const [briefError, setBriefError] = useState('')
  const selectedBrief = accountTopics.find((topic) => topic.id === selectedBriefId && topic.brief) ?? accountTopics.find((topic) => topic.brief)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    addTopic({ title: title.trim(), subtitle: subtitle.trim(), pillar, comicId: comicId || undefined })
    setTitle(''); setSubtitle(''); setShowForm(false)
  }

  async function createBrief(topicId: string) {
    setBriefError('')
    try {
      await generateTopicBrief(topicId)
      setSelectedBriefId(topicId)
    } catch (caught) {
      setBriefError(caught instanceof Error ? caught.message : 'Brief 生成失败')
    }
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">CONTENT PIPELINE</span><h1>选题工作流</h1><p>从灵感到发布准备，所有关键节点由你审核。</p></div><div className="button-row"><button className="secondary-button"><SlidersHorizontal size={16} />筛选</button><button className="primary-button" onClick={() => setShowForm((value) => !value)}><Plus size={17} />新建选题</button></div></section>
      {showForm && <form className="quick-form topic-quick-form" onSubmit={submit}><select value={comicId} onChange={(event) => setComicId(event.target.value)}><option value="">不关联漫画</option>{comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}</select><input autoFocus placeholder="选题标题" value={title} onChange={(e) => setTitle(e.target.value)} /><input placeholder="章节或内容角度" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /><select value={pillar} onChange={(e) => setPillar(e.target.value)}>{activeAccount.pillars.map((item) => <option key={item}>{item}</option>)}</select><button className="primary-button" type="submit">加入灵感池</button></form>}
      {briefError && !selectedBrief?.brief && <p className="research-error">{briefError}</p>}
      {selectedBrief?.brief && <section className="brief-panel panel">
        <div className="brief-panel-heading"><div><span className="eyebrow">XIAOHONGSHU CONTENT BRIEF</span><h2>{selectedBrief.title}</h2><p>{selectedBrief.subtitle}</p></div><span className={`status-badge ${selectedBrief.brief.status === 'approved' ? 'green' : selectedBrief.brief.status === 'rejected' ? 'gray' : 'amber'}`}>{selectedBrief.brief.status === 'approved' ? 'Brief 已通过' : selectedBrief.brief.status === 'rejected' ? '已放弃' : '待你审核'}</span></div>
        <div className="brief-grid">
          <div className="brief-focus"><label>内容角度</label><strong>{selectedBrief.brief.angle}</strong><label>核心情绪</label><p>{selectedBrief.brief.coreEmotion}</p><label>开头 Hook</label><blockquote>{selectedBrief.brief.hook}</blockquote></div>
          <div><label>文案结构</label><ol>{selectedBrief.brief.structure.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <div><label>建议素材</label><ul>{selectedBrief.brief.assetGuidance.map((item) => <li key={item}><FileImage size={13} />{item}</li>)}</ul><label>避免事项</label><ul>{selectedBrief.brief.avoidances.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
        {briefError && <p className="research-error">{briefError}</p>}
        <div className="brief-actions"><span>参考笔记 {selectedBrief.referenceCount} 条 · 通过后进入素材筛选</span><div className="button-row"><button className="secondary-button" onClick={() => void setTopicBriefStatus(selectedBrief.id, 'rejected').catch((error) => setBriefError(error.message))}><XCircle size={15} />放弃</button><button className="primary-button" onClick={() => void setTopicBriefStatus(selectedBrief.id, 'approved').catch((error) => setBriefError(error.message))}><CheckCircle2 size={15} />通过 Brief</button></div></div>
      </section>}
      <section className="kanban-board">
        {columns.map((status) => {
          const topics = accountTopics.filter((topic) => topic.status === status)
          return <div className="kanban-column" key={status}><div className="kanban-title"><span className={`status-dot ${statusMeta[status].className}`} /><strong>{statusMeta[status].label}</strong><b>{topics.length}</b></div><div className="kanban-list">{topics.map((topic) => <TopicCard key={topic.id} topic={topic} onStatusChange={(next) => updateTopicStatus(topic.id, next)} onOpenBrief={() => setSelectedBriefId(topic.id)} onCreateBrief={() => void createBrief(topic.id)} />)}{!topics.length && <div className="column-empty">暂无内容</div>}</div></div>
        })}
      </section>
    </>
  )
}
