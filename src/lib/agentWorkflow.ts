import { supabase } from './supabase'
import type { AgentRun, AgentRunEvent, AgentRunStatus } from '../types'

export type AgentRunType = 'comic_profile_enrichment' | 'research_discovery' | 'note_capture' | 'topic_synthesis' | 'brief_generation' | 'draft_generation'
export type AgentTargetType = 'comic' | 'research_task' | 'reference' | 'reference_set' | 'topic'

function client() {
  if (!supabase) throw new Error('Agent Worker 仅在 Supabase 模式可用')
  return supabase
}

export async function enqueueAgentWorkflow(input: { runType: AgentRunType; targetType: AgentTargetType; targetId: string; accountId: string; payload?: Record<string, unknown> }) {
  const db = client()
  const { data: auth, error: authError } = await db.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('请先登录')
  const { data: active, error: activeError } = await db.from('agent_runs').select('id').eq('run_type', input.runType).eq('target_type', input.targetType).eq('target_id', input.targetId).in('status', ['queued', 'running']).limit(1).maybeSingle()
  if (activeError) throw activeError
  if (active) return active.id as string
  const row = {
    user_id: auth.user.id, account_id: input.accountId, run_type: input.runType,
    target_type: input.targetType, target_id: input.targetId, input: input.payload ?? {}, status: 'queued',
    ...(input.runType === 'research_discovery' ? { research_task_id: input.targetId } : {}),
  }
  const { data, error } = await db.from('agent_runs').insert(row).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function loadAgentRun(runId: string): Promise<AgentRun> {
  const db = client()
  const [{ data: run, error }, { data: events, error: eventError }] = await Promise.all([
    db.from('agent_runs').select('*').eq('id', runId).single(),
    db.from('agent_run_events').select('*').eq('run_id', runId).order('id', { ascending: false }).limit(50),
  ])
  if (error) throw error
  if (eventError) throw eventError
  return {
    id: run.id, researchTaskId: run.research_task_id ?? undefined, runType: run.run_type,
    targetType: run.target_type, targetId: run.target_id, status: run.status as AgentRunStatus,
    currentStep: run.current_step, output: run.output ?? {}, errorMessage: run.error_message ?? undefined,
    createdAt: run.created_at, events: (events ?? []).reverse().map((event): AgentRunEvent => ({ id: event.id, eventType: event.event_type, step: event.step, message: event.message, createdAt: event.created_at })),
  }
}

export async function waitForAgentRun(runId: string, onProgress?: (run: AgentRun) => void, timeoutMs = 10 * 60_000) {
  const deadline = Date.now() + timeoutMs
  let lastStatus: AgentRunStatus = 'queued'
  while (Date.now() < deadline) {
    const run = await loadAgentRun(runId)
    lastStatus = run.status
    onProgress?.(run)
    if (run.status === 'succeeded') return run
    if (run.status === 'failed' || run.status === 'cancelled') throw new Error(run.errorMessage || 'Agent 执行失败')
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
  throw new Error(lastStatus === 'queued'
    ? '任务尚未被后台领取，尚未开始采集。请检查本机 Worker 是否启动或正在忙碌；任务已保留，再次点击可继续查看同一任务。'
    : '等待执行结果超时，后台任务可能仍在运行。再次点击可继续查看同一任务，请勿重复创建。')
}

export function agentProgressMessage(run: AgentRun) {
  if (run.status === 'queued') return Date.now() - Date.parse(run.createdAt) > 30_000
    ? '仍在等待后台领取，尚未开始采集；本机 Worker 可能未启动、断连或正在处理其他任务。'
    : '任务已排队，等待后台领取，尚未开始采集。'
  if (run.status === 'failed' || run.status === 'cancelled') return run.errorMessage || '任务已停止，请重试'
  return run.events.at(-1)?.message || (run.status === 'succeeded' ? '采集完成' : '后台已领取，正在准备采集')
}

export async function runAgentWorkflow(input: Parameters<typeof enqueueAgentWorkflow>[0], onProgress?: (run: AgentRun) => void) {
  const runId = await enqueueAgentWorkflow(input)
  return waitForAgentRun(runId, onProgress)
}
