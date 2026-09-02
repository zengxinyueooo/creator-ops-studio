export type AccountKind = 'manga' | 'growth'

export type TopicStatus =
  | 'idea'
  | 'research'
  | 'materials'
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'

export interface Account {
  id: string
  name: string
  handle: string
  kind: AccountKind
  positioning: string
  accent: string
  pillars: string[]
}

export interface Topic {
  id: string
  accountId: string
  title: string
  subtitle: string
  status: TopicStatus
  score: number
  pillar: string
  tags: string[]
  dueAt?: string
  referenceCount: number
  assetCount: number
  updatedAt: string
}

export interface ReferenceItem {
  id: string
  accountId: string
  title: string
  author: string
  sourceUrl: string
  likes: number
  collects: number
  comments: number
  capturedAt: string
  insight: string
}

export interface ResearchTask {
  id: string
  accountId: string
  keyword: string
  purpose: string
  status: 'queued' | 'imported'
  limit: number
  createdAt: string
}

export interface ScheduleItem {
  id: string
  accountId: string
  title: string
  dateLabel: string
  kind: 'update' | 'publish' | 'review'
}

export interface WorkspaceState {
  accounts: Account[]
  activeAccountId: string
  topics: Topic[]
  references: ReferenceItem[]
  researchTasks: ResearchTask[]
  schedules: ScheduleItem[]
}
