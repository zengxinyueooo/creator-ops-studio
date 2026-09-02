import { CalendarDays, Plus } from 'lucide-react'
import { useWorkspace } from '../store/WorkspaceContext'

export function CalendarPage() {
  const { activeAccount, state } = useWorkspace()
  const schedules = state.schedules.filter((item) => item.accountId === activeAccount.id)
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return (
    <>
      <section className="page-heading compact-heading"><div><span className="eyebrow">CONTENT CALENDAR</span><h1>内容日历</h1><p>把漫画固定更新时间转换成可执行的调研与发布任务。</p></div><button className="primary-button"><Plus size={17} />添加计划</button></section>
      <section className="calendar-grid">{days.map((day, index) => <div className={`calendar-day ${index === 4 ? 'today' : ''}`} key={day}><div><span>{day}</span><strong>{2 + index}</strong></div>{schedules.filter((_, itemIndex) => itemIndex % 7 === index).map((item) => <article className={`calendar-event ${item.kind}`} key={item.id}><CalendarDays size={15} /><strong>{item.title}</strong><small>{item.dateLabel}</small></article>)}</div>)}</section>
    </>
  )
}
