import { ComicProfileEditor } from '../components/ComicProfileEditor'
import { ArrowUpRight, BookOpen, Check, CircleX, Library, Plus, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { getComicProfileProgress, normalizeComicProfile } from '../lib/comicProfile'
import { useWorkspace } from '../store/WorkspaceContext'
import type { Comic } from '../types'

const platformLabels: Record<string, string> = {
  kuaikan: '快看漫画',
  快看漫画: '快看漫画',
}

const mangaPlatform = '快看漫画'

const serializationLabels = {
  ongoing: '连载中',
  completed: '已完结',
  unknown: '连载状态待确认',
}

const COVER_TONES = ['pink', 'blue', 'purple', 'amber'] as const

function ComicCard({ comic, mode, tone, onEdit, onKeep, onDrop }: {
  comic: Comic
  mode: 'candidate' | 'selected'
  tone: string
  onEdit: () => void
  onKeep?: () => void
  onDrop?: () => void
}) {
  const platform = platformLabels[comic.platform] ?? comic.platform
  const serialization = serializationLabels[comic.serializationStatus]
  const profile = normalizeComicProfile(comic.contentProfile)
  const profileProgress = getComicProfileProgress(profile)
  const profileTags = [...profile.contentThemes, ...profile.toneTags].slice(0, 3)
  return (
    <article className="comic-card">
      <div className={`comic-cover-placeholder ${tone}`}>{comic.coverUrl ? <img src={comic.coverUrl} alt={`${comic.title}封面`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><BookOpen size={25} /><span>{comic.title.slice(0, 1)}</span></>}</div>
      <div className="comic-card-body">
        <div className="comic-card-top">
          <span className={`status-badge ${mode === 'selected' ? 'green' : 'amber'}`}>{mode === 'selected' ? '已保留' : '待审核'}</span>
          <small>{comic.createdAt}</small>
        </div>
        <h3>{comic.title}</h3>
        <p className="comic-platform">{platform} · {serialization}{comic.updateNote ? ` · ${comic.updateNote}` : ''}</p>
        <p className="comic-reason">{comic.selectionNote || '暂无调研说明'}</p>
        <div className={`comic-profile-summary ${profileProgress.isEmpty ? 'empty' : ''}`}>
          <div><strong>{profileProgress.isEmpty ? '漫画档案待补充' : `漫画档案 ${profileProgress.completed}/${profileProgress.total}`}</strong>{!profileProgress.isEmpty && <span>{profileProgress.percent}%</span>}</div>
          <p>{profile.officialSynopsis || '补充官方简介、人物关系和内容边界后，可用于生成有依据的 Brief。'}</p>
          {profileTags.length > 0 && <div className="comic-profile-tags">{profileTags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        </div>
        <button className="comic-profile-button" type="button" onClick={onEdit}><BookOpen size={15} />{profileProgress.isEmpty ? '补充漫画档案' : '查看 / 编辑漫画档案'}</button>
        <div className="comic-card-footer">
          <div className="comic-source-links">
            {profile.officialSourceUrl && <a href={profile.officialSourceUrl} target="_blank" rel="noreferrer">快看官方页 <ArrowUpRight size={14} /></a>}
            {comic.sourceUrl ? <a href={comic.sourceUrl} target="_blank" rel="noreferrer">调研来源 <ArrowUpRight size={14} /></a> : !profile.officialSourceUrl && <span>未填写来源</span>}
          </div>
          {mode === 'candidate' && <div>
            <button className="ghost-danger-button" type="button" onClick={onDrop}><CircleX size={15} />暂不收录</button>
            <button className="primary-button" type="button" onClick={onKeep}><Check size={15} />保留</button>
          </div>}
        </div>
      </div>
    </article>
  )
}

export function ComicsPage() {
  const { activeAccount, state, addComic, updateComicStatus } = useWorkspace()
  const [editingId, setEditingId] = useState<string>()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [selectionNote, setSelectionNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const comics = useMemo(() => state.comics.filter((comic) => comic.accountId === activeAccount.id), [activeAccount.id, state.comics])
  const candidates = comics.filter((comic) => comic.status === 'candidate')
  const selected = comics.filter((comic) => ['selected', 'following', 'paused', 'completed'].includes(comic.status))

  async function submitCandidate(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      await addComic({ title: title.trim(), platform: mangaPlatform, sourceUrl: sourceUrl.trim(), selectionNote: selectionNote.trim() })
      setTitle('')
      setSourceUrl('')
      setSelectionNote('')
      setShowForm(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '候选漫画保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function review(comicId: string, keep: boolean) {
    setError('')
    try {
      await updateComicStatus(comicId, keep ? 'selected' : 'dropped')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '审核结果保存失败')
    }
  }

  if (activeAccount.kind !== 'manga') {
    return <section className="panel empty-module"><Library size={30} /><h1>漫画候选库仅用于漫画账号</h1><p>切换到“漫画放映室”后即可查看。</p></section>
  }

  return (
    <>
      <section className="page-heading compact-heading">
        <div><span className="eyebrow">COMIC RESEARCH</span><h1>漫画候选库</h1><p>这里只收录快看漫画作品；调研结果先由你审核，再进入后续选题和素材流程。</p></div>
        <button className="primary-button" type="button" onClick={() => setShowForm((current) => !current)}><Plus size={16} />录入调研结果</button>
      </section>

      <section className="comic-demo-strip">
        <div><Search size={19} /><span><strong>{candidates.length}</strong> 部待你审核<small>调研结果先进入候选区</small></span></div>
        <div><Check size={19} /><span><strong>{selected.length}</strong> 部已保留<small>后续可按漫画找素材</small></span></div>
        <p>Demo 流程：录入候选 → 人工审核 → 进入漫画库</p>
      </section>

      {editingId && comics.find(comic => comic.id === editingId) && <ComicProfileEditor key={editingId} comic={comics.find(comic => comic.id === editingId)!} onClose={() => setEditingId(undefined)} />}
      {showForm && <form className="comic-create-panel" onSubmit={submitCandidate}>
        <div className="panel-heading"><div><h2>录入一条调研结果</h2><p>目前先手动录入，下一版再承接自动调研结果。</p></div></div>
        <div className="comic-form-fields">
          <label>漫画名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：某某漫画" maxLength={100} required /></label>
          <label>连载平台<input value="快看漫画（固定）" disabled /></label>
          <label className="wide">来源链接（可选）<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="漫画详情页或调研来源" /></label>
          <label className="wide">为什么值得关注（可选）<textarea value={selectionNote} onChange={(event) => setSelectionNote(event.target.value)} placeholder="例如：近期更新稳定，有多个高情绪片段可做" maxLength={300} /></label>
        </div>
        {error && <p className="research-error">{error}</p>}
        <div className="comic-form-actions"><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>取消</button><button className="primary-button" type="submit" disabled={saving}>{saving ? '保存中…' : '加入待审核区'}</button></div>
      </form>}

      {!showForm && error && <p className="research-error">{error}</p>}

      <section className="comic-section">
        <div className="comic-section-heading"><div><span className="comic-step">1</span><span><h2>待审核候选</h2><p>调研得到的漫画先集中放在这里</p></span></div><span>{candidates.length} 部</span></div>
        {candidates.length ? <div className="comic-grid">{candidates.map((comic, index) => <ComicCard key={comic.id} comic={comic} onEdit={() => setEditingId(comic.id)} mode="candidate" tone={COVER_TONES[index % COVER_TONES.length]} onKeep={() => void review(comic.id, true)} onDrop={() => void review(comic.id, false)} />)}</div> : <div className="comic-empty"><Check size={22} /><strong>候选都审核完了</strong><span>点击右上角“录入调研结果”可以继续添加。</span></div>}
      </section>

      <section className="comic-section">
        <div className="comic-section-heading"><div><span className="comic-step done">2</span><span><h2>我的漫画库</h2><p>你确认保留、后续准备做内容的漫画</p></span></div><span>{selected.length} 部</span></div>
        {selected.length ? <div className="comic-grid">{selected.map((comic, index) => <ComicCard key={comic.id} comic={comic} onEdit={() => setEditingId(comic.id)} mode="selected" tone={COVER_TONES[index % COVER_TONES.length]} />)}</div> : <div className="comic-empty"><Library size={22} /><strong>还没有保留的漫画</strong><span>审核候选漫画后，它会出现在这里。</span></div>}
      </section>
    </>
  )
}
