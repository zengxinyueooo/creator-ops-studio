import { CheckCircle2, Copy, FileText, MessageSquareText, PenLine, Sparkles } from 'lucide-react'
import { useWorkspace } from '../store/WorkspaceContext'

export function DraftsPage() {
  const { accountTopics } = useWorkspace()
  const selected = accountTopics.find((topic) => topic.status === 'review') ?? accountTopics[0]
  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">COPY DESK</span><h1>文案工作台</h1><p>提取参考结构，生成原创表达，最终由你定稿。</p></div><button className="primary-button"><Sparkles size={17} />生成新版本</button></section>
      <section className="draft-layout">
        <aside className="panel draft-list"><div className="panel-heading"><div><h2>待处理草稿</h2><p>{accountTopics.length} 个关联选题</p></div><FileText size={18} /></div>{accountTopics.slice(0, 4).map((topic) => <button key={topic.id} className={topic.id === selected?.id ? 'draft-item active' : 'draft-item'}><span>{topic.title.slice(0, 1)}</span><div><strong>{topic.title}</strong><small>{topic.updatedAt}</small></div></button>)}</aside>
        <div className="panel editor-panel"><div className="editor-heading"><div><span className="status-badge pink">待审核</span><h2>{selected?.title ?? '暂无选题'}</h2></div><div className="button-row"><button className="icon-button"><Copy size={16} /></button><button className="secondary-button"><PenLine size={16} />编辑</button></div></div><div className="copy-section"><label>标题 A · 情绪悬念型</label><div className="copy-box">看到这一页，我才明白她为什么一直不敢回头</div></div><div className="copy-section"><label>正文草稿</label><div className="copy-box multiline">本来以为这只是一次普通的告别。<br /><br />直到她在雨里说出那句话，前面所有看似冷漠的细节才突然连了起来。作者没有急着解释，而是把答案藏在人物一次次回避的眼神里。<br /><br />你们看到这里的时候，有猜到真正的原因吗？</div></div><div className="review-checks"><span><CheckCircle2 size={15} />没有直接复刻参考文案</span><span><CheckCircle2 size={15} />保留来源与素材记录</span><span><MessageSquareText size={15} />建议增加个人解读</span></div><div className="editor-footer"><span>草稿 v3 · AI生成后已人工修改</span><button className="primary-button"><CheckCircle2 size={17} />审核通过</button></div></div>
      </section>
    </>
  )
}
