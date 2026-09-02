import { FileImage, FolderPlus, Link2, Search, Upload } from 'lucide-react'
import { useWorkspace } from '../store/WorkspaceContext'

const samples = [
  ['雨夜告白 · 48话', '9 张图片', 'pink'],
  ['反派破绽 · 112话', '7 张图片', 'blue'],
  ['女主成长线', '8 张图片', 'purple'],
  ['结局循环 · 完结篇', '12 张图片', 'amber'],
]

export function AssetsPage() {
  const { activeAccount } = useWorkspace()
  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">ASSET LIBRARY</span><h1>素材库</h1><p>按作品、章节和片段整理；每份素材保留来源与使用记录。</p></div><div className="button-row"><button className="secondary-button"><FolderPlus size={16} />新建素材组</button><button className="primary-button"><Upload size={17} />上传素材</button></div></section>
      <div className="filter-bar"><div><Search size={16} /><span>搜索素材</span></div>{activeAccount.pillars.map((pillar) => <button key={pillar}>{pillar}</button>)}</div>
      <section className="asset-grid">{samples.map(([title, count, tone], index) => <article className="asset-card" key={title}><div className={`asset-cover ${tone}`}><span>{index + 48}</span><FileImage size={24} /></div><div className="asset-card-copy"><span className="status-badge gray">来源待核对</span><h3>{title}</h3><p>{count} · 最近更新 今天</p><div><span><Link2 size={13} />关联 {index + 1} 个选题</span></div></div></article>)}</section>
    </>
  )
}
