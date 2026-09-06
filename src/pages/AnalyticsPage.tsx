import { ArrowUpRight, BarChart3, Bookmark, Heart, MessageCircle } from 'lucide-react'
import { MetricCard } from '../components/MetricCard'

const bars = [42, 58, 36, 76, 55, 89, 67]

export function AnalyticsPage() {
  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">PERFORMANCE</span><h1>数据复盘</h1><p>发布后手动补录数据，用自己的历史结果校准选题判断。</p></div><span className="safe-label">最近 30 天</span></section>
      <section className="metrics-grid three"><MetricCard label="累计点赞" value="2.8w" note="较上周期 +18%" icon={Heart} tone="coral" /><MetricCard label="累计收藏" value="9,420" note="收藏率 33.6%" icon={Bookmark} tone="violet" /><MetricCard label="累计评论" value="1,836" note="评论率 6.5%" icon={MessageCircle} tone="green" /></section>
      <section className="analytics-grid"><div className="panel tint-sky chart-panel"><div className="panel-heading"><div><h2>内容表现趋势</h2><p>按发布内容的综合互动分</p></div><BarChart3 size={19} /></div><div className="bar-chart">{bars.map((height, index) => <div className="bar-wrap" key={index}><div className="bar" style={{ height: `${height}%` }} /><span>{index + 1}日</span></div>)}</div></div><div className="panel tint-mint ranking-panel"><div className="panel-heading"><div><h2>高表现栏目</h2><p>按平均互动排序</p></div><ArrowUpRight size={18} /></div>{[['高能片段', '92'], ['角色观察', '86'], ['新番追更', '81'], ['完结安利', '74']].map(([name, score], index) => <div className="ranking-row" key={name}><b>0{index + 1}</b><span>{name}</span><strong>{score}</strong></div>)}</div></section>
    </>
  )
}
