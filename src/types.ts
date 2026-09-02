export type AccountKind = 'manga' | 'growth'

export type ComicStatus =
  | 'candidate'
  | 'selected'
  | 'following'
  | 'paused'
  | 'completed'
  | 'dropped'
  | 'archived'

export type ComicSerializationStatus = 'ongoing' | 'completed' | 'unknown'

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

export interface Comic {
  id: string
  accountId: string
  title: string
  platform: string
  sourceUrl?: string
  coverUrl?: string
  status: ComicStatus
  serializationStatus: ComicSerializationStatus
  updateWeekday?: number
  updateNote: string
  selectionNote: string
  createdAt: string
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
  status: 'queued' | 'running' | 'imported' | 'failed'
  limit: number
  createdAt: string
}

export interface XhsResearchResult {
  rank: number
  noteId: string
  title: string
  author: string
  likes: number
  publishedAt: string | null
  url: string
}

export type CopyrightStatus = 'unknown' | 'reference_only' | 'authorized' | 'original'

export interface AssetItem {
  id: string
  accountId: string
  storagePath: string
  originalName: string
  mimeType: string
  byteSize: number
  sourceUrl?: string
  sourceType: string
  tags: string[]
  workName: string
  chapter: string
  copyrightStatus: CopyrightStatus
  createdAt: string
  previewUrl?: string
  topicId?: string
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
  comics: Comic[]
  topics: Topic[]
  references: ReferenceItem[]
  researchTasks: ResearchTask[]
  schedules: ScheduleItem[]
  assets: AssetItem[]
}
