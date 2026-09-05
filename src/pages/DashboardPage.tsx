import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, FileImage, Lightbulb, ListTodo, PencilLine, Sparkles, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { statusMeta } from '../data/status'
import { useWorkspace } from '../store/WorkspaceContext'

const COVER_TONES = ['pink', 'blue', 'purple', 'amber'] as const

const SCHEDULE_KIND_LABEL: Record<string, string> = { update: '更新', publish: '发布', review: '复盘' }

export function DashboardPage() {
  const { activeAccount, accountTopics, state } = useWorkspace()
  const accountSchedules = state.schedules.filter((item) => item.accountId === activeAccount.id)
  const accountAssets = state.assets.filter((asset) => asset.accountId === activeAccount.id && asset.reviewStatus === 'available')
  const ready = accountTopics.filter((topic) => topic.status === 'approved').length
  const reviewing = accountTopics.filter((topic) => topic.status === 'review').length
  const averageScore = accountTopics.length ? Math.round(accountTopics.reduce((sum, topic) => sum + topic.score, 0) / accountTopics.length) : 0

  const steps = [
    { label: '选题灵感', note: '收集爆款证据', count: accountTopics.filter((t) => t.status === 'research' || t.status === 'idea').length, icon: Lightbulb },
    { label: '草稿创作', note: '整理来源与图片', count: accountTopics.filter((t) => t.status === 'materials').length, icon: PencilLine },
    { label: '写文案', note: '生成原创草稿', count: accountTopics.filter((t) => t.status === 'draft').length, icon: FileImage },
    { label: '待审核', note: '核对相似度与风险', count: reviewing, icon: CheckCircle2 },
    { label: '待发布', note: '手动发布小红书', count: ready, icon: UploadCloud },
  ]
  const currentStep = steps.findIndex((step) => step.count > 0)

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
          <div className="panel-heading"><div><h2>热门选题</h2><p>按截止时间与选题分排序</p></div><Link to="/topics">管理选题库 <ArrowRight size={15} /></Link></div>
          <div className="feature-topic-list">
            {accountTopics.slice(0, 3).map((topic, index) => {
              const meta = statusMeta[topic.status]
              return (
                <Link className="feature-topic-card" to="/topics" key={topic.id}>
                  <div className={`feature-cover ${COVER_TONES[index % COVER_TONES.length]}`}><Sparkles size={26} /></div>
                  <div className="feature-body">
                    <h3>{topic.title}</h3>
                    <p>{topic.subtitle}</p>
                    <div className="feature-foot"><span className={`status-badge ${meta.className}`}>{meta.label}</span><span className="feature-score">{topic.score} 分 <ArrowRight size={13} /></span></div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="panel schedule-panel">
          <div className="panel-heading"><div><h2>近期日程</h2><p>更新、发布与复盘</p></div><CalendarClock size={19} /></div>
          <div className="schedule-list">
            {accountSchedules.length ? accountSchedules.map((item) => (
              <div className="schedule-item" key={item.id}>
                <span className={`schedule-dot ${item.kind}`} />
                <div><strong>{item.title}</strong><small>{item.dateLabel}</small></div>
                <span className="schedule-kind">{SCHEDULE_KIND_LABEL[item.kind] ?? '日程'}</span>
              </div>
            )) : <div className="empty-state">这个账号还没有日程。</div>}
          </div>
          <Link className="secondary-button full" to="/calendar">管理内容日历</Link>
        </div>
      </section>

      <section className="panel workflow-panel">
        <div className="panel-heading"><div><h2>内容工作流</h2><p>每一步都保留人工判断</p></div><span className="safe-label">人工审核开启</span></div>
        <div className="workflow-strip">
          {steps.map((step, index) => (
            <div className={`workflow-step ${index === currentStep ? 'current' : ''} ${index < currentStep ? 'done' : ''}`} key={step.label}>
              <span className="workflow-icon"><step.icon size={17} /></span>
              <small>STEP 0{index + 1}</small>
              <strong>{step.label}</strong>
              <em>{step.count > 0 ? `${step.count} 项进行中` : '暂无待办'}</em>
              {index < steps.length - 1 && <i className="workflow-line" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      {accountAssets.length > 0 && (
        <section className="panel featured-assets-panel">
          <div className="panel-heading"><div><h2>素材精选</h2><p>已通过审核的可复用素材</p></div><Link to="/assets">进入素材库 <ArrowRight size={15} /></Link></div>
          <div className="featured-assets-grid">
            {accountAssets.slice(0, 4).map((asset, index) => (
              <Link className="featured-asset-card" to="/assets" key={asset.id}>
                <div className={`feature-cover small ${COVER_TONES[index % COVER_TONES.length]}`}><FileImage size={22} /></div>
                <h3>{asset.originalName}</h3>
                <p>{asset.workName} · {asset.usageCount ? `已使用 ${asset.usageCount} 次` : '尚未使用'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
