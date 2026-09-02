import { Clock3, FileImage, Link2 } from 'lucide-react'
import { statusMeta } from '../data/status'
import type { Topic, TopicStatus } from '../types'

export function TopicCard({ topic, compact = false, onStatusChange }: { topic: Topic; compact?: boolean; onStatusChange?: (status: TopicStatus) => void }) {
  const meta = statusMeta[topic.status]
  return (
    <article className={`topic-card ${compact ? 'compact' : ''}`}>
      <div className="topic-card-top"><span className={`status-badge ${meta.className}`}>{meta.label}</span><span className={`score ${topic.score >= 85 ? 'high' : ''}`}>{topic.score} 分</span></div>
      <h3>{topic.title}</h3>
      <p>{topic.subtitle}</p>
      <div className="tag-row">{topic.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <div className="topic-meta"><span><Link2 size={14} />{topic.referenceCount}</span><span><FileImage size={14} />{topic.assetCount}</span>{topic.dueAt && <span><Clock3 size={14} />{topic.dueAt}</span>}</div>
      {onStatusChange && (
        <select className="status-select" value={topic.status} onChange={(event) => onStatusChange(event.target.value as TopicStatus)} aria-label="调整选题状态">
          {Object.entries(statusMeta).map(([status, item]) => <option key={status} value={status}>{item.label}</option>)}
        </select>
      )}
    </article>
  )
}
