import type { LucideIcon } from 'lucide-react'

export function MetricCard({ label, value, note, icon: Icon, tone }: { label: string; value: string | number; note: string; icon: LucideIcon; tone: string }) {
  return (
    <article className={`metric-card tint-${tone === 'coral' ? 'peach' : tone === 'green' ? 'mint' : tone}`}>
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div>
      <div className="metric-bottom"><strong>{value}</strong><small>{note}</small></div>
    </article>
  )
}
