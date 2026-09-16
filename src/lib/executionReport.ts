export type ReportEvent = { id: number; created_at: string; event_type: string; step: string; message: string; payload?: Record<string, unknown> }
export type ReportRun = { id: string; status: string; run_type: string; created_at: string; started_at?: string; completed_at?: string; error_message?: string; output?: Record<string, unknown>; attempt_count?: number; worker_id?: string }

export type ExecutionReport = {
  version: number
  runId: string
  runType: string
  status: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  durationMs: number | null
  attemptCount: number
  error: string | null
  errorCategory: string | null
  output: Record<string, unknown>
  environment: { release: string | null; model: string | null; skills: string[]; workerId: string | null }
  recovery: { retryableFailures: number; stoppedFailures: number; recordedToolDurationMs: number }
  stepDurations: Array<{ step: string; startedAt: string; durationMs: number }>
  coverage: string
  timeline: ReportEvent[]
}

export function redactReport(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/https?:\/\/[^\s]+/g, '[链接已隐藏]').replace(/Bearer\s+\S+/gi, '[凭证已隐藏]').replace(/\b(?:sk-|sb_secret_)[\w-]+/g, '[凭证已隐藏]')
  if (Array.isArray(value)) return value.map(redactReport)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|password|secret|authorization|api.?key/i.test(key)).map(([key, item]) => [key, redactReport(item)]))
  return value
}

export function buildExecutionReport(run: ReportRun, events: ReportEvent[]) {
  const timeline = [...events].sort((a, b) => a.id - b.id)
  const runtime = timeline.find(event => event.event_type === 'run_started')?.payload ?? {}
  const failed = timeline.filter(event => event.payload?.ok === false)
  const terminalTime = run.completed_at ? Date.parse(run.completed_at) : null
  const stepDurations = timeline.map((event, index) => {
    const started = Date.parse(event.created_at)
    const next = timeline[index + 1]?.created_at ? Date.parse(timeline[index + 1].created_at) : terminalTime
    return { step: event.step, startedAt: event.created_at, durationMs: Number.isFinite(started) && next !== null && Number.isFinite(next) ? Math.max(0, next - started) : 0 }
  })
  return redactReport({ version: 2, runId: run.id, runType: run.run_type, status: run.status,
    createdAt: run.created_at, startedAt: run.started_at, completedAt: run.completed_at,
    durationMs: run.completed_at ? Math.max(0, Date.parse(run.completed_at) - Date.parse(run.started_at || run.created_at)) : null,
    attemptCount: run.attempt_count ?? 0,
    error: run.error_message || null, output: run.output || {},
    errorCategory: timeline.findLast(event => event.event_type === 'run_failed')?.payload?.category ?? null,
    environment: {
      release: typeof runtime.release === 'string' ? runtime.release : null,
      model: typeof runtime.model === 'string' ? runtime.model : null,
      skills: Array.isArray(runtime.skills) ? runtime.skills.filter((item): item is string => typeof item === 'string') : [],
      workerId: run.worker_id ?? (typeof runtime.workerId === 'string' ? runtime.workerId : null),
    },
    recovery: {
      retryableFailures: failed.filter(event => event.payload?.retryable === true).length,
      stoppedFailures: failed.filter(event => event.payload?.action === 'stop').length,
      recordedToolDurationMs: timeline.reduce((sum, event) => sum + (typeof event.payload?.durationMs === 'number' ? event.payload.durationMs : 0), 0),
    },
    stepDurations,
    coverage: timeline.some(e => e.event_type === 'capture_tool_finished') ? '包含采集工具审计；不包含模型隐藏推理' : '历史业务事件；未记录的工具细节无法补全',
    timeline,
  }) as ExecutionReport
}
