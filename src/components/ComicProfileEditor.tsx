import { useState, type FormEvent } from 'react'
import type { Comic, ComicContentProfile } from '../types'
import { normalizeComicProfile } from '../lib/comicProfile'
import { useWorkspace } from '../store/WorkspaceContext'

const fields = [
  ['officialSynopsis', '官方简介'], ['officialSourceUrl', '快看官方来源链接'],
  ['setting', '故事设定'], ['mainCharacters', '主要人物（每行一位，含身份说明）'],
  ['relationshipSummary', '人物关系'], ['coreConflicts', '核心冲突（每行一项）'],
  ['contentThemes', '主题（每行一项）'], ['toneTags', '情绪基调（每行一项）'],
  ['spoilerBoundary', '剧透边界（可提及范围 / 禁止透露内容）'],
] as const
const lists = new Set(['mainCharacters', 'coreConflicts', 'contentThemes', 'toneTags'])

export function ComicProfileEditor({ comic, onClose }: { comic: Comic; onClose: () => void }) {
  const { saveComicProfile } = useWorkspace()
  const [values, setValues] = useState(() => {
    const profile = normalizeComicProfile(comic.contentProfile)
    return Object.fromEntries(fields.map(([key]) => [key, Array.isArray(profile[key]) ? profile[key].join('\n') : profile[key] ?? '']))
  })
  const [cover, setCover] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const profile = normalizeComicProfile(Object.fromEntries(fields.map(([key]) => [key, lists.has(key) ? values[key].split('\n') : values[key]])) as unknown as ComicContentProfile)
      await saveComicProfile(comic.id, profile, cover)
      onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : '档案保存失败') }
    finally { setSaving(false) }
  }
  return <form className="comic-create-panel" onSubmit={submit}>
    <h2>《{comic.title}》漫画知识档案</h2>
    <p>官方简介请保留原意并附快看来源；其他字段由你核验整理。留空表示未知，Brief 不会据此补写剧情。</p>
    <div className="comic-form-fields">
      {fields.map(([key, label]) => <label className="wide" key={key}>{label}<textarea value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} placeholder="未知 / 待补充" maxLength={10000} disabled={saving} /></label>)}
      <label className="wide">上传封面（JPG / PNG / WebP / GIF，最大 5MB）<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={event => setCover(event.target.files?.[0])} /></label>
    </div>
    {error && <p role="alert" className="research-error">{error}</p>}
    <div className="comic-form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>取消</button><button className="primary-button" disabled={saving}>{saving ? '保存中…' : '保存档案'}</button></div>
  </form>
}
