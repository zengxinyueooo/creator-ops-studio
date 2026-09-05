import { CheckCircle2, Copy, FileImage, FileText, MessageSquareText, PenLine, Send, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AiGenerationError, generateAiJson } from '../lib/aiClient'
import { useWorkspace } from '../store/WorkspaceContext'

export function DraftsPage() {
  const { accountTopics, state, markTopicPublished } = useWorkspace()
  const briefTopics = accountTopics.filter((topic) => topic.brief)
  const [selectedId, setSelectedId] = useState(() => briefTopics.find((topic) => topic.brief?.status === 'approved')?.id ?? briefTopics[0]?.id ?? '')
  const selected = briefTopics.find((topic) => topic.id === selectedId) ?? briefTopics[0]
  const selectedAssets = useMemo(() => state.assets.filter((asset) => selected && asset.topicIds.includes(selected.id) && asset.visualFormat === 'single' && asset.reviewStatus === 'available'), [selected, state.assets])
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [version, setVersion] = useState(0)
  const [generationLabel, setGenerationLabel] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState('')

  async function generateDraft() {
    if (!selected?.brief || selected.brief.status !== 'approved' || !selectedAssets.length) {
      setMessage('需要先通过 Brief，并至少选择一张可用单图素材。')
      return
    }
    const visualCue = selectedAssets.slice(0, 3).map((asset) => asset.tags[0] || asset.contentType).join('、')
    const fallback = {
      title: selected.brief.hook.replace(/[。！？!?]$/, '').slice(0, 24),
      body: `${selected.brief.hook}\n\n${selected.brief.angle}\n\n这组画面里最戳我的，是${visualCue || '人物之间的细微反应'}。没有直白说出口，但动作、眼神和停顿已经把情绪推到了这里。\n\n你们看到这一段时，最先注意到的是哪一格？`,
    }
    setGenerating(true)
    setMessage('')
    try {
      const result = await generateAiJson<{ title?: unknown; body?: unknown }>({
        system: '你是小红书漫画账号的文案编辑。仅根据给定 Brief 与已选素材标签输出原创 JSON，不得复刻参考笔记、杜撰剧情或宣称自动发布。',
        prompt: JSON.stringify({
          task: '生成一个可由用户继续编辑的小红书漫画图文草稿。返回 title（不超过24个中文字符）和 body（正文，含自然的讨论收尾）。',
          brief: selected.brief,
          assets: selectedAssets.map((asset) => ({ tags: asset.tags, contentType: asset.contentType, characters: asset.characters, chapter: asset.chapter })),
        }),
        maxTokens: 850,
        temperature: 0.75,
      })
      const title = typeof result.data.title === 'string' ? result.data.title.trim().slice(0, 24) : ''
      const body = typeof result.data.body === 'string' ? result.data.body.trim().slice(0, 1_500) : ''
      if (!title || !body) throw new AiGenerationError('模型未返回可用的标题与正文，请重试')
      setDraftTitle(title)
      setDraftBody(body)
      setGenerationLabel(`AI 生成 · ${result.model}`)
      setVersion((current) => current + 1)
      setMessage('已生成可编辑草稿，请在发布前完成你的人工审核。')
    } catch (caught) {
      if (caught instanceof AiGenerationError && caught.code === 'AI_NOT_CONFIGURED') {
        setDraftTitle(fallback.title)
        setDraftBody(fallback.body)
        setGenerationLabel('模板草稿（未调用模型）')
        setVersion((current) => current + 1)
        setMessage('未配置模型密钥，已生成可识别的模板草稿。')
      } else {
        setMessage(caught instanceof Error ? caught.message : '文案生成失败，请重试')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function confirmPublished() {
    if (!selected) return
    setPublishing(true)
    setMessage('')
    try {
      await markTopicPublished(selected.id)
      setMessage('已标记发布，并为本次选用素材写入使用记录。')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '发布状态保存失败')
    } finally {
      setPublishing(false)
    }
  }

  async function copyDraft() {
    if (!draftTitle && !draftBody) return
    await navigator.clipboard.writeText(`${draftTitle}\n\n${draftBody}`)
    setMessage('文案已复制。')
  }

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">BRIEF + ASSETS → COPY</span><h1>文案工作台</h1><p>文案只使用已通过的 Brief 和你勾选的单图素材；标记发布后才累计素材使用次数。</p></div><button className="primary-button" disabled={generating} onClick={() => void generateDraft()}><Sparkles size={17} />{generating ? '正在生成…' : '基于 Brief 生成'}</button></section>
      <section className="draft-layout">
        <aside className="panel draft-list"><div className="panel-heading"><div><h2>内容 Brief</h2><p>{briefTopics.length} 份候选</p></div><FileText size={18} /></div>{briefTopics.map((topic) => <button key={topic.id} onClick={() => { setSelectedId(topic.id); setDraftTitle(''); setDraftBody(''); setVersion(0); setGenerationLabel(''); setMessage('') }} className={topic.id === selected?.id ? 'draft-item active' : 'draft-item'}><span>{topic.title.slice(0, 1)}</span><div><strong>{topic.title}</strong><small>{topic.brief?.status === 'approved' ? 'Brief 已通过' : '等待 Brief 审核'} · {topic.assetCount} 张素材</small></div></button>)}{!briefTopics.length && <div className="empty-state">还没有内容 Brief。</div>}</aside>
        <div className="panel editor-panel">
          <div className="editor-heading"><div><span className={`status-badge ${selected?.brief?.status === 'approved' ? 'green' : 'amber'}`}>{selected?.brief?.status === 'approved' ? 'Brief 已通过' : 'Brief 待审核'}</span><h2>{selected?.title ?? '暂无选题'}</h2></div><div className="button-row"><button className="icon-button" aria-label="复制文案" onClick={() => void copyDraft()}><Copy size={16} /></button><button className="secondary-button" disabled={generating} onClick={() => void generateDraft()}><PenLine size={16} />{generating ? '正在生成…' : '生成新版本'}</button></div></div>

          {selected?.brief && <div className="copy-brief-summary"><span>{selected.brief.coreEmotion}</span><p>{selected.brief.angle}</p><blockquote>{selected.brief.hook}</blockquote></div>}

          <div className="copy-assets-section"><div><label>本次选用素材</label><span>{selectedAssets.length} 张 · 第一张视为封面</span></div>{selectedAssets.length ? <div className="copy-asset-strip">{selectedAssets.map((asset, index) => <div key={asset.id}><span>{index + 1}</span><strong>{asset.tags[0] || asset.originalName}</strong><small>历史使用 {asset.usageCount} 次</small></div>)}</div> : <div className="copy-empty-assets"><FileImage size={18} />请先去素材筛选台选择单图</div>}</div>

          <div className="copy-section"><label>标题{version ? ` · 版本 ${version}` : ''}</label><input className="copy-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="通过 Brief 并选图后生成" /></div>
          <div className="copy-section"><label>正文草稿</label><textarea className="copy-box multiline copy-textarea" value={draftBody} onChange={(event) => setDraftBody(event.target.value)} placeholder="文案会结合 Brief 的角度、情绪、Hook 和你选中的画面生成。" /></div>

          <div className="review-checks"><span><CheckCircle2 size={15} />只使用审核通过的 Brief</span><span><CheckCircle2 size={15} />拼图与待确认素材已拦截</span><span><MessageSquareText size={15} />允许复用，但展示历史次数</span></div>
          {message && <p className="draft-message">{message}</p>}
          <div className="editor-footer"><span>{version ? `${generationLabel || '草稿'} · v${version}` : '等待生成文案'}</span><button className="primary-button" disabled={!draftBody || publishing || selected?.status === 'published'} onClick={() => void confirmPublished()}>{selected?.status === 'published' ? <CheckCircle2 size={17} /> : <Send size={17} />}{selected?.status === 'published' ? '已记录发布' : publishing ? '正在保存…' : '标记已发布'}</button></div>
        </div>
      </section>
    </>
  )
}
