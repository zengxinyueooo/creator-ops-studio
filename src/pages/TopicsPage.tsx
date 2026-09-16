import { CheckCircle2, Compass, FileImage, Heart, ListOrdered, Plus, ShieldAlert, SlidersHorizontal, XCircle, Zap } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopicCard } from '../components/TopicCard'
import { PillSelect } from '../components/PillSelect'
import { statusMeta } from '../data/status'
import { useWorkspace } from '../store/WorkspaceContext'
import { runAgentWorkflow } from '../lib/agentWorkflow'
import { dataMode } from '../lib/supabase'
import { useRecoveredAgentRun } from '../lib/useRecoveredAgentRun'
import { AgentRunStatus } from '../components/AgentRunStatus'
import type { TopicStatus } from '../types'

const columns: TopicStatus[] = ['idea', 'research', 'materials', 'draft', 'review', 'approved', 'published']

function evidenceTime(value?: string) {
  if (!value) return '未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString('zh-CN', { hour12: false })
}

export function TopicsPage() {
  const { activeAccount, accountTopics, state, updateTopicStatus, addTopic, generateTopicBrief, setTopicBriefStatus, reloadWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [pillar, setPillar] = useState(activeAccount.pillars[0])
  const [comicId, setComicId] = useState(() => comics.find((comic) => comic.status === 'following' || comic.status === 'selected')?.id ?? comics[0]?.id ?? '')
  const [selectedBriefId, setSelectedBriefId] = useState(() => accountTopics.find((topic) => topic.brief)?.id ?? '')
  const [briefError, setBriefError] = useState('')
  const [generatingBriefId, setGeneratingBriefId] = useState<string | null>(null)
  const selectedBrief = accountTopics.find((topic) => topic.id === selectedBriefId && topic.brief) ?? accountTopics.find((topic) => topic.brief)
  const recoveredBrief = useRecoveredAgentRun(
    { runType: 'brief_generation', targetType: 'topic', targetId: selectedBriefId || undefined },
    async (run) => {
      await reloadWorkspace()
      setSelectedBriefId(String(run.output.topicId ?? selectedBriefId))
    },
  )
  const briefBusy = generatingBriefId !== null || recoveredBrief.active

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    addTopic({ title: title.trim(), subtitle: subtitle.trim(), pillar, comicId: comicId || undefined })
    setTitle(''); setSubtitle(''); setShowForm(false)
  }

  async function createBrief(topicId: string) {
    if (generatingBriefId) return
    setSelectedBriefId(topicId)
    setGeneratingBriefId(topicId)
    setBriefError('')
    try {
      if (dataMode === 'supabase') {
        const topic = accountTopics.find((item) => item.id === topicId)
        if (!topic) throw new Error('选题不存在')
        const run = await runAgentWorkflow({ runType: 'brief_generation', targetType: 'topic', targetId: topicId, accountId: topic.accountId }, (value) => setBriefError(value.events.at(-1)?.message ?? 'Pi 正在生成 Brief'))
        setSelectedBriefId(String(run.output.topicId ?? topicId))
        window.location.reload()
        return
      }
      const resultId = await generateTopicBrief(topicId)
      setSelectedBriefId(resultId)
    } catch (caught) {
      setBriefError(caught instanceof Error ? caught.message : 'Brief 生成失败')
    } finally {
      setGeneratingBriefId(null)
    }
  }

  async function approveBrief(topicId: string) {
    setBriefError('')
    try {
      await setTopicBriefStatus(topicId, 'approved')
      navigate(`/assets?topic=${encodeURIComponent(topicId)}`)
    } catch (caught) {
      setBriefError(caught instanceof Error ? caught.message : 'Brief 审核结果保存失败')
    }
  }

  async function rejectBrief(topicId: string) {
    setBriefError('')
    try {
      await setTopicBriefStatus(topicId, 'rejected')
    } catch (caught) {
      setBriefError(caught instanceof Error ? caught.message : 'Brief 审核结果保存失败')
    }
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">CONTENT PIPELINE</span><h1>选题工作流</h1><p>从灵感到发布准备，所有关键节点由你审核。</p></div><div className="button-row"><button className="secondary-button"><SlidersHorizontal size={16} />筛选</button><button className="primary-button" onClick={() => setShowForm((value) => !value)}><Plus size={17} />新建选题</button></div></section>
      {showForm && <form className="quick-form topic-quick-form" onSubmit={submit}><PillSelect value={comicId} ariaLabel="关联漫画" placeholder="不关联漫画" options={[{ value: '', label: '不关联漫画' }, ...comics.map((comic) => ({ value: comic.id, label: comic.title }))]} onChange={setComicId} /><input autoFocus placeholder="选题标题" value={title} onChange={(e) => setTitle(e.target.value)} /><input placeholder="章节或内容角度" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /><PillSelect value={pillar} ariaLabel="内容支柱" placeholder="选择内容支柱" options={activeAccount.pillars.map((item) => ({ value: item, label: item }))} onChange={setPillar} /><button className="primary-button" type="submit">加入灵感池</button></form>}
      <AgentRunStatus run={recoveredBrief.run} error={recoveredBrief.error} successText="Brief 已生成" onRetry={selectedBriefId ? () => void createBrief(selectedBriefId) : undefined} retryLabel="重新生成 Brief" />
      {briefError && !selectedBrief?.brief && <p className="research-error">{briefError}</p>}
      {selectedBrief?.brief && <section className="brief-panel panel tint-lilac">
        <div className="brief-panel-heading"><div><span className="eyebrow">XIAOHONGSHU CONTENT BRIEF</span><h2>{selectedBrief.title}</h2><p>{selectedBrief.subtitle} · {selectedBrief.brief.generationMode === 'model' ? `AI 生成 · ${selectedBrief.brief.model ?? '硅基流动'}` : selectedBrief.brief.generationMode === 'template' ? '模板草稿（未调用模型）' : '历史草稿'}</p></div><span className={`status-badge ${selectedBrief.brief.status === 'approved' ? 'green' : selectedBrief.brief.status === 'rejected' ? 'gray' : 'amber'}`}>{selectedBrief.brief.status === 'approved' ? 'Brief 已通过' : selectedBrief.brief.status === 'rejected' ? '已放弃' : '待你审核'}</span></div>
        <div className="brief-grid">
          <div className="brief-zone tint-pink">
            <span className="section-tag pink"><Compass size={12} />内容角度</span>
            <p className="brief-angle">{selectedBrief.brief.angle}</p>
            <span className="section-tag rose"><Heart size={12} />核心情绪</span>
            <div className="chip-row">{selectedBrief.brief.coreEmotion.split(/[，,、]/).filter(Boolean).map((emotion) => <span key={emotion}>{emotion}</span>)}</div>
            <span className="section-tag violet"><Zap size={12} />开头 Hook</span>
            <blockquote>{selectedBrief.brief.hook}</blockquote>
          </div>
          <div className="brief-zone tint-violet">
            <span className="section-tag violet"><ListOrdered size={12} />文案结构</span>
            <ol className="brief-steps">{selectedBrief.brief.structure.map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}</ol>
          </div>
          <div className="brief-zone tint-blue">
            <span className="section-tag blue"><FileImage size={12} />建议素材</span>
            <ul className="brief-cards">{selectedBrief.brief.assetGuidance.map((item) => <li key={item}><FileImage size={14} />{item}</li>)}</ul>
            <span className="section-tag amber"><ShieldAlert size={12} />避免事项</span>
            <ul className="avoid-list">{selectedBrief.brief.avoidances.map((item) => <li key={item}><XCircle size={13} />{item}</li>)}</ul>
          </div>
        </div>
        {selectedBrief.brief.evidence && <details className="brief-evidence"><summary>查看生成证据 <span>{selectedBrief.brief.evidence.referenceIds.length} 条参考</span></summary><div className="brief-evidence-body"><div className="brief-evidence-meta"><span>生成于 {evidenceTime(selectedBrief.brief.evidence.generatedAt)}</span><span>档案更新于 {evidenceTime(selectedBrief.brief.evidence.profile.updatedAt)}</span></div><dl><dt>官方简介</dt><dd>{selectedBrief.brief.evidence.profile.officialSynopsis || '未知'}</dd><dt>官方来源</dt><dd>{/^https?:\/\//i.test(selectedBrief.brief.evidence.profile.officialSourceUrl || '') ? <a href={selectedBrief.brief.evidence.profile.officialSourceUrl} target="_blank" rel="noreferrer">查看漫画官方页面 ↗</a> : '未知'}</dd><dt>剧透边界</dt><dd>{selectedBrief.brief.evidence.profile.spoilerBoundary || '未知'}</dd><dt>关联参考</dt><dd><ul>{selectedBrief.brief.evidence.referenceIds.map(id => {
          const reference = state.references.find(item => item.id === id)
          return <li key={id}>{reference && /^https?:\/\//i.test(reference.sourceUrl) ? <a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.title} ↗</a> : '历史参考笔记（当前不可用）'}</li>
        })}</ul></dd></dl></div></details>}
        <div className="brief-grid">
          {selectedBrief.brief.audience && <div className="brief-zone tint-violet"><h3>目标读者与阅读收益</h3><p>{selectedBrief.brief.audience}</p></div>}
          {selectedBrief.brief.coverPlan && <div className="brief-zone tint-blue"><h3>封面方案</h3><p>{selectedBrief.brief.coverPlan}</p></div>}
          {([
            ['参考启发与出处', selectedBrief.brief.referenceInsights],
            ['逐图内容与素材安排', selectedBrief.brief.pagePlan],
            ['待核验与待补素材', selectedBrief.brief.verificationNeeds],
          ] as const).map(([title, items]) => items?.length ? <div className="brief-zone brief-expanded-zone" key={title}><h3>{title}</h3><ol className="brief-steps">{items.map((item, index) => <li key={index}><b>{index + 1}</b><span>{item}</span></li>)}</ol></div> : null)}
        </div>
        {selectedBrief.brief.evidence?.imageInputMode === 'analysis' && <details className="brief-evidence"><summary>图片依据 <span>{selectedBrief.brief.evidence.images?.length ?? 0} 张分析摘要</span></summary><div className="brief-evidence-body"><p>本次使用已保存的视觉分析摘要，未重新读取原图。候选画面仍需你审核。</p><ul>{selectedBrief.brief.evidence.images?.map(image => <li key={image.id}>参考 {image.referenceId} · 第 {image.position ?? '?'} 张 · 素材 {image.id}：{image.description}（{image.tags.join('、')}）</li>)}</ul></div></details>}
        {briefError && <p className="research-error">{briefError}</p>}
        <div className="brief-actions"><span>参考笔记 {selectedBrief.referenceCount} 条 · {selectedBrief.brief.status === 'approved' ? '已进入素材筛选' : selectedBrief.brief.status === 'rejected' ? '已退回调研' : '通过后进入素材筛选'}</span><div className="button-row">
          <button className="secondary-button" disabled={briefBusy} onClick={() => void createBrief(selectedBrief.id)}><Zap size={15} />{briefBusy ? '正在生成…' : selectedBrief.status === 'published' ? '基于此内容创建新策划' : '重新生成 Brief'}</button>
          {selectedBrief.status !== 'published' && selectedBrief.brief.status === 'candidate' && <><button className="secondary-button" disabled={briefBusy} onClick={() => void rejectBrief(selectedBrief.id)}><XCircle size={15} />放弃</button><button className="primary-button" disabled={briefBusy} onClick={() => void approveBrief(selectedBrief.id)}><CheckCircle2 size={15} />通过 Brief</button></>}
          {selectedBrief.brief.status === 'approved' && <button className="primary-button" onClick={() => navigate(`/assets?topic=${encodeURIComponent(selectedBrief.id)}`)}><FileImage size={15} />前往筛选素材</button>}
        </div></div>
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
