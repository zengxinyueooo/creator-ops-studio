import type { ComicContentProfile } from '../types'

export const comicProfileFieldKeys = [
  'officialSynopsis',
  'officialSourceUrl',
  'setting',
  'mainCharacters',
  'relationshipSummary',
  'coreConflicts',
  'contentThemes',
  'toneTags',
  'spoilerBoundary',
] as const satisfies ReadonlyArray<Exclude<keyof ComicContentProfile, 'updatedAt'>>

export function normalizeComicProfile(value?: Partial<ComicContentProfile> | null): ComicContentProfile {
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : ''
  const list = (v: unknown) => {
    const items = Array.isArray(v) ? v : typeof v === 'string' ? [v] : []
    return items
      .filter((item): item is string => typeof item === 'string')
      .flatMap((item) => item.split(/[\r\n；;]+/))
      .map(text)
      .filter(Boolean)
  }
  return {
    officialSynopsis: text(value?.officialSynopsis), officialSourceUrl: text(value?.officialSourceUrl),
    setting: text(value?.setting), mainCharacters: list(value?.mainCharacters),
    relationshipSummary: text(value?.relationshipSummary), coreConflicts: list(value?.coreConflicts),
    contentThemes: list(value?.contentThemes), toneTags: list(value?.toneTags),
    spoilerBoundary: text(value?.spoilerBoundary), updatedAt: text(value?.updatedAt),
  }
}

export function getComicProfileProgress(value?: Partial<ComicContentProfile> | null) {
  const profile = normalizeComicProfile(value)
  const completed = comicProfileFieldKeys.filter((key) => {
    const field = profile[key]
    return Array.isArray(field) ? field.length > 0 : Boolean(field)
  }).length
  return {
    completed,
    total: comicProfileFieldKeys.length,
    percent: Math.round((completed / comicProfileFieldKeys.length) * 100),
    isEmpty: completed === 0,
    isComplete: completed === comicProfileFieldKeys.length,
  }
}

export function validateComicProfile(profile: ComicContentProfile) {
  if (!profile.officialSourceUrl) return
  let url: URL
  try { url = new URL(profile.officialSourceUrl) } catch { throw new Error('官方来源必须是快看漫画 HTTPS 链接') }
  if (url.protocol !== 'https:' || !(url.hostname === 'kuaikanmanhua.com' || url.hostname.endsWith('.kuaikanmanhua.com')) || url.username || url.password) {
    throw new Error('官方来源必须是快看漫画 HTTPS 链接')
  }
}

export function validateComicCover(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('封面仅支持 JPG、PNG、WebP、GIF')
  if (file.size > 5 * 1024 * 1024) throw new Error('封面不能超过 5MB')
}
