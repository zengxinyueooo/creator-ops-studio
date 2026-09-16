// Read-only baseline. No model calls, task submission, or database writes.
import { createClient } from '@supabase/supabase-js'
process.loadEnvFile('.env.local')
const db = createClient((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
async function all(table: string, columns: string, order: string) {
  const rows: Record<string, any>[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from(table).select(columns).order(order).range(offset, offset + 499)
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`)
    rows.push(...data as unknown as Record<string, any>[])
    if (data.length < 500) return rows
  }
}
// Read sequentially so an authentication failure does not abandon other HTTP
// handles while Node is shutting down on Windows.
const runs = await all('agent_runs', 'id,run_type,status,created_at,started_at,completed_at,error_message,target_id,attempt_count', 'id')
const events = await all('agent_run_events', 'id,run_id,event_type,payload', 'id')
const assets = await all('assets', 'id,source_reference_id,source_position', 'id')
const refs = await all('references', 'id,detail_status,image_count', 'id')
const topics = await all('topics', 'id,brief', 'id')
const reports = await all('agent_run_reports', 'run_id,report,generated_at', 'run_id')
const percentile = (values: number[], q: number) => values.length ? [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length*q)-1)] : null
const classify = (message: string) => /quota|余额|额度|usage limit/i.test(message) ? '额度限制' : /unknown option/i.test(message) ? '命令参数错误' : /Navigation rejected|SECURITY_BLOCK/i.test(message) ? '导航或访问拒绝' : /timeout|超时|ETIMEDOUT/i.test(message) ? '超时' : /fetch failed|ECONN|network/i.test(message) ? '网络错误' : '其他或未分类'
const byType = [...new Set(runs.map(r => r.run_type))].map(type => {
  const group = runs.filter(r => r.run_type === type)
  const succeeded = group.filter(r => r.status === 'succeeded')
  const failed = group.filter(r => r.status === 'failed')
  const durations = succeeded.filter(r => r.started_at && r.completed_at).map(r => (Date.parse(r.completed_at)-Date.parse(r.started_at))/1000).filter(n => Number.isFinite(n) && n >= 0)
  return { type, total: group.length, succeeded: succeeded.length, failed: failed.length, cancelled: group.filter(r=>r.status==='cancelled').length, unfinished: group.filter(r=>['queued','running'].includes(r.status)).length,
    successRateExcludingCancelled: succeeded.length+failed.length ? succeeded.length/(succeeded.length+failed.length) : null,
    successfulTimingSamples: durations.length, successfulMedianSeconds: percentile(durations,.5), successfulP95Seconds: percentile(durations,.95),
    failures: Object.fromEntries([...new Set(failed.map(r=>classify(r.error_message || '')))].map(reason=>[reason, failed.filter(r=>classify(r.error_message || '')===reason).length])) }
})
const retryRuns = [...new Set(events.filter(e=>e.event_type==='capture_tool_finished' && e.payload?.retryable===true).map(e=>e.run_id))]
const eventErrorCategory = new Map(events.filter(e=>e.event_type==='run_failed' && typeof e.payload?.category === 'string').map(e=>[e.run_id,e.payload.category]))
const reportByRun = new Map(reports.map(row=>[row.run_id,row.report]))
const releaseOf = (run: Record<string, any>) => reportByRun.get(run.id)?.environment?.release || '历史任务未记录版本'
const modelOf = (run: Record<string, any>) => reportByRun.get(run.id)?.environment?.model || '历史任务未记录模型'
const summarizeGroup = (group: Record<string, any>[]) => {
  const finished = group.filter(run=>['succeeded','failed'].includes(run.status))
  const succeeded = group.filter(run=>run.status==='succeeded')
  const durations = succeeded.filter(run=>run.started_at&&run.completed_at).map(run=>(Date.parse(run.completed_at)-Date.parse(run.started_at))/1000).filter(n=>Number.isFinite(n)&&n>=0)
  return { total: group.length, succeeded: succeeded.length, failed: group.filter(run=>run.status==='failed').length,
    completionRate: finished.length ? succeeded.length/finished.length : null,
    successfulMedianSeconds: percentile(durations,.5), successfulP95Seconds: percentile(durations,.95) }
}
const byRelease = [...new Set(runs.map(releaseOf))].map(release=>({ release, ...summarizeGroup(runs.filter(run=>releaseOf(run)===release)) }))
const byModel = [...new Set(runs.map(modelOf))].map(model=>({ model, ...summarizeGroup(runs.filter(run=>modelOf(run)===model)) }))
const failureCategories = Object.fromEntries([...new Set(runs.filter(run=>run.status==='failed').map(run=>eventErrorCategory.get(run.id)||classify(run.error_message||'')))].map(category=>[category,runs.filter(run=>run.status==='failed'&&(eventErrorCategory.get(run.id)||classify(run.error_message||''))===category).length]))
const grouped = new Map<string, number>()
for (const a of assets) if (a.source_reference_id && a.source_position != null) { const key = `${a.source_reference_id}:${a.source_position}`; grouped.set(key,(grouped.get(key)||0)+1) }
const detailed = refs.filter(r=>r.detail_status==='detailed')
const complete = detailed.filter(r=> r.image_count>0 && Array.from({length:r.image_count},(_,i)=>grouped.get(`${r.id}:${i+1}`)===1).every(Boolean))
const briefs = topics.filter(t=>t.brief && t.brief.status)
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), range: runs.length ? [runs.map(r=>r.created_at).sort()[0],runs.map(r=>r.created_at).sort().at(-1)] : [], byType, byRelease, byModel, failureCategories,
  execution: { totalAttempts: runs.reduce((sum,run)=>sum+Number(run.attempt_count||0),0), runsClaimedMoreThanOnce: runs.filter(run=>Number(run.attempt_count)>1).length, versionedRuns: runs.filter(run=>releaseOf(run)!=='历史任务未记录版本').length },
  recovery: { recordedRetryableRuns: retryRuns.length, endedSucceeded: runs.filter(r=>retryRuns.includes(r.id)&&r.status==='succeeded').length },
  integrity: { detailedReferences: detailed.length, exactExpectedPositionsPresent: complete.length, sourcePositionRows: assets.filter(a=>a.source_reference_id && a.source_position!=null).length, duplicateExcessRows: [...grouped.values()].reduce((n,c)=>n+Math.max(0,c-1),0) },
  briefSnapshot: { total: briefs.length, approved: briefs.filter(t=>t.brief.status==='approved').length, candidate: briefs.filter(t=>t.brief.status==='candidate').length, rejected: briefs.filter(t=>t.brief.status==='rejected').length },
  caveats: ['全库开发期样本，非生产成功率；只有新报告带可靠版本标签，历史任务不能用于版本前后比较', '成功耗时不含排队及失败任务；首次成功率尚未计算', '完整性仅查位置，不验证文件可读性或跨笔记图片重复', 'Brief 当前状态不是首次审核通过率；零恢复样本不代表恢复率100%'] },null,2))
