import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, ListTodo, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { TopicCard } from '../components/TopicCard'
import { useWorkspace } from '../store/WorkspaceContext'

export function DashboardPage() {
  const { activeAccount, accountTopics, state } = useWorkspace()
  const accountSchedules = state.schedules.filter((item) => item.accountId === activeAccount.id)
  const ready = accountTopics.filter((topic) => topic.status === 'approved').length
  const reviewing = accountTopics.filter((topic) => topic.status === 'review').length
  const averageScore = accountTopics.length ? Math.round(accountTopics.reduce((sum, topic) => sum + topic.score, 0) / accountTopics.length) : 0

  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span><h1>早上好，继续把内容做成系统。</h1><p>{activeAccount.positioning}</p></div>
        <Link className="primary-button" to="/topics"><Sparkles size={17} />新建选题</Link>
      </section>

      <section className="metrics-grid">
        <MetricCard label="进行中选题" value={accountTopics.filter((topic) => !['published', 'idea'].includes(topic.status)).length} note="覆盖本周内容计划" icon={ListTodo} tone="coral" />
        <MetricCard label="待你审核" value={reviewing} note={reviewing ? '建议今天处理' : '当前已清空'} icon={CircleDashed} tone="violet" />
        <MetricCard label="准备发布" value={ready} note="图片与文案已齐" icon={CheckCircle2} tone="green" />
        <MetricCard label="平均选题分" value={averageScore} note="基于当前候选池" icon={Sparkles} tone="amber" />
      </section>

      <section className="dashboard-grid">
        <div className="panel wide-panel">
          <div className="panel-heading"><div><h2>优先处理</h2><p>按截止时间与选题分排序</p></div><Link to="/topics">查看全部 <ArrowRight size={15} /></Link></div>
          <div className="priority-list">{accountTopics.slice(0, 3).map((topic) => <TopicCard key={topic.id} topic={topic} compact />)}</div>
        </div>
        <div className="panel schedule-panel">
          <div className="panel-heading"><div><h2>接下来</h2><p>更新、发布与复盘</p></div><CalendarClock size={19} /></div>
          <div className="schedule-list">
            {accountSchedules.length ? accountSchedules.map((item) => (
              <div className="schedule-item" key={item.id}><span className={`schedule-dot ${item.kind}`} /><div><strong>{item.title}</strong><small>{item.dateLabel}</small></div></div>
            )) : <div className="empty-state">这个账号还没有日程。</div>}
          </div>
          <Link className="secondary-button full" to="/calendar">管理内容日历</Link>
        </div>
      </section>

      <section className="panel workflow-panel">
        <div className="panel-heading"><div><h2>本周内容流水线</h2><p>每一步都保留人工判断</p></div><span className="safe-label">人工审核开启</span></div>
        <div className="workflow-strip">
          {[
            ['待调研', accountTopics.filter((t) => t.status === 'research').length, '收集爆款证据'],
            ['找素材', accountTopics.filter((t) => t.status === 'materials').length, '整理来源与图片'],
            ['写文案', accountTopics.filter((t) => t.status === 'draft').length, '生成原创草稿'],
            ['待审核', reviewing, '核对相似度与风险'],
            ['待发布', ready, '手动发布小红书'],
          ].map(([label, count, note], index) => <div className="workflow-step" key={String(label)}><span>{index + 1}</span><strong>{label}<b>{count}</b></strong><small>{note}</small></div>)}
        </div>
      </section>
    </>
  )
}
