import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildExecutionReport, type ReportEvent, type ReportRun } from '../lib/executionReport'

export function ExecutionHistory({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false)
  const [runs, setRuns] = useState<ReportRun[]>([])
  const [selected, setSelected] = useState('')
  const [report, setReport] = useState<ReturnType<typeof buildExecutionReport> | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!open || !supabase) return
    let active = true
    void (async () => {
      setError('')
      setReport(null)
      const db = supabase!
      const result = await db.from('agent_runs').select('*').eq('target_id', targetId).eq('run_type', 'note_capture').order('created_at', { ascending: false }).limit(100)
      if (result.error) throw result.error
      if (!active) return
      setRuns(result.data)
      const run = result.data.find(r => r.id === selected) || result.data[0]
      if (!run) return
      // Build from current facts, so late events and interrupted runs remain visible.
      const events: ReportEvent[] = []
      for (let offset = 0; ; offset += 500) {
        const page = await db.from('agent_run_events').select('*').eq('run_id', run.id).order('id').range(offset, offset + 499)
        if (page.error) throw page.error
        events.push(...page.data)
        if (page.data.length < 500) break
      }
      if (active) setReport(buildExecutionReport(run, events))
    })().catch(e => { if (active) setError(e.message || '读取日志失败') })
    return () => { active = false }
  }, [open, targetId, selected, refresh])
  return <div style={{ gridColumn: '1 / -1', width: '100%' }}>
    <button type="button" className="secondary-button" onClick={() => setOpen(!open)}>{open ? '收起执行日志' : '查看执行日志'}</button>
    {open && <section aria-label="任务完整执行报告" style={{ padding: 16, border: '1px solid #ddd', borderRadius: 12, marginTop: 8, overflowWrap: 'anywhere' }}>
      <h4>任务执行报告</h4>
      <select aria-label="选择历史采集任务" value={selected || runs[0]?.id || ''} onChange={e => setSelected(e.target.value)}>{runs.map(r => <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString()} · {r.status}</option>)}</select>{' '}
      <button type="button" className="secondary-button" onClick={() => setRefresh(n => n + 1)}>刷新日志</button>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p>{runs.length ? '正在汇总…' : '暂无记录或正在读取…'}</p>}
      {report && <>
        <p>任务：{report.runId}<br />状态：{report.status} · 耗时：{report.durationMs === null ? '尚未结束' : `${Math.round(report.durationMs / 1000)} 秒`}</p>
        <p>{report.coverage}。当前视图按已保存事件汇总，未写入的事件无法展示。</p>
        {report.error && <p role="alert">{report.error}</p>}
        <ol>{report.timeline.map(e => <li key={e.id} style={{ marginBottom: 10 }}><time>{new Date(e.created_at).toLocaleTimeString()}</time> · {e.message}
          {e.payload && Object.keys(e.payload).length > 0 && <details><summary>步骤详情 / 耗时 / 恢复结果</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.payload, null, 2)}</pre></details>}
        </li>)}</ol>
        <details><summary>最终产物与核验结果</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(report.output, null, 2)}</pre></details>
        <button type="button" className="secondary-button" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
          const link = document.createElement('a'); link.href = url; link.download = `任务报告-${report.runId}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>导出完整报告 JSON</button>
      </>}
    </section>}
  </div>
}
