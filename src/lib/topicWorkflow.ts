import type { BriefStatus, Topic, TopicStatus } from '../types'

export function briefTransition(topic: Topic, status: BriefStatus): TopicStatus {
  if (topic.status === 'published') throw new Error('已发布选题不可修改审核状态，请创建新策划版本')
  if (status !== 'approved') return 'research'
  if (topic.brief?.status === 'approved' && ['materials', 'draft', 'review', 'approved'].includes(topic.status)) return topic.status
  return 'materials'
}

export function manualTransitionError(topic: Topic, status: TopicStatus) {
  if (topic.status === status) return ''
  if (topic.status === 'published') return '已发布选题已锁定，请创建新策划版本'
  if (status === 'published') return '请在文案工作台记录实际发布，不能直接改为已发布'
  if (['materials', 'draft', 'review', 'approved'].includes(status) && topic.brief?.status !== 'approved') return '请先通过当前 Brief 审核'
  return ''
}
