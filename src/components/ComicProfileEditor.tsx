import { BookOpen, CheckCircle2, ImagePlus, Save, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import type { Comic, ComicContentProfile } from '../types'
import { getComicProfileProgress, normalizeComicProfile } from '../lib/comicProfile'
import { useWorkspace } from '../store/WorkspaceContext'

type ProfileField = Exclude<keyof ComicContentProfile, 'updatedAt'>

const sections: Array<{
  title: string
  description: string
  fields: Array<{ key: ProfileField; label: string; placeholder: string; list?: boolean; full?: boolean; input?: boolean }>
}> = [
  {
    title: '官方依据',
    description: '官方原文和出处会与人工整理内容分开保存。',
    fields: [
      { key: 'officialSynopsis', label: '官方简介', placeholder: '粘贴或整理快看漫画官方简介', full: true },
      { key: 'officialSourceUrl', label: '快看官方来源链接', placeholder: 'https://www.kuaikanmanhua.com/…', full: true, input: true },
    ],
  },
  {
    title: '故事与人物',
    description: '只填写已经核验的信息，空白项会保持为未知。',
    fields: [
      { key: 'setting', label: '故事设定', placeholder: '时代、地点、世界观或故事起点' },
      { key: 'relationshipSummary', label: '人物关系', placeholder: '人物之间的关系与变化' },
      { key: 'mainCharacters', label: '主要人物', placeholder: '每行一位，包含身份说明', list: true },
      { key: 'coreConflicts', label: '核心冲突', placeholder: '每行一项', list: true },
    ],
  },
  {
    title: '内容边界',
    description: '这些字段会直接约束后续 Brief，不会用选题标题补写剧情。',
    fields: [
      { key: 'contentThemes', label: '内容主题', placeholder: '每行一项，如成长、重逢', list: true },
      { key: 'toneTags', label: '情绪基调', placeholder: '每行一项，如治愈、酸涩', list: true },
      { key: 'spoilerBoundary', label: '剧透边界', placeholder: '可提及的范围，以及禁止透露的情节', full: true },
    ],
  },
]

const fields = sections.flatMap((section) => section.fields)
const listFields = new Set<ProfileField>(fields.filter((field) => field.list).map((field) => field.key))

function formatProfileTime(value?: string) {
  if (!value) return '尚未保存'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '已保存'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function ComicProfileEditor({ comic, onClose }: { comic: Comic; onClose: () => void }) {
  const { saveComicProfile } = useWorkspace()
  const titleId = useId()
  const [values, setValues] = useState(() => {
    const profile = normalizeComicProfile(comic.contentProfile)
    return Object.fromEntries(fields.map(({ key }) => [key, Array.isArray(profile[key]) ? profile[key].join('\n') : profile[key] ?? ''])) as Record<ProfileField, string>
  })
  const [cover, setCover] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : comic.coverUrl, [comic.coverUrl, cover])
  const draftProfile = normalizeComicProfile(Object.fromEntries(fields.map(({ key }) => [key, listFields.has(key) ? values[key].split('\n') : values[key]])) as unknown as ComicContentProfile)
  const progress = getComicProfileProgress(draftProfile)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, saving])

  useEffect(() => () => {
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
  }, [coverPreview])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveComicProfile(comic.id, draftProfile, cover)
      onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : '档案保存失败') }
    finally { setSaving(false) }
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !saving) onClose()
  }

  return createPortal(
    <div className="comic-profile-backdrop" onMouseDown={closeFromBackdrop}>
      <section className="comic-profile-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form className="comic-profile-form" onSubmit={submit}>
          <header className="comic-profile-header">
            <div className="comic-profile-title-mark"><BookOpen size={22} /></div>
            <div>
              <span>COMIC KNOWLEDGE PROFILE</span>
              <h2 id={titleId}>《{comic.title}》漫画知识档案</h2>
              <p>保存后会立即回显到漫画卡片，并作为后续 Brief 的事实边界。</p>
            </div>
            <button className="comic-profile-close" type="button" aria-label="关闭漫画档案" title="关闭" disabled={saving} onClick={onClose}><X size={20} /></button>
          </header>

          <div className="comic-profile-overview">
            <div className="comic-profile-cover-preview">
              {coverPreview ? <img src={coverPreview} alt={`${comic.title}封面预览`} /> : <><BookOpen size={25} /><span>{comic.title.slice(0, 1)}</span></>}
            </div>
            <div className="comic-profile-overview-copy">
              <div><strong>{progress.isComplete ? '档案已完善' : `已填写 ${progress.completed} / ${progress.total} 项`}</strong><span>{formatProfileTime(comic.contentProfile?.updatedAt)}</span></div>
              <div className="comic-profile-progress" aria-label={`档案完成度 ${progress.percent}%`}><span style={{ width: `${progress.percent}%` }} /></div>
              <p>留空即表示未知，生成内容时不会自动补写人物、关系或剧情。</p>
              <label className="comic-profile-cover-control"><ImagePlus size={16} /><span>{cover ? `已选择：${cover.name}` : comic.coverUrl ? '更换封面' : '上传封面'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={(event) => setCover(event.target.files?.[0])} /></label>
              <small>JPG / PNG / WebP / GIF，最大 5MB</small>
            </div>
          </div>

          <div className="comic-profile-content">
            {sections.map((section) => <section className="comic-profile-section" key={section.title}>
              <div className="comic-profile-section-heading"><div><h3>{section.title}</h3><p>{section.description}</p></div><CheckCircle2 size={17} /></div>
              <div className="comic-profile-fields">
                {section.fields.map(({ key, label, placeholder, full, input }) => <label className={full ? 'full' : ''} key={key}>
                  <span>{label}</span>
                  {input
                    ? <input type="url" value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} maxLength={2000} disabled={saving} />
                    : <textarea value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} maxLength={10000} disabled={saving} />}
                </label>)}
              </div>
            </section>)}
          </div>

          {error && <p role="alert" className="research-error comic-profile-error">{error}</p>}
          <footer className="comic-profile-actions">
            <span>{progress.isEmpty ? '当前档案为空，仍可保存为“未知”状态' : `完成度 ${progress.percent}% · 保存后刷新页面仍会保留`}</span>
            <div><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>取消</button><button className="primary-button" disabled={saving}><Save size={16} />{saving ? '保存中…' : '保存并回到漫画库'}</button></div>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  )
}
