import { Check, FileImage, ImageOff, Layers3, Link2, RefreshCw, Search, ShieldCheck, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useWorkspace } from '../store/WorkspaceContext'
import type { AssetContentType, AssetItem, AssetVisualFormat, CopyrightStatus } from '../types'

const copyrightLabels: Record<CopyrightStatus, string> = {
  unknown: '来源待核对',
  reference_only: '仅作参考',
  authorized: '已获授权',
  original: '本人原创',
}

const visualLabels: Record<AssetVisualFormat, string> = {
  single: '单图',
  collage: '拼图',
  uncertain: '待确认',
  invalid: '无效素材',
}

const contentTypeLabels: Record<AssetContentType, string> = {
  cover: '封面',
  character: '人物',
  interaction: '互动',
  plot: '剧情',
  dialogue: '台词',
  atmosphere: '氛围',
  other: '其他',
}

export function AssetsPage() {
  const { activeAccount, accountTopics, state, uploadAssets, reviewAsset, toggleTopicAsset } = useWorkspace()
  const fileInput = useRef<HTMLInputElement>(null)
  const briefTopics = accountTopics.filter((topic) => topic.brief)
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const [selectedTopicId, setSelectedTopicId] = useState(() => briefTopics.find((topic) => topic.brief?.status === 'approved')?.id ?? briefTopics[0]?.id ?? '')
  const [comicId, setComicId] = useState(() => briefTopics.find((topic) => topic.brief?.status === 'approved')?.comicId ?? comics[0]?.id ?? '')
  const [showUpload, setShowUpload] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [workName, setWorkName] = useState('')
  const [chapter, setChapter] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [sourceUrl, setSourceUrl] = useState('')
  const [copyrightStatus, setCopyrightStatus] = useState<CopyrightStatus>('unknown')
  const [tags, setTags] = useState('')
  const [characters, setCharacters] = useState('')
  const [visualFormat, setVisualFormat] = useState<AssetVisualFormat>('uncertain')
  const [contentType, setContentType] = useState<AssetContentType>('other')
  const [query, setQuery] = useState('')
  const [singleOnly, setSingleOnly] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null)

  useEffect(() => {
    if (!previewAsset) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewAsset(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [previewAsset])

  const selectedTopic = accountTopics.find((topic) => topic.id === selectedTopicId)
  const selectedComic = comics.find((comic) => comic.id === selectedTopic?.comicId)
  const allAssets = (state.assets ?? []).filter((asset) => asset.accountId === activeAccount.id)
  const assets = allAssets.filter((asset) => {
    const matchesComic = !selectedTopic?.comicId || asset.comicId === selectedTopic.comicId
    const matchesQuery = [asset.originalName, asset.workName, asset.chapter, ...asset.tags, ...asset.characters].join(' ').toLowerCase().includes(query.trim().toLowerCase())
    return matchesComic && matchesQuery && (!singleOnly || asset.visualFormat === 'single')
  })
  const selectedCount = allAssets.filter((asset) => selectedTopicId && asset.topicIds.includes(selectedTopicId)).length
  const eligibleCount = allAssets.filter((asset) => (!selectedTopic?.comicId || asset.comicId === selectedTopic.comicId) && asset.visualFormat === 'single' && asset.reviewStatus === 'available').length

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
        comicId: comicId || undefined,
        topicId: visualFormat === 'single' ? selectedTopicId || undefined : undefined,
        visualFormat,
        contentType,
        characters: characters.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean),
      })
      setFiles([]); setWorkName(''); setChapter(''); setSourceUrl(''); setTags(''); setCharacters(''); setCopyrightStatus('unknown'); setVisualFormat('uncertain'); setContentType('other'); setShowUpload(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '素材上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function changeClassification(assetId: string, format: AssetVisualFormat) {
    setBusyAssetId(assetId)
    setError('')
    try {
      await reviewAsset(assetId, format, format === 'single' ? 'available' : format === 'uncertain' ? 'pending' : 'rejected')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '素材审核保存失败')
    } finally {
      setBusyAssetId(null)
    }
  }

  async function toggleSelection(assetId: string) {
    if (!selectedTopicId) {
      setError('请先选择一份 Brief')
      return
    }
    if (selectedTopic?.brief?.status !== 'approved') {
      setError('请先在选题工作流中通过这份 Brief')
      return
    }
    setBusyAssetId(assetId)
    setError('')
    try {
      await toggleTopicAsset(selectedTopicId, assetId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '选图结果保存失败')
    } finally {
      setBusyAssetId(null)
    }
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">ASSET REVIEW</span><h1>素材筛选台</h1><p>识别结果先审核；只有单图可以进入 Brief，已用素材仍可复用但会展示使用历史。</p></div><button className="primary-button" onClick={() => setShowUpload((value) => !value)}>{showUpload ? <X size={17} /> : <Upload size={17} />}{showUpload ? '关闭' : '上传素材'}</button></section>

      <section className="asset-brief-bar panel">
        <div><label>当前内容 Brief</label><select value={selectedTopicId} onChange={(event) => { const nextId = event.target.value; setSelectedTopicId(nextId); const topic = briefTopics.find((item) => item.id === nextId); if (topic?.comicId) setComicId(topic.comicId) }}><option value="">选择 Brief</option>{briefTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></div>
        <div className="asset-brief-stat"><strong>{selectedCount}</strong><span>已选素材</span></div>
        <div className="asset-brief-stat"><strong>{eligibleCount}</strong><span>可用单图</span></div>
        <p>{selectedComic ? `《${selectedComic.title}》 · ` : ''}{selectedTopic?.brief ? selectedTopic.brief.assetGuidance.join(' · ') : '先在选题工作流中生成并通过 Brief'}</p>
        <span className={`status-badge ${selectedTopic?.brief?.status === 'approved' ? 'green' : 'amber'}`}>{selectedTopic?.brief?.status === 'approved' ? 'Brief 已通过' : 'Brief 待审核'}</span>
      </section>

      {showUpload && <form className="asset-upload-panel" onSubmit={submitUpload}>
        <div className="asset-dropzone" onClick={() => fileInput.current?.click()}><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setFiles([...(event.target.files ?? [])].slice(0, 10))} /><Upload size={24} /><strong>{files.length ? `已选择 ${files.length} 张图片` : '点击选择图片'}</strong><span>采集 Workflow 会写入识别结果；手动上传时可在下方确认</span></div>
        <div className="asset-fields">
          <label>所属漫画<select value={comicId} onChange={(event) => { const nextId = event.target.value; setComicId(nextId); const comic = comics.find((item) => item.id === nextId); if (comic) setWorkName(comic.title) }} required><option value="">选择漫画</option>{comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}</select></label>
          <label>作品名称<input value={workName} onChange={(event) => setWorkName(event.target.value)} placeholder="例如：溯洄春时" /></label>
          <label>章节/片段<input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="例如：待确认 · 摸头互动" /></label>
          <label>图片结构<select value={visualFormat} onChange={(event) => setVisualFormat(event.target.value as AssetVisualFormat)}><option value="uncertain">待识别/待确认</option><option value="single">确认为单图</option><option value="collage">两张以上拼图</option><option value="invalid">无效素材</option></select></label>
          <label>内容类型<select value={contentType} onChange={(event) => setContentType(event.target.value as AssetContentType)}>{Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>素材来源<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="manual">手动整理</option><option value="comic-platform">漫画平台截图</option><option value="xiaohongshu">小红书参考</option><option value="original">本人原创</option></select></label>
          <label>版权状态<select value={copyrightStatus} onChange={(event) => setCopyrightStatus(event.target.value as CopyrightStatus)}><option value="unknown">来源待核对</option><option value="reference_only">仅作内部参考</option><option value="authorized">已获授权</option><option value="original">本人原创</option></select></label>
          <label>主要角色<input value={characters} onChange={(event) => setCharacters(event.target.value)} placeholder="栩听, 晏" /></label>
          <label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="脸红, 互动, 暧昧" /></label>
          <label className="wide">来源链接<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="原始页面地址，建议填写" /></label>
        </div>
        {error && <p className="research-error">{error}</p>}
        <div className="asset-upload-footer"><span><ShieldCheck size={14} />拼图和待确认素材不会自动关联 Brief</span><button className="primary-button" type="submit" disabled={uploading}>{uploading ? '正在上传…' : `确认上传${files.length ? ` ${files.length} 张` : ''}`}</button></div>
      </form>}

      {error && !showUpload && <p className="research-error">{error}</p>}
      <div className="filter-bar"><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品、章节、角色或标签" /></div><button className={singleOnly ? 'active-filter' : ''} onClick={() => setSingleOnly((value) => !value)}>只看单图</button><button onClick={() => setQuery('')}>重置</button></div>

      {assets.length ? <section className="asset-grid">{assets.map((asset, index) => {
        const selected = Boolean(selectedTopicId && asset.topicIds.includes(selectedTopicId))
        const selectable = asset.visualFormat === 'single' && asset.reviewStatus === 'available'
        return <article className={`asset-card ${selected ? 'selected' : ''} ${!selectable ? 'blocked' : ''}`} key={asset.id}>
          <div className={`asset-cover ${['pink', 'blue', 'purple', 'amber'][index % 4]} ${asset.visualFormat === 'collage' && !asset.previewUrl ? 'collage-preview' : ''} ${asset.previewUrl ? 'is-previewable' : ''}`} role={asset.previewUrl ? 'button' : undefined} tabIndex={asset.previewUrl ? 0 : undefined} aria-label={asset.previewUrl ? `查看${asset.originalName}原图` : undefined} onClick={() => asset.previewUrl && setPreviewAsset(asset)} onKeyDown={(event) => { if (asset.previewUrl && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPreviewAsset(asset) } }}>{asset.previewUrl ? <img src={asset.previewUrl} alt={asset.originalName} /> : asset.visualFormat === 'collage' ? <><span>1</span><span>2</span></> : <><span>{index + 1}</span><FileImage size={24} /></>}</div>
          <div className="asset-card-copy">
            <div className="asset-badge-row"><span className={`status-badge ${asset.visualFormat === 'single' ? 'green' : asset.visualFormat === 'uncertain' ? 'amber' : 'gray'}`}>{visualLabels[asset.visualFormat]}</span><span className="asset-type-chip">{contentTypeLabels[asset.contentType]}</span></div>
            <h3>{[asset.workName, asset.chapter].filter(Boolean).join(' · ') || asset.originalName}</h3>
            <p>{asset.characters.length ? asset.characters.join('、') : '角色待标注'} · {copyrightLabels[asset.copyrightStatus]}</p>
            {asset.tags.length > 0 && <div className="asset-tags" aria-label="素材标签">{[...new Set(asset.tags)].slice(0, 4).map((tag) => <button className={query.trim() === tag ? 'active' : ''} type="button" key={tag} onClick={() => setQuery(tag)} aria-label={`按标签 ${tag} 筛选`}>#{tag}</button>)}</div>}
            <p className="classification-note">{asset.classificationNote || '等待图片识别 Workflow 返回结果'}</p>
            <div className="usage-line"><span><RefreshCw size={12} />使用 {asset.usageCount} 次{asset.lastUsedAt ? ` · 最近 ${asset.lastUsedAt}` : ''}</span>{asset.coverUsageCount > 0 && <span>封面 {asset.coverUsageCount} 次</span>}</div>
            {asset.visualFormat === 'uncertain' && <div className="asset-review-actions"><button disabled={busyAssetId === asset.id} onClick={() => void changeClassification(asset.id, 'single')}><Check size={13} />确认单图</button><button disabled={busyAssetId === asset.id} onClick={() => void changeClassification(asset.id, 'collage')}><ImageOff size={13} />标为拼图</button></div>}
            <button className={`asset-select-button ${selected ? 'selected' : ''}`} disabled={!selectable || busyAssetId === asset.id || !selectedTopicId} onClick={() => void toggleSelection(asset.id)}>{selected ? <Check size={15} /> : <Layers3 size={15} />}{selected ? '已加入当前 Brief' : selectable ? '加入当前 Brief' : '不可选'}</button>
            <div className="asset-source-line"><span><Link2 size={12} />{asset.sourceType === 'xiaohongshu' ? '小红书参考' : asset.sourceType}</span></div>
          </div>
        </article>
      })}</section> : <div className="panel empty-state tall">当前筛选条件下没有素材。</div>}

      {previewAsset?.previewUrl && <div className="asset-lightbox" role="dialog" aria-modal="true" aria-label={`${previewAsset.originalName}原图预览`} onClick={() => setPreviewAsset(null)}>
        <button className="asset-lightbox-close" type="button" aria-label="关闭原图预览" onClick={() => setPreviewAsset(null)}><X size={20} /></button>
        <div className="asset-lightbox-content" onClick={(event) => event.stopPropagation()}>
          <img src={previewAsset.previewUrl} alt={previewAsset.originalName} />
          <p>{[previewAsset.workName, previewAsset.chapter].filter(Boolean).join(' · ') || previewAsset.originalName} · 原图预览</p>
        </div>
      </div>}
    </>
  )
}
