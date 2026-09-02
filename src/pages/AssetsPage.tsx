import { FileImage, Link2, Search, ShieldCheck, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useWorkspace } from '../store/WorkspaceContext'
import type { CopyrightStatus } from '../types'

const copyrightLabels: Record<CopyrightStatus, string> = {
  unknown: '来源待核对',
  reference_only: '仅作参考',
  authorized: '已获授权',
  original: '本人原创',
}

export function AssetsPage() {
  const { activeAccount, accountTopics, state, uploadAssets } = useWorkspace()
  const fileInput = useRef<HTMLInputElement>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [workName, setWorkName] = useState('')
  const [chapter, setChapter] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [sourceUrl, setSourceUrl] = useState('')
  const [copyrightStatus, setCopyrightStatus] = useState<CopyrightStatus>('unknown')
  const [tags, setTags] = useState('')
  const [topicId, setTopicId] = useState('')
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const assets = useMemo(() => (state.assets ?? []).filter((asset) => asset.accountId === activeAccount.id && [asset.originalName, asset.workName, asset.chapter, ...asset.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase())), [activeAccount.id, query, state.assets])

  async function submitUpload(event: FormEvent) {
    event.preventDefault()
    if (!files.length) {
      setError('请先选择图片')
      return
    }
    setUploading(true)
    setError('')
    try {
      await uploadAssets(files, {
        workName: workName.trim(),
        chapter: chapter.trim(),
        sourceType,
        sourceUrl: sourceUrl.trim(),
        copyrightStatus,
        tags: tags.split(/[，,\s]+/).map((tag) => tag.trim()).filter(Boolean),
        topicId: topicId || undefined,
      })
      setFiles([]); setWorkName(''); setChapter(''); setSourceUrl(''); setTags(''); setTopicId(''); setCopyrightStatus('unknown'); setShowUpload(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '素材上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">ASSET LIBRARY</span><h1>素材库</h1><p>私有存储，按作品和章节整理；来源、版权状态与关联选题必须保留。</p></div><button className="primary-button" onClick={() => setShowUpload((value) => !value)}>{showUpload ? <X size={17} /> : <Upload size={17} />}{showUpload ? '关闭' : '上传素材'}</button></section>

      {showUpload && <form className="asset-upload-panel" onSubmit={submitUpload}>
        <div className="asset-dropzone" onClick={() => fileInput.current?.click()}><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setFiles([...(event.target.files ?? [])].slice(0, 10))} /><Upload size={24} /><strong>{files.length ? `已选择 ${files.length} 张图片` : '点击选择图片'}</strong><span>JPG、PNG、WebP 或 GIF；单张不超过 15MB，每次最多 10 张</span></div>
        <div className="asset-fields">
          <label>作品名称<input value={workName} onChange={(event) => setWorkName(event.target.value)} placeholder="例如：雾色心跳" /></label>
          <label>章节/片段<input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="例如：第 48 话 · 雨夜告白" /></label>
          <label>素材来源<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="manual">手动整理</option><option value="comic-platform">漫画平台截图</option><option value="xiaohongshu">小红书参考</option><option value="original">本人原创</option></select></label>
          <label>版权状态<select value={copyrightStatus} onChange={(event) => setCopyrightStatus(event.target.value as CopyrightStatus)}><option value="unknown">来源待核对</option><option value="reference_only">仅作内部参考</option><option value="authorized">已获授权</option><option value="original">本人原创</option></select></label>
          <label className="wide">来源链接<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="原始页面地址，建议填写" /></label>
          <label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="告白, 反转, 高情绪" /></label>
          <label>关联选题<select value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">暂不关联</option>{accountTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
        </div>
        {error && <p className="research-error">{error}</p>}
        <div className="asset-upload-footer"><span><ShieldCheck size={14} />文件存入当前用户的私有目录</span><button className="primary-button" type="submit" disabled={uploading}>{uploading ? '正在上传…' : `确认上传${files.length ? ` ${files.length} 张` : ''}`}</button></div>
      </form>}

      <div className="filter-bar"><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品、章节或标签" /></div>{activeAccount.pillars.map((pillar) => <button key={pillar} onClick={() => setQuery(pillar)}>{pillar}</button>)}</div>
      {assets.length ? <section className="asset-grid">{assets.map((asset, index) => <article className="asset-card" key={asset.id}><div className={`asset-cover ${['pink', 'blue', 'purple', 'amber'][index % 4]}`}>{asset.previewUrl ? <img src={asset.previewUrl} alt={asset.originalName} /> : <><span>{asset.chapter.match(/\d+/)?.[0] ?? index + 1}</span><FileImage size={24} /></>}</div><div className="asset-card-copy"><span className={`status-badge ${asset.copyrightStatus === 'unknown' ? 'amber' : asset.copyrightStatus === 'reference_only' ? 'gray' : 'green'}`}>{copyrightLabels[asset.copyrightStatus]}</span><h3>{[asset.workName, asset.chapter].filter(Boolean).join(' · ') || asset.originalName}</h3><p>{(asset.byteSize / 1024 / 1024).toFixed(2)} MB · {asset.createdAt}</p><div><span><Link2 size={13} />{asset.topicId ? '已关联选题' : '暂未关联选题'}</span></div></div></article>)}</section> : <div className="panel empty-state tall">当前账号还没有素材。上传前请确认来源和使用权限。</div>}
    </>
  )
}
