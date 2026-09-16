import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Type } from 'typebox'
import { readSearchResponse, runFailure } from './runOutcome.js'
import { executeAdditionalWorkflow } from './additionalWorkflows.js'
import { claimWithRecovery } from './queuePolling.js'
import { saveExecutionReport } from './executionReport.js'
import { finishOwnedRun, RunLease } from './runLease.js'
import { classifyRunError } from './runErrors.js'
import { retryTransientRead } from './retryPolicy.js'
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  type Skill,
} from '@earendil-works/pi-coding-agent'

type Json = Record<string, unknown>
type AgentRun = {
  id: string
  user_id: string
  account_id: string
  research_task_id?: string
  run_type: string
  target_type: string
  target_id: string
  input: Json
}
type SearchResult = {
  rank: number
  noteId: string
  title: string
  author: string
  likes: number
  publishedAt: string | null
  url: string
  matchedKeyword?: string
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const once = process.argv.includes('--once')
const pollMs = Math.max(1000, Number(process.env.AGENT_WORKER_POLL_MS ?? 2500))
const workerId = `${hostname()}:${process.pid}`
const modelRef = () => process.env.PI_RESEARCH_MODEL ?? 'openai-codex/gpt-5.6-terra'
const release = () => process.env.CREATOR_OPS_RELEASE ?? '0.1.0+local'

const workflowSkills: Record<string, string[]> = {
  comic_profile_enrichment: ['kuaikan-comic-profile-enrichment'],
  research_discovery: ['xiaohongshu-comic-reference-discovery'],
  note_capture: ['xiaohongshu-comic-note-capture', 'xiaohongshu-comic-asset-ingestion'],
  topic_synthesis: ['comic-topic-synthesis'],
  brief_generation: ['comic-brief-generation'],
  draft_generation: ['comic-draft-generation'],
}

function loadLocalEnv() {
  try { process.loadEnvFile(resolve(root, '.env.local')) } catch { /* optional */ }
  process.env.HTTP_PROXY ||= 'http://127.0.0.1:7897'
  process.env.HTTPS_PROXY ||= process.env.HTTP_PROXY
  process.env.NO_PROXY ||= 'localhost,127.0.0.1'
  process.env.NODE_USE_ENV_PROXY ||= '1'
}

function required(name: string, fallbackName?: string) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '')
  if (!value) throw new Error(`缺少 Worker 环境变量 ${name}`)
  return value
}

async function addEvent(db: SupabaseClient, run: AgentRun, lease: RunLease, eventType: string, step: string, message: string, payload: Json = {}) {
  await lease.renew(step)
  const { error } = await db.from('agent_run_events').insert({ run_id: run.id, user_id: run.user_id, event_type: eventType, step, message, payload })
  if (error) throw error
}

async function executeResearchRun(db: SupabaseClient, run: AgentRun, lease: RunLease) {
  if (!run.research_task_id) throw new Error('调研执行缺少 research_task_id')
  const skillPath = resolve(root, 'skills/xiaohongshu-comic-reference-discovery/SKILL.md')
  const runtimePath = resolve(root, 'agent/RUNTIME.md')
  const researchRuntimePath = resolve(root, 'agent/runtimes/research.md')
  const [runtimeRules, researchRuntimeRules] = await Promise.all([readFile(runtimePath, 'utf8'), readFile(researchRuntimePath, 'utf8')])
  const skill: Skill = { name: 'xiaohongshu-comic-reference-discovery', description: 'Stage bounded Xiaohongshu comic reference candidates for human review.', filePath: skillPath, baseDir: dirname(skillPath), sourceInfo: { path: skillPath, source: 'local', scope: 'project', origin: 'top-level' }, disableModelInvocation: false }
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    skillsOverride: () => ({ skills: [skill], diagnostics: [] }),
    agentsFilesOverride: () => ({ agentsFiles: [
      { path: runtimePath, content: runtimeRules },
      { path: researchRuntimePath, content: researchRuntimeRules },
    ] }),
  })
  await loader.reload()

  let context: Json | undefined
  let searched: SearchResult[] = []
  let searchCompleted = false
  let saved = false
  const getContext = defineTool({
    name: 'get_research_context', label: '读取调研上下文', description: 'Read the database context bound to this run.',
    parameters: Type.Object({}),
    execute: async () => {
      const { data: task, error: taskError } = await db.from('research_tasks').select('*').eq('id', run.research_task_id).eq('user_id', run.user_id).single()
      if (taskError) throw taskError
      const [{ data: comic, error: comicError }, { data: existing, error: existingError }] = await Promise.all([
        db.from('comics').select('id,title,status,custom_fields').eq('id', task.comic_id).eq('user_id', run.user_id).single(),
        db.from('references').select('source_note_id,source_url').eq('user_id', run.user_id).eq('comic_id', task.comic_id),
      ])
      if (comicError) throw comicError
      if (existingError) throw existingError
      context = { task: { id: task.id, keywords: task.keywords, purpose: task.purpose, limit: task.result_limit, filters: task.filter_config }, comic: { id: comic.id, title: comic.title, status: comic.status, serializationStatus: comic.custom_fields?.serialization_status ?? 'unknown' }, existingReferences: existing ?? [] }
      await addEvent(db, run, lease, 'step_completed', 'context_loaded', `已读取《${comic.title}》调研上下文`)
      return { content: [{ type: 'text' as const, text: JSON.stringify(context) }], details: {} }
    },
  })
  const search = defineTool({
    name: 'search_xiaohongshu', label: '搜索小红书', description: 'Run the local read-only OpenCLI first-screen search using the task keywords.',
    parameters: Type.Object({ keywords: Type.Array(Type.String(), { minItems: 2, maxItems: 3 }), requiredComicTitle: Type.String(), limit: Type.Integer({ minimum: 1, maximum: 10 }), publishedWithin: Type.Union([Type.Literal('all'), Type.Literal('week')]) }),
    execute: async (_id, params) => {
      if (!context) throw new Error('必须先调用 get_research_context')
      await addEvent(db, run, lease, 'tool_started', 'searching', `正在用 ${params.keywords.length} 个关键词读取首屏结果`, { keywords: params.keywords })
      const base = process.env.CREATOR_OPS_APP_URL ?? 'http://127.0.0.1:5173'
      const body = await retryTransientRead(async () => {
        const response = await fetch(`${base}/api/opencli/xhs-search`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-creator-ops-bridge': '1' }, body: JSON.stringify(params), signal: AbortSignal.timeout(180_000) })
        return readSearchResponse(response) as Promise<{ results: SearchResult[] }>
      })
      const existing = new Set(((context.existingReferences as Array<{ source_note_id?: string; source_url?: string }>) ?? []).flatMap((item) => [item.source_note_id, item.source_url].filter(Boolean) as string[]))
      searched = (body.results ?? []).filter((item) => !existing.has(item.noteId) && !existing.has(item.url)).slice(0, params.limit).map((item, index) => ({ ...item, rank: index + 1 }))
      searchCompleted = true
      await addEvent(db, run, lease, 'tool_completed', 'search_complete', `搜索完成，去重后得到 ${searched.length} 条候选`)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ results: searched }) }], details: {} }
    },
  })
  const save = defineTool({
    name: 'save_research_candidates', label: '保存调研候选', description: 'Select candidates by their rank numbers from search_xiaohongshu. Original URLs are preserved by the host. Save for human review only.',
    parameters: Type.Object({ ranks: Type.Array(Type.Integer({ minimum: 1, maximum: 10 }), { uniqueItems: true }), summary: Type.String({ maxLength: 240 }) }),
    execute: async (_id, params) => {
      if (!searchCompleted) throw new Error('必须先完成搜索才能保存候选')
      const allowed = new Set(params.ranks)
      if (params.ranks.some((rank) => !searched.some((item) => item.rank === rank))) throw new Error('包含不属于本次搜索结果的编号')
      await addEvent(db, run, lease, 'tool_started', 'saving_results', '正在保存调研候选')
      const results = searched.filter((item) => allowed.has(item.rank)).map((item, index) => ({ ...item, rank: index + 1 }))
      const now = new Date().toISOString()
      const { error } = await db.from('research_tasks').update({ result_snapshot: results, last_run_at: now }).eq('id', run.research_task_id).eq('user_id', run.user_id)
      if (error) throw error
      const { error: outputError } = await db.from('agent_runs').update({ output: { results, summary: params.summary } }).eq('id', run.id)
      if (outputError) throw outputError
      saved = true
      await addEvent(db, run, lease, 'tool_completed', 'results_staged', `已保存 ${results.length} 条候选，等待人工勾选导入`)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ saved: results.length, humanGate: 'required' }) }], details: {} }
    },
  })

  const modelRuntime = await ModelRuntime.create()
  const configuredModel = modelRef()
  const [provider, ...idParts] = configuredModel.split('/')
  const model = modelRuntime.getModel(provider, idParts.join('/'))
  if (!model) throw new Error(`Pi 模型不可用：${configuredModel}`)
  const { session } = await createAgentSession({ cwd: root, modelRuntime, model, thinkingLevel: 'medium', tools: ['get_research_context', 'search_xiaohongshu', 'save_research_candidates'], customTools: [getContext, search, save], resourceLoader: loader, sessionManager: SessionManager.inMemory(root) })
  session.subscribe((event) => {
    if (event.type === 'tool_execution_start') void addEvent(db, run, lease, 'pi_tool_started', 'agent_working', `Pi 调用 ${event.toolName}`).catch(console.error)
  })
  try {
    await session.prompt('/skill:xiaohongshu-comic-reference-discovery 执行当前绑定的调研任务。必须依次读取上下文、搜索并保存候选；不要请求用户输入。')
    const failure = runFailure(session.messages, saved)
    if (failure) throw new Error(failure)
    return session.sessionId
  } finally { session.dispose() }
}

async function main() {
  loadLocalEnv()
  const db = createClient(required('SUPABASE_URL', 'VITE_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  console.log(`[agent-worker] ${workerId} listening`)
  do {
    const data = await claimWithRecovery(() => db.rpc('claim_next_agent_run', { p_worker_id: workerId }), {
      once,
      sleep: (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms)),
      onRetry: (ms) => console.error(`[agent-worker] 队列连接失败，${ms / 1000} 秒后重连；尚未领取的任务保留在队列中`),
    })
    const run = (data?.[0] ?? null) as AgentRun | null
    if (!run) { if (!once) await new Promise((resolveDelay) => setTimeout(resolveDelay, pollMs)); continue }
    const lease = new RunLease(db, run.id, workerId)
    lease.start()
    let piSessionId: string | undefined
    try {
      await addEvent(db, run, lease, 'run_started', 'starting', '本机 Worker 已领取任务，正在启动 Pi', { workerId, release: release(), model: modelRef(), skills: workflowSkills[run.run_type] ?? [] })
      piSessionId = run.run_type === 'research_discovery'
        ? await executeResearchRun(db, run, lease)
        : await executeAdditionalWorkflow(root, db, run as Parameters<typeof executeAdditionalWorkflow>[2], (eventRun, eventType, step, message, payload) => addEvent(db, eventRun as AgentRun, lease, eventType, step, message, payload))
      lease.assertOwned()
      const completedMessage = run.run_type === 'research_discovery'
        ? '调研完成，候选结果等待人工审核'
        : 'Agent 工作流完成，结果等待人工审核'
      await addEvent(db, run, lease, 'run_completed', 'completed', completedMessage)
      await finishOwnedRun(db, { runId: run.id, workerId, status: 'succeeded', piSessionId })
    } catch (caught) {
      const failure = classifyRunError(caught)
      await addEvent(db, run, lease, 'run_failed', 'failed', failure.message, { category: failure.category, retryable: failure.retryable }).catch(console.error)
      await finishOwnedRun(db, { runId: run.id, workerId, status: 'failed', errorMessage: failure.message, piSessionId }).catch((finishError) => {
        console.error(`[agent-worker] run ${run.id} 失败状态未写入:`, finishError)
      })
      console.error(`[agent-worker] run ${run.id} failed [${failure.category}]:`, failure.original)
    } finally {
      lease.stop()
      await saveExecutionReport(db, run.id).catch(() => console.warn(`[agent-worker] run ${run.id} 报告未保存，可重新生成；业务状态不变`))
    }
  } while (!once)
}

main().catch((error) => { console.error('[agent-worker] fatal:', error); process.exitCode = 1 })
