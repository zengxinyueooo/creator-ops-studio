import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../store/WorkspaceContext'
import type { ScheduleItem } from '../types'

const KIND_OPTIONS: Array<{ value: ScheduleItem['kind']; label: string }> = [
  { value: 'update', label: '固定更新' },
  { value: 'publish', label: '发布' },
  { value: 'review', label: '复盘' },
]

export function CalendarPage() {
  const { activeAccount, state, addSchedule, deleteSchedule } = useWorkspace()
  const schedules = state.schedules.filter((item) => item.accountId === activeAccount.id)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ScheduleItem['kind']>('publish')
  const [dateLabel, setDateLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      await addSchedule({ title: title.trim(), kind, dateLabel: dateLabel.trim() || '待定' })
      setTitle('')
      setDateLabel('')
      setShowForm(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '日程保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(scheduleId: string) {
    setError('')
    try {
      await deleteSchedule(scheduleId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '日程删除失败')
    }
  }

  return (
    <>
      <section className="page-heading compact-heading">
        <div><span className="eyebrow">CONTENT CALENDAR</span><h1>内容日历</h1><p>把漫画固定更新时间转换成可执行的调研与发布任务。</p></div>
        <button className="primary-button" type="button" onClick={() => setShowForm((current) => !current)}><Plus size={17} />添加计划</button>
      </section>

      {showForm && <form className="panel calendar-create-form" onSubmit={submit}>
        <input placeholder="计划名称，例如：角色观察发布" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} required aria-label="计划名称" />
        <select value={kind} onChange={(event) => setKind(event.target.value as ScheduleItem['kind'])} aria-label="计划类型">
          {KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input placeholder="时间，例如：周五 20:00" value={dateLabel} onChange={(event) => setDateLabel(event.target.value)} maxLength={30} aria-label="计划时间" />
        <div className="button-row"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>取消</button><button type="submit" className="primary-button" disabled={saving}>{saving ? '保存中…' : '添加'}</button></div>
      </form>}
      {!showForm && error && <p className="research-error">{error}</p>}

      <section className="calendar-grid">
        {days.map((day, index) => (
          <div className={`calendar-day ${index === 4 ? 'today' : ''}`} key={day}>
            <div><span>{day}</span><strong>{2 + index}</strong></div>
            {schedules.filter((_, itemIndex) => itemIndex % 7 === index).map((item) => (
              <article className={`calendar-event ${item.kind}`} key={item.id}>
                <CalendarDays size={15} />
                <strong>{item.title}</strong>
                <small>{item.dateLabel}</small>
                <button type="button" className="event-remove" aria-label={`删除${item.title}`} title="删除这条计划" onClick={() => void remove(item.id)}><Trash2 size={12} /></button>
              </article>
            ))}
          </div>
        ))}
      </section>
    </>
  )
}
