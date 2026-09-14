export type ReportEvent = { id: number; created_at: string; event_type: string; step: string; message: string; payload?: Record<string, unknown> }
export type ReportRun = { id: string; status: string; run_type: string; created_at: string; started_at?: string; completed_at?: string; error_message?: string; output?: Record<string, unknown> }

export function redactReport(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/https?:\/\/[^\s]+/g, '[链接已隐藏]').replace(/Bearer\s+\S+/gi, '[凭证已隐藏]').replace(/\b(?:sk-|sb_secret_)[\w-]+/g, '[凭证已隐藏]')
  if (Array.isArray(value)) return value.map(redactReport)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|password|secret|authorization|api.?key/i.test(key)).map(([key, item]) => [key, redactReport(item)]))
  return value
}

export function buildExecutionReport(run: ReportRun, events: ReportEvent[]) {
  const timeline = [...events].sort((a, b) => a.id - b.id)
  return redactReport({ version: 1, runId: run.id, runType: run.run_type, status: run.status,
    createdAt: run.created_at, startedAt: run.started_at, completedAt: run.completed_at,
    durationMs: run.completed_at ? Math.max(0, Date.parse(run.completed_at) - Date.parse(run.started_at || run.created_at)) : null,
    error: run.error_message || null, output: run.output || {},
    coverage: timeline.some(e => e.event_type === 'capture_tool_finished') ? '包含采集工具审计；不包含模型隐藏推理' : '历史业务事件；未记录的工具细节无法补全',
    timeline,
  }) as { version: number; runId: string; runType: string; status: string; createdAt: string; startedAt?: string; completedAt?: string; durationMs: number | null; error: string | null; output: Record<string, unknown>; coverage: string; timeline: ReportEvent[] }
}
