import type { TopicStatus } from '../types'

export const statusMeta: Record<TopicStatus, { label: string; className: string }> = {
  idea: { label: '灵感', className: 'gray' },
  research: { label: '待调研', className: 'blue' },
  materials: { label: '找素材', className: 'amber' },
  draft: { label: '写文案', className: 'violet' },
  review: { label: '待审核', className: 'pink' },
  approved: { label: '待发布', className: 'green' },
  published: { label: '已发布', className: 'dark' },
}
