import { Check, FileImage, Layers3, Link2, RefreshCw, Search, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PillSelect } from '../components/PillSelect'
import { useWorkspace } from '../store/WorkspaceContext'
import type { AssetContentType, AssetItem, AssetVisualFormat, CopyrightStatus } from '../types'

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
  const { activeAccount, accountTopics, state, uploadAssets, correctAssetAnalysis, analyzePendingAssets, toggleTopicAsset } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInput = useRef<HTMLInputElement>(null)
  const briefTopics = accountTopics.filter((topic) => topic.brief?.status === 'approved')
  const comics = state.comics.filter((comic) => comic.accountId === activeAccount.id && comic.status !== 'archived')
  const requestedTopicId = searchParams.get('topic') ?? ''
  const [lastSelectedTopicId, setLastSelectedTopicId] = useState('')
  const selectedTopicId = briefTopics.some((topic) => topic.id === requestedTopicId)
    ? requestedTopicId
    : briefTopics.some((topic) => topic.id === lastSelectedTopicId)
      ? lastSelectedTopicId
      : briefTopics[0]?.id ?? ''
  const [manualComicId, setManualComicId] = useState(() => comics[0]?.id ?? '')
  const [showUpload, setShowUpload] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [workName, setWorkName] = useState('')
  const [chapter, setChapter] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [sourceUrl, setSourceUrl] = useState('')
  const [copyrightStatus, setCopyrightStatus] = useState<CopyrightStatus>('unknown')
  const [query, setQuery] = useState('')
  const [singleOnly, setSingleOnly] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [editFormat, setEditFormat] = useState<AssetVisualFormat>('single')
  const [editContentType, setEditContentType] = useState<AssetContentType>('other')
  const [editTags, setEditTags] = useState('')
  const [editCharacters, setEditCharacters] = useState('')
  const [editNote, setEditNote] = useState('')

  useEffect(() => {
    if (!previewAsset) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewAsset(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [previewAsset])

  const selectedTopic = accountTopics.find((topic) => topic.id === selectedTopicId)
  const comicId = selectedTopic?.comicId ?? manualComicId
  const selectedComic = comics.find((comic) => comic.id === selectedTopic?.comicId)
  const allAssets = (state.assets ?? []).filter((asset) => asset.accountId === activeAccount.id)
  const assets = allAssets.filter((asset) => {
    const matchesComic = !selectedTopic?.comicId || asset.comicId === selectedTopic.comicId
    const matchesQuery = [asset.originalName, asset.workName, asset.chapter, ...asset.tags, ...asset.characters].join(' ').toLowerCase().includes(query.trim().toLowerCase())
    return matchesComic && matchesQuery && (!singleOnly || asset.visualFormat === 'single')
  })
  const selectedCount = allAssets.filter((asset) => selectedTopicId && asset.topicIds.includes(selectedTopicId)).length
  const eligibleCount = allAssets.filter((asset) => (!selectedTopic?.comicId || asset.comicId === selectedTopic.comicId) && asset.visualFormat !== 'invalid' && asset.reviewStatus === 'available').length
  const pendingAnalysisCount = allAssets.filter((asset) => asset.reviewStatus === 'pending' || asset.visualFormat === 'uncertain').length

  function selectBrief(topicId: string) {
    setLastSelectedTopicId(topicId)
    setSearchParams(topicId ? { topic: topicId } : {})
  }

  async function submitUpload(event: FormEvent) {
    event.preventDefault()
    if (!files.length) {
      setError('请先选择图片')
      return
    }
    if (!comicId) {
      setError('请先选择所属漫画')
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
        tags: [],
        comicId: comicId || undefined,
        characters: [],
      })
      setFiles([]); setWorkName(''); setChapter(''); setSourceUrl(''); setCopyrightStatus('unknown'); setShowUpload(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '素材上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function runPendingAnalysis() {
    setAnalyzing(true)
    setError('')
    try {
      const result = await analyzePendingAssets(1)
      setError(result.skipped ? '这张历史素材缺少可读取的原图，已跳过。' : '已完成一张历史素材的视觉分析。')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图片分析失败')
    } finally {
      setAnalyzing(false)
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

  function openAnalysisEditor(asset: AssetItem) {
    setEditingAssetId(asset.id)
    setEditFormat(asset.visualFormat)
    setEditContentType(asset.contentType)
    setEditTags(asset.tags.join('，'))
    setEditCharacters(asset.characters.join('，'))
    setEditNote(asset.classificationNote)
  }

  async function saveAnalysisCorrection(assetId: string) {
    setBusyAssetId(assetId)
    setError('')
    try {
      await correctAssetAnalysis(assetId, {
        visualFormat: editFormat,
        contentType: editContentType,
        tags: [...new Set(editTags.split(/[，,\s]+/).map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 5),
        characters: [...new Set(editCharacters.split(/[，,\s]+/).map((name) => name.trim()).filter(Boolean))].slice(0, 4),
        classificationNote: editNote.trim().slice(0, 64),
      })
      setEditingAssetId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存素材分析失败')
    } finally {
      setBusyAssetId(null)
    }
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">ASSET LIBRARY</span><h1>素材筛选台</h1><p>每张图片采集后自动完成图型、内容类型和标签分析；单图和拼图都可作为 Brief 素材，只有无效图片会被拦截。</p></div><div className="button-row">{pendingAnalysisCount > 0 && <button className="secondary-button" disabled={analyzing} onClick={() => void runPendingAnalysis()}><Sparkles size={16} />{analyzing ? '正在分析…' : `分析下一张历史素材（余 ${pendingAnalysisCount}）`}</button>}<button className="primary-button" onClick={() => setShowUpload((value) => !value)}>{showUpload ? <X size={17} /> : <Upload size={17} />}{showUpload ? '关闭' : '上传素材'}</button></div></section>

      <section className="asset-brief-bar panel">
        <div><label>当前内容 Brief</label><PillSelect value={selectedTopicId} ariaLabel="当前内容 Brief" placeholder="选择 Brief" options={[{ value: '', label: '选择 Brief' }, ...briefTopics.map((topic) => ({ value: topic.id, label: topic.title }))]} onChange={selectBrief} /></div>
        <div className="asset-brief-stat"><strong>{selectedCount}</strong><span>已选素材</span></div>
        <div className="asset-brief-stat"><strong>{eligibleCount}</strong><span>可用单图</span></div>
        <div className="brief-guidance-row">{selectedComic && <span className="guidance-chip comic">《{selectedComic.title}》</span>}{(selectedTopic?.brief ? selectedTopic.brief.assetGuidance : ['先在选题工作流中生成并通过 Brief']).map((item) => <span key={item} className="guidance-chip">{item}</span>)}</div>
        <span className={`status-badge ${selectedTopic?.brief?.status === 'approved' ? 'green' : 'amber'}`}>{selectedTopic?.brief?.status === 'approved' ? 'Brief 已通过' : '请选择已通过的 Brief'}</span>
      </section>

      {showUpload && <form className="asset-upload-panel" onSubmit={submitUpload}>
        <div className="asset-dropzone" onClick={() => fileInput.current?.click()}><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setFiles([...(event.target.files ?? [])].slice(0, 10))} /><Upload size={24} /><strong>{files.length ? `已选择 ${files.length} 张图片` : '点击选择图片'}</strong><span>上传后自动识别图型、画面类型与标签；模型异常时不会写入素材库</span></div>
        <div className="asset-fields">
          <div className="field"><span>所属漫画</span><PillSelect value={comicId} ariaLabel="所属漫画" placeholder="选择漫画" options={[{ value: '', label: '选择漫画' }, ...comics.map((comic) => ({ value: comic.id, label: comic.title }))]} onChange={(nextId) => { setManualComicId(nextId); const comic = comics.find((item) => item.id === nextId); if (comic) setWorkName(comic.title) }} /></div>
          <label>作品名称<input value={workName} onChange={(event) => setWorkName(event.target.value)} placeholder="例如：溯洄春时" /></label>
          <label>章节/片段<input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="例如：待确认 · 摸头互动" /></label>
          <div className="field"><span>素材来源</span><PillSelect value={sourceType} ariaLabel="素材来源" options={[{ value: 'manual', label: '手动整理' }, { value: 'comic-platform', label: '漫画平台截图' }, { value: 'xiaohongshu', label: '小红书参考' }, { value: 'original', label: '本人原创' }]} onChange={setSourceType} /></div>
          <div className="field"><span>版权状态</span><PillSelect value={copyrightStatus} ariaLabel="版权状态" options={[{ value: 'unknown', label: '来源待核对' }, { value: 'reference_only', label: '仅作内部参考' }, { value: 'authorized', label: '已获授权' }, { value: 'original', label: '本人原创' }]} onChange={(value) => setCopyrightStatus(value as CopyrightStatus)} /></div>
          <label className="wide">来源链接<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="原始页面地址，建议填写" /></label>
        </div>
        {error && <p className="research-error">{error}</p>}
        <div className="asset-upload-footer"><span><ShieldCheck size={14} />分析有效的单图和拼图都可用于 Brief；仅无效图片会被拦截</span><button className="primary-button" type="submit" disabled={uploading}>{uploading ? '正在分析并上传…' : `确认上传${files.length ? ` ${files.length} 张` : ''}`}</button></div>
      </form>}

      {error && !showUpload && <p className="research-error">{error}</p>}
      <div className="filter-bar"><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品、章节、角色或标签" /></div><button className={singleOnly ? 'active-filter' : ''} onClick={() => setSingleOnly((value) => !value)}>只看单图</button><button onClick={() => setQuery('')}>重置</button></div>

      {assets.length ? <section className="asset-grid">{assets.map((asset, index) => {
        const selected = Boolean(selectedTopicId && asset.topicIds.includes(selectedTopicId))
        const selectable = asset.visualFormat !== 'invalid' && asset.reviewStatus === 'available'
        return <article className={`asset-card ${selected ? 'selected' : ''}`} key={asset.id}>
          <div className={`asset-cover ${['pink', 'blue', 'purple', 'amber'][index % 4]} ${asset.visualFormat === 'collage' && !asset.previewUrl ? 'collage-preview' : ''} ${asset.previewUrl ? 'is-previewable' : ''}`} role={asset.previewUrl ? 'button' : undefined} tabIndex={asset.previewUrl ? 0 : undefined} aria-label={asset.previewUrl ? `查看${asset.originalName}原图` : undefined} onClick={() => asset.previewUrl && setPreviewAsset(asset)} onKeyDown={(event) => { if (asset.previewUrl && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPreviewAsset(asset) } }}>{asset.previewUrl ? <img src={asset.previewUrl} alt={asset.originalName} /> : asset.visualFormat === 'collage' ? <><span>1</span><span>2</span></> : <><span>{index + 1}</span><FileImage size={24} /></>}</div>
          <div className="asset-card-copy">
            <div className="asset-badge-row"><span className={`status-badge ${asset.visualFormat === 'single' ? 'green' : asset.visualFormat === 'uncertain' ? 'amber' : 'gray'}`}>{visualLabels[asset.visualFormat]}</span>{asset.contentType !== 'other' && <span className="asset-type-chip">{contentTypeLabels[asset.contentType]}</span>}</div>
            <h3>{[asset.workName, asset.chapter].filter(Boolean).join(' · ') || asset.originalName}</h3>
            {asset.characters.length > 0 && <div className="asset-people-row">{asset.characters.map((character) => <span className="character-chip" key={character}>{character}</span>)}</div>}
            {asset.tags.length > 0 && <div className="asset-tags" aria-label="素材标签">{[...new Set(asset.tags)].slice(0, 4).map((tag) => <button className={query.trim() === tag ? 'active' : ''} type="button" key={tag} onClick={() => setQuery(tag)} aria-label={`按标签 ${tag} 筛选`}>#{tag}</button>)}</div>}
            {asset.classificationNote && <p className="classification-note">AI 识别：{asset.classificationNote}</p>}
            {editingAssetId === asset.id ? <div className="asset-edit-panel">
              <div className="asset-edit-grid"><div><span>图型</span><PillSelect value={editFormat} ariaLabel="校正图型" options={Object.entries(visualLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => setEditFormat(value as AssetVisualFormat)} /></div><div><span>类型</span><PillSelect value={editContentType} ariaLabel="校正内容类型" options={Object.entries(contentTypeLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => setEditContentType(value as AssetContentType)} /></div></div>
              <input value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder="标签，用逗号分隔" aria-label="校正标签" />
              <input value={editCharacters} onChange={(event) => setEditCharacters(event.target.value)} placeholder="角色名，用逗号分隔" aria-label="校正角色" />
              <input value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="简短画面说明" aria-label="校正画面说明" />
              <div className="asset-review-actions"><button type="button" onClick={() => setEditingAssetId(null)}>取消</button><button type="button" disabled={busyAssetId === asset.id} onClick={() => void saveAnalysisCorrection(asset.id)}>保存校正</button></div>
            </div> : <button className="asset-correct-button" type="button" onClick={() => openAnalysisEditor(asset)}>校正分析</button>}
            <div className="usage-line"><span><RefreshCw size={12} />使用 {asset.usageCount} 次{asset.lastUsedAt ? ` · 最近 ${asset.lastUsedAt}` : ''}</span>{asset.coverUsageCount > 0 && <span>封面 {asset.coverUsageCount} 次</span>}</div>
            {selectable && <button className={`asset-select-button ${selected ? 'selected' : ''}`} disabled={busyAssetId === asset.id || !selectedTopicId} onClick={() => void toggleSelection(asset.id)}>{selected ? <Check size={15} /> : <Layers3 size={15} />}{selected ? '已加入当前 Brief' : selectedTopicId ? '加入当前 Brief' : '先选择 Brief'}</button>}
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
