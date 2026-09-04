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

export type BriefStatus = 'candidate' | 'approved' | 'rejected'

export interface ContentBrief {
  status: BriefStatus
  angle: string
  coreEmotion: string
  hook: string
  structure: string[]
  assetGuidance: string[]
  avoidances: string[]
}

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
  comicId?: string
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
  brief?: ContentBrief
}

export interface ReferenceItem {
  id: string
  accountId: string
  comicId?: string
  topicId?: string
  topicIds: string[]
  researchTaskId?: string
  matchedKeyword?: string
  discoveryRank?: number
  title: string
  author: string
  sourceUrl: string
  likes: number
  collects: number
  comments: number
  capturedAt: string
  insight: string
  noteId?: string
  body: string
  publishedAt?: string
  imageCount: number
  coverUrl?: string
  hashtags: string[]
  reviewedAt?: string
  detailCapturedAt?: string
  detailError: string
  detailStatus: 'list_only' | 'detailed' | 'failed'
  reviewStatus: 'candidate' | 'kept' | 'rejected'
}

export interface ResearchTask {
  id: string
  accountId: string
  comicId?: string
  keyword: string
  keywords: string[]
  purpose: string
  status: 'queued' | 'running' | 'imported' | 'failed'
  limit: number
  createdAt: string
  filters: {
    noteType: 'image'
    publishedWithin: 'day' | 'week' | 'half_year'
    scope: 'unseen'
    sort: 'most_liked'
  }
}

export interface XhsResearchResult {
  rank: number
  noteId: string
  title: string
  author: string
  likes: number
  publishedAt: string | null
  url: string
  matchedKeyword?: string
}

export type CopyrightStatus = 'unknown' | 'reference_only' | 'authorized' | 'original'
export type AssetVisualFormat = 'single' | 'collage' | 'uncertain' | 'invalid'
export type AssetReviewStatus = 'pending' | 'available' | 'rejected' | 'archived'
export type AssetContentType = 'cover' | 'character' | 'interaction' | 'plot' | 'dialogue' | 'atmosphere' | 'other'

export interface AssetItem {
  id: string
  accountId: string
  comicId?: string
  storagePath: string
  originalName: string
  mimeType: string
  byteSize: number
  sourceUrl?: string
  sourceReferenceId?: string
  sourcePosition?: number
  sourceType: string
  tags: string[]
  workName: string
  chapter: string
  copyrightStatus: CopyrightStatus
  createdAt: string
  previewUrl?: string
  topicId?: string
  topicIds: string[]
  visualFormat: AssetVisualFormat
  classificationConfidence?: number
  classificationNote: string
  reviewStatus: AssetReviewStatus
  contentType: AssetContentType
  characters: string[]
  usageCount: number
  coverUsageCount: number
  lastUsedAt?: string
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
