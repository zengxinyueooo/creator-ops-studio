import { Clock3, Eye, FileImage, Link2 } from 'lucide-react'
import { PillSelect } from './PillSelect'
import { statusMeta } from '../data/status'
import type { Topic, TopicStatus } from '../types'

export function TopicCard({ topic, compact = false, onStatusChange, onOpenBrief, onCreateBrief }: { topic: Topic; compact?: boolean; onStatusChange?: (status: TopicStatus) => void; onOpenBrief?: () => void; onCreateBrief?: () => void }) {
  const meta = statusMeta[topic.status]
  return (
    <article className={`topic-card ${compact ? 'compact' : ''}`}>
      <div className="topic-card-top"><span className={`status-badge ${meta.className}`}>{meta.label}</span><span className={`score ${topic.score >= 85 ? 'high' : ''}`}>{topic.score} 分</span></div>
      <h3>{topic.title}</h3>
      <p>{topic.subtitle}</p>
      <div className="tag-row">{topic.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <div className="topic-meta"><span><Link2 size={14} />{topic.referenceCount}</span><span><FileImage size={14} />{topic.assetCount}</span>{topic.dueAt && <span><Clock3 size={14} />{topic.dueAt}</span>}</div>
      {onStatusChange && (
        <div className="topic-card-actions">
          <PillSelect value={topic.status} ariaLabel="调整选题状态" menuAlign="right" options={Object.entries(statusMeta).map(([status, item]) => ({ value: status, label: item.label }))} onChange={(status) => onStatusChange(status as TopicStatus)} />
          {topic.brief && <button className="brief-link-button" type="button" onClick={onOpenBrief}><Eye size={13} />查看 Brief</button>}
          {!topic.brief && onCreateBrief && <button className="brief-link-button" type="button" onClick={onCreateBrief}><Eye size={13} />生成 Brief</button>}
        </div>
      )}
    </article>
  )
}
