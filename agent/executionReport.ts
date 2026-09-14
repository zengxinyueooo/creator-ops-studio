import type { SupabaseClient } from '@supabase/supabase-js'
import { buildExecutionReport, type ReportEvent } from '../src/lib/executionReport.js'

export async function saveExecutionReport(db: SupabaseClient, runId: string) {
  const { data: run, error } = await db.from('agent_runs').select('*').eq('id', runId).single()
  if (error) throw error
  const events: ReportEvent[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('agent_run_events').select('*').eq('run_id', runId).order('id').range(offset, offset + 499)
    if (result.error) throw result.error
    events.push(...result.data)
    if (result.data.length < 500) break
  }
  const report = buildExecutionReport(run, events)
  const result = await db.from('agent_run_reports').upsert({ run_id: run.id, user_id: run.user_id, report, generated_at: new Date().toISOString() })
  if (result.error) throw result.error
}
