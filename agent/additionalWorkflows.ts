import type { SupabaseClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Type } from 'typebox'
import { createAgentSession, DefaultResourceLoader, defineTool, getAgentDir, ModelRuntime, SessionManager, type Skill } from '@earendil-works/pi-coding-agent'
import { runFailure } from './runOutcome.js'
import { errorText, missingPositions, RecoveryGate } from './captureRecovery.js'
import { redactReport } from '../src/lib/executionReport.js'

export type WorkflowRun = { id: string; user_id: string; account_id: string; run_type: string; target_type: string; target_id: string; input: Record<string, unknown> }
type EventWriter = (run: WorkflowRun, eventType: string, step: string, message: string, payload?: Record<string, unknown>) => Promise<void>

const text = (value: unknown, limit = 1200) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const strings = (value: unknown, limit = 10, itemLimit = 240) => Array.isArray(value) ? [...new Set(value.map((item) => text(item, itemLimit)).filter(Boolean))].slice(0, limit) : []
const appUrl = () => process.env.CREATOR_OPS_APP_URL ?? 'http://127.0.0.1:5173'

function structuredText(value: unknown, limit = 1200): string {
  if (typeof value === 'string') return value.trim().slice(0, limit)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, limit)
  if (Array.isArray(value)) return value.map((item) => structuredText(item, limit)).filter(Boolean).join('；').slice(0, limit)
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => {
    const detail = structuredText(item, limit)
    return detail ? `${key}：${detail}` : ''
  }).filter(Boolean).join('；').slice(0, limit)
  return ''
}

function structuredStrings(value: unknown, limit = 10, itemLimit = 1200) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  return values.map((item) => structuredText(item, itemLimit)).filter(Boolean).slice(0, limit)
}

async function saveRunOutput(db: SupabaseClient, runId: string, output: Record<string, unknown>) {
  const { error } = await db.from('agent_runs').update({ output }).eq('id', runId)
  if (error) throw error
}

function parseObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  for (const candidate of [value, fenced]) {
    if (!candidate) continue
    try { const parsed = JSON.parse(candidate); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown> } catch { /* try balanced object */ }
    const start = candidate.indexOf('{'); const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) try { return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown> } catch { /* invalid */ }
  }
  throw new Error('图片分析服务返回了无法识别的 JSON')
}

function skill(root: string, name: string): Skill {
  const filePath = resolve(root, `skills/${name}/SKILL.md`)
  return { name, description: `Creator Ops workflow: ${name}`, filePath, baseDir: dirname(filePath), sourceInfo: { path: filePath, source: 'local', scope: 'project', origin: 'top-level' }, disableModelInvocation: false }
}

async function runSession(root: string, run: WorkflowRun, skillNames: string[], tools: ReturnType<typeof defineTool>[], prompt: string, saved: () => boolean, verifiedRecovery = false) {
  const runtimePath = resolve(root, 'agent/RUNTIME.md')
  const [runtime, ...skillFiles] = await Promise.all([readFile(runtimePath, 'utf8'), ...skillNames.map((name) => readFile(resolve(root, `skills/${name}/SKILL.md`), 'utf8'))])
  const loader = new DefaultResourceLoader({ cwd: root, agentDir: getAgentDir(), noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    skillsOverride: () => ({ skills: skillNames.map((name) => skill(root, name)), diagnostics: [] }),
    agentsFilesOverride: () => ({ agentsFiles: [{ path: runtimePath, content: runtime }, ...skillFiles.map((content, i) => ({ path: resolve(root, `skills/${skillNames[i]}/SKILL.md`), content }))] }),
  })
  await loader.reload()
  const modelRuntime = await ModelRuntime.create()
  const [provider, ...modelParts] = (process.env.PI_RESEARCH_MODEL ?? 'openai-codex/gpt-5.6-terra').split('/')
  const model = modelRuntime.getModel(provider, modelParts.join('/'))
  if (!model) throw new Error('Pi 默认模型不可用')
  const { session } = await createAgentSession({ cwd: root, modelRuntime, model, thinkingLevel: 'medium', tools: tools.map((tool) => tool.name), customTools: tools, resourceLoader: loader, sessionManager: SessionManager.inMemory(root) })
  try {
    await session.prompt(`/skill:${skillNames[0]} ${prompt}`)
    const failure = verifiedRecovery && saved() ? undefined : runFailure(session.messages, saved(), 'Agent 工作流')
    if (failure) throw new Error(failure)
    return session.sessionId
  } finally { session.dispose() }
}

async function jsonPost(path: string, body: unknown) {
  const response = await fetch(`${appUrl()}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-creator-ops-bridge': '1' }, body: JSON.stringify(body), signal: AbortSignal.timeout(path.endsWith('xhs-note-capture') ? 420_000 : 180_000) })
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload) throw new Error(text(payload?.error) || `本地服务请求失败（${response.status}）`)
  return payload
}

async function profileWorkflow(root: string, db: SupabaseClient, run: WorkflowRun, event: EventWriter) {
  let comic: Record<string, any> | undefined; let official: Record<string, any> | undefined; let saved = false
  const get = defineTool({ name: 'get_comic_context', label: '读取漫画', description: 'Read the bound kept comic.', parameters: Type.Object({}), execute: async () => {
    const result = await db.from('comics').select('*').eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id).single(); if (result.error) throw result.error; const row = result.data; comic = row
    if (!['selected', 'following', 'paused', 'completed'].includes(row.status)) throw new Error('请先保留漫画再补全档案')
    await event(run, 'step_completed', 'context_loaded', `已读取《${row.title}》`); return { content: [{ type: 'text' as const, text: JSON.stringify(row) }], details: {} }
  } })
  const fetchOfficial = defineTool({ name: 'fetch_kuaikan_official', label: '读取快看官网', description: 'Fetch official profile and cover for the bound comic.', parameters: Type.Object({}), execute: async () => {
    if (!comic) throw new Error('必须先读取漫画'); official = await jsonPost('/api/opencli/kuaikan-profile', { title: comic.title, sourceUrl: comic.custom_fields?.content_profile?.officialSourceUrl || comic.source_url })
    await event(run, 'tool_completed', 'official_loaded', '已读取快看官方简介和封面'); const { cover, ...safe } = official; return { content: [{ type: 'text' as const, text: JSON.stringify({ ...safe, coverAvailable: Boolean(cover) }) }], details: {} }
  } })
  const save = defineTool({ name: 'save_comic_profile', label: '保存漫画档案', description: 'Save a profile derived only from the fetched official fields.', parameters: Type.Object({ setting: Type.String(), mainCharacters: Type.Array(Type.String()), relationshipSummary: Type.String(), coreConflicts: Type.Array(Type.String()), contentThemes: Type.Array(Type.String()), toneTags: Type.Array(Type.String()), spoilerBoundary: Type.String() }), execute: async (_id, params) => {
    if (!comic || !official) throw new Error('必须先读取漫画和官网资料')
    const profile = { officialSynopsis: text(official.officialSynopsis, 5000), officialSourceUrl: text(official.officialSourceUrl, 1000), setting: text(params.setting, 300), mainCharacters: strings(params.mainCharacters, 8, 60), relationshipSummary: text(params.relationshipSummary, 500), coreConflicts: strings(params.coreConflicts, 6, 120), contentThemes: strings(params.contentThemes, 6, 40), toneTags: strings(params.toneTags, 6, 24), spoilerBoundary: text(params.spoilerBoundary, 300), updatedAt: new Date().toISOString() }
    const cover = official.cover as { downloadUrl: string; filename: string; mimeType: string } | undefined
    let coverPath: string | undefined
    if (cover) { const response = await fetch(`${appUrl()}${cover.downloadUrl}`, { headers: { 'x-creator-ops-bridge': '1' } }); if (!response.ok) throw new Error('读取官方封面失败'); const bytes = await response.arrayBuffer(); coverPath = `${run.user_id}/${run.account_id}/comic-covers/${crypto.randomUUID()}-${cover.filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const upload = await db.storage.from('content-assets').upload(coverPath, bytes, { contentType: cover.mimeType, upsert: false }); if (upload.error) throw upload.error }
    const update = await db.from('comics').update({ custom_fields: { ...(comic.custom_fields ?? {}), content_profile: profile, ...(coverPath ? { cover_storage_path: coverPath } : {}) } }).eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id)
    if (update.error) { if (coverPath) await db.storage.from('content-assets').remove([coverPath]); throw update.error }
    await saveRunOutput(db, run.id, { comicId: run.target_id, officialSourceUrl: profile.officialSourceUrl, titleWarning: official.titleWarning ?? '' })
    saved = true; await event(run, 'tool_completed', 'profile_saved', '官方档案和封面已保存'); return { content: [{ type: 'text' as const, text: JSON.stringify({ saved: true, titleWarning: official.titleWarning ?? '' }) }], details: {} }
  } })
  return runSession(root, run, ['kuaikan-comic-profile-enrichment'], [get, fetchOfficial, save], '依次读取漫画、获取官方资料、仅据官方资料整理字段并保存。', () => saved)
}

export async function captureWorkflow(root: string, db: SupabaseClient, run: WorkflowRun, event: EventWriter, sessionRunner = runSession) {
  let reference: Record<string, any>; let comic: Record<string, any>
  let result: Record<string, any> | undefined
  let images: Array<Record<string, any>> = []
  let saved = false
  const gate = new RecoveryGate(async (entry) => {
    const finished = entry.phase === 'finished'
    await event(run, finished ? 'capture_tool_finished' : 'capture_tool_started', String(entry.stage),
      `${finished ? '完成' : '开始'}步骤 ${entry.stage}${finished ? entry.ok ? '：成功' : '：失败，' + entry.action : ''}`, redactReport(entry) as Record<string, unknown>)
  })
  const imageIds = new Map<number, string>()
  const analyses = new Map<number, Record<string, any>>()
  const paths = new Map<number, string>()
  const warnings: string[] = []
  const workerId = (await import('node:os')).hostname() + ':' + process.pid

  async function lease() {
    const renewed = await db.from('agent_runs').update({ lease_expires_at: new Date(Date.now() + 10 * 60_000).toISOString() })
      .eq('id', run.id).eq('worker_id', workerId).eq('status', 'running').select('id').maybeSingle()
    if (renewed.error) throw renewed.error
    if (!renewed.data) throw new Error('任务执行权限已失效，请停止')
  }
  async function progress(step: string, message: string) {
    try { await event(run, 'capture_progress', step, message) }
    catch (error) { const warning = '进度记录暂不可用：' + errorText(error); warnings.push(warning); console.warn(warning) }
  }
  async function assets() {
    const rows = await db.from('assets').select('id,source_position,storage_path').eq('user_id', run.user_id).eq('account_id', run.account_id).eq('source_reference_id', run.target_id)
    if (rows.error) throw rows.error
    return rows.data
  }
  async function context() {
    const ref = await db.from('references').select('*').eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id).single()
    if (ref.error) throw ref.error
    if (ref.data.review_status !== 'kept' || !ref.data.comic_id) throw new Error('笔记不再保留或未关联漫画')
    reference = ref.data
    const c = await db.from('comics').select('*').eq('id', reference.comic_id).eq('user_id', run.user_id).eq('account_id', run.account_id).single()
    if (c.error) throw c.error
    comic = c.data
  }
  const reply = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: {} })
  const execute = async (stage: string, action: () => Promise<unknown>) => reply(await gate.run(stage, async () => {
    await lease()
    return action()
  }))
  const observe = defineTool({ name: 'inspect_capture_state', label: '检查采集状态', description: '读取本次笔记和数据库已保存图片；失败后先检查，已保存位置不再分析。', parameters: Type.Object({}), execute: async () => execute('observe', async () => {
    await context()
    const rows = await assets()
    const expected = images.map(image => Number(image.position))
    return { title: reference.title, prepared: Boolean(result), expectedPositions: expected, savedPositions: rows.map(row => row.source_position),
      remainingPositions: missingPositions(expected, rows.map(row => Number(row.source_position))), warnings: warnings.splice(0), lastError: gate.lastError }
  }) })
  const prepare = defineTool({ name: 'prepare_note_capture', label: '读取笔记与图片', description: '每次任务仅采集一次来源笔记；成功后缓存媒体清单，重复调用不重复导航。导航拒绝、验证或采集超时必须停止。', parameters: Type.Object({}), execute: async () => execute('capture', async () => {
    if (result) return { imageCount: images.length, cached: true }
    await context()
    await progress('capturing_note', '正在读取笔记并下载素材')
    result = await jsonPost('/api/opencli/xhs-note-capture', { sourceUrl: reference.source_url })
    images = Array.isArray(result.images) ? result.images : []
    if (!images.length || images.some((image, index) => Number(image.position) !== index + 1)) throw new Error('图片清单为空或顺序不完整')
    await progress('capture_prepared', `已获取 ${images.length} 张图片，请检查已完成位置后逐张处理`)
    return { imageCount: images.length, positions: images.map(image => image.position) }
  }) })
  const processImage = defineTool({ name: 'process_capture_image', label: '处理指定图片', description: '处理清单中的一个位置，先查已入库记录。暂时性错误最多三次尝试，失败后先检查状态；已分析结果在本会话复用。', parameters: Type.Object({ position: Type.Integer({ minimum: 1 }) }), execute: async (_id, params) => execute('image:' + params.position, async () => {
    if (!result) throw new Error('请先准备笔记采集')
    await context()
    const position = params.position
    const image = images.find(image => Number(image.position) === position)
    if (!image) throw new Error('图片位置不属于本次清单')
    const existing = (await assets()).filter(row => Number(row.source_position) === position)
    if (existing.length > 1) throw new Error('该位置存在重复素材，需要人工核验')
    if (existing.length) return { position, saved: true, skipped: true, assetId: existing[0].id }
    await progress('analyzing_image', `正在处理第 ${position}/${images.length} 张图片`)
    const media = await fetch(`${appUrl()}${image.downloadUrl}`, { headers: { 'x-creator-ops-bridge': '1' }, signal: AbortSignal.timeout(60_000) })
    if (!media.ok) throw new Error(`读取图片失败 HTTP ${media.status}；临时媒体过期时请重新发起任务`)
    const bytes = Buffer.from(await media.arrayBuffer())
    if (!analyses.has(position)) {
      const vision = await jsonPost('/api/ai/vision', { system: '仅根据画面标注漫画素材，不猜测人物身份或剧情。', prompt: '返回 JSON：visualFormat(single/collage/uncertain/invalid)、contentType、tags、characters、classificationNote、confidence。', imageDataUrl: `data:${image.mimeType};base64,${bytes.toString('base64')}` })
      analyses.set(position, { analysis: parseObject(text(vision.content, 10000)), model: vision.model })
    }
    const cached = analyses.get(position)!
    const analysis = cached.analysis
    const vision = { model: cached.model }
    if (!imageIds.has(position)) imageIds.set(position, crypto.randomUUID())
    if (!paths.has(position)) paths.set(position, `${run.user_id}/${run.account_id}/${imageIds.get(position)}-${text(image.filename, 100).replace(/[^a-zA-Z0-9._-]/g, '-') || 'image'}`)
    const storagePath = paths.get(position)!
    await lease()
    const upload = await db.storage.from('content-assets').upload(storagePath, bytes, { contentType: text(image.mimeType, 80), upsert: true })
    if (upload.error) throw upload.error
    const format = ['single', 'collage', 'uncertain', 'invalid'].includes(text(analysis.visualFormat)) ? text(analysis.visualFormat) : 'uncertain'
    const insert = await db.from('assets').upsert({ id: imageIds.get(position), user_id: run.user_id, account_id: run.account_id, comic_id: reference.comic_id, source_reference_id: reference.id, source_position: position, storage_path: storagePath, original_name: text(image.filename, 200), mime_type: text(image.mimeType, 80), byte_size: bytes.byteLength, source_url: reference.source_url, source_type: 'xiaohongshu', tags: strings(analysis.tags, 5, 16), visual_format: format, review_status: format === 'invalid' ? 'rejected' : format === 'uncertain' ? 'pending' : 'available', classification_note: text(analysis.classificationNote, 64), classification_confidence: Number.isFinite(Number(analysis.confidence)) ? Math.max(0, Math.min(1, Number(analysis.confidence))) : null, content_type: ['cover','character','interaction','plot','dialogue','atmosphere','other'].includes(text(analysis.contentType)) ? text(analysis.contentType) : 'other', characters: strings(analysis.characters, 4, 24), custom_fields: { workName: comic.title, chapter: text(result!.title) || '来源笔记片段', copyrightStatus: 'reference_only', sourceNoteId: result!.noteId, sourceNoteTags: result!.hashtags ?? [], classificationModel: vision.model ?? null } }, { onConflict: 'id' })
    if (insert.error) throw insert.error
    // Do not delete uploaded bytes after an ambiguous write response: the row may exist.
    await progress('image_saved', `已保存第 ${position}/${images.length} 张图片`)
    return { position, saved: true, assetId: imageIds.get(position), warnings: warnings.splice(0) }
  }) })
  const finish = defineTool({ name: 'finalize_note_capture', label: '核验并完成采集', description: '重新检查全部图片位置已入库且没有重复，再保存正文和完成结果。缺图返回待处理位置，不得宣称成功。', parameters: Type.Object({}), execute: async () => execute('finalize', async () => {
    if (!result || !images.length) throw new Error('尚无采集清单')
    await context()
    const rows = await assets()
    const expected = images.map(image => Number(image.position))
    const positions = rows.map(row => Number(row.source_position))
    const remaining = missingPositions(expected, positions)
    if (remaining.length) return { completed: false, remainingPositions: remaining }
    if (expected.some(position => positions.filter(p => p === position).length !== 1)) throw new Error('素材位置重复，需要人工核验')
    const update = await db.from('references').update({ source_note_id: result.noteId, title: result.title || reference.title, author_name: result.author || reference.author_name, body_text: result.body ?? '', likes: result.likes ?? 0, collects: result.collects ?? 0, comments: result.comments ?? 0, hashtags: result.hashtags ?? [], image_count: images.length, detail_status: 'detailed', detail_error: '', detail_captured_at: new Date().toISOString() }).eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id)
    if (update.error) throw update.error
    await saveRunOutput(db, run.id, { referenceId: run.target_id, imageCount: images.length, savedPositions: expected, verified: true })
    saved = true
    await progress('capture_saved', `已核验并保存全部 ${images.length} 张素材`)
    return { completed: true, imageCount: images.length }
  }) })
  try {
    return await sessionRunner(root, run, ['xiaohongshu-comic-note-capture', 'xiaohongshu-comic-asset-ingestion'], [observe, prepare, processImage, finish],
      '先观察现状，再准备采集，按 remainingPositions 逐张执行并检查结果。失败时根据 retryable 决定观察后重试，禁止盲目重复。最后调用 finalize_note_capture 核验。结构化 ok:false 是待处理问题，不等于流程立即结束。不可恢复时说明已完成和剩余部分并停止。', () => saved, true)
  } catch (caught) {
    const message = gate.lastError || errorText(caught)
    await db.from('references').update({ detail_status: 'failed', detail_error: message.slice(0, 500) }).eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id)
    throw new Error(message)
  }
}
async function generatedWorkflow(root: string, db: SupabaseClient, run: WorkflowRun, event: EventWriter) {
  let context: Record<string, any> | undefined; let saved = false
  const get = defineTool({ name: 'get_generation_context', label: '读取生成上下文', description: 'Read validated evidence bound to this run.', parameters: Type.Object({}), execute: async () => {
    if (run.run_type === 'topic_synthesis') {
      const suppliedIds = Array.isArray(run.input.referenceIds) ? run.input.referenceIds : []
      const ids = strings(suppliedIds, 5, 50)
      if (ids.length < 1 || ids.length > 4 || ids.length !== suppliedIds.length) throw new Error('请选择 1–4 条不重复的参考笔记')
      const refs = await db.from('references').select('*').in('id', ids).eq('user_id', run.user_id).eq('account_id', run.account_id); if (refs.error) throw refs.error
      if (refs.data.length !== ids.length || refs.data.some((r) => r.review_status !== 'kept' || r.detail_status !== 'detailed' || !text(r.body_text, 10))) throw new Error('请选择 1–4 条当前账号下已保留且完成采集的参考笔记')
      const comicId = refs.data[0]?.comic_id
      if (!comicId || refs.data.some((r) => r.comic_id !== comicId)) throw new Error('参考笔记必须属于当前账号下的同一部漫画')
      const comic = await db.from('comics').select('*').eq('id', comicId).eq('user_id', run.user_id).eq('account_id', run.account_id).single(); if (comic.error) throw comic.error
      const assets = await db.from('assets').select('*').in('source_reference_id', ids).eq('user_id', run.user_id).eq('account_id', run.account_id).eq('comic_id', comicId); if (assets.error) throw assets.error
      for (const reference of refs.data) {
        const positions = new Set(assets.data.filter((asset) => asset.source_reference_id === reference.id).map((asset) => Number(asset.source_position)))
        if (!reference.image_count || Array.from({ length: reference.image_count }, (_, index) => index + 1).some((position) => !positions.has(position))) throw new Error(`《${reference.title}》的图片尚未完整采集`)
      }
      context = { requested: run.input, comic: comic.data, references: refs.data, assets: assets.data }
    } else {
      const topic = await db.from('topics').select('*').eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id).single(); if (topic.error) throw topic.error
      if (!topic.data.comic_id) throw new Error('选题尚未关联漫画')
      const comic = await db.from('comics').select('*').eq('id', topic.data.comic_id).eq('user_id', run.user_id).eq('account_id', run.account_id).single(); if (comic.error) throw comic.error

      if (run.run_type === 'brief_generation') {
        const links = await db.from('topic_references').select('reference_id,position,is_primary').eq('topic_id', run.target_id).order('position'); if (links.error) throw links.error
        const refIds = links.data.map((item) => item.reference_id)
        if (!refIds.length) throw new Error('Brief 至少需要一条已采集参考笔记')
        const refs = await db.from('references').select('*').in('id', refIds).eq('user_id', run.user_id).eq('account_id', run.account_id).eq('comic_id', topic.data.comic_id); if (refs.error) throw refs.error
        if (refs.data.length !== refIds.length || refs.data.some((reference) => reference.review_status !== 'kept' || reference.detail_status !== 'detailed' || !text(reference.body_text, 10))) throw new Error('Brief 只能使用已保留、完整采集且属于同一漫画的参考笔记')
        const assets = await db.from('assets').select('*').in('source_reference_id', refIds).eq('user_id', run.user_id).eq('account_id', run.account_id).eq('comic_id', topic.data.comic_id); if (assets.error) throw assets.error
        for (const reference of refs.data) {
          const positions = new Set(assets.data.filter((asset) => asset.source_reference_id === reference.id).map((asset) => Number(asset.source_position)))
          if (!reference.image_count || Array.from({ length: reference.image_count }, (_, index) => index + 1).some((position) => !positions.has(position))) throw new Error(`《${reference.title}》的图片尚未完整采集`)
        }
        context = {
          topic: topic.data,
          comic: comic.data,
          referenceLinks: links.data,
          references: refs.data,
          assets: assets.data.filter((asset) => !['rejected', 'archived'].includes(asset.review_status)),
        }
      } else {
        const assetLinks = await db.from('topic_assets').select('asset_id,position,is_cover').eq('topic_id', run.target_id).order('position'); if (assetLinks.error) throw assetLinks.error
        const assetIds = assetLinks.data.map((item) => item.asset_id)
        if (topic.data.status === 'published') throw new Error('已发布内容不可生成新草稿，请先从 Brief 页面创建新策划')
        if (topic.data.brief?.status !== 'approved' || !assetIds.length) throw new Error('草稿需要已通过 Brief 和至少一张已选素材')
        const assets = await db.from('assets').select('*').in('id', assetIds).eq('user_id', run.user_id).eq('account_id', run.account_id).eq('comic_id', topic.data.comic_id); if (assets.error) throw assets.error
        if (assets.data.length !== assetIds.length || assets.data.some((asset) => asset.review_status !== 'available' || !['single', 'collage'].includes(asset.visual_format))) throw new Error('草稿只能使用当前漫画已审核可用的单图或拼图素材')
        context = { topic: topic.data, comic: comic.data, references: [], assets: assetLinks.data.map((link) => ({ ...assets.data.find((asset) => asset.id === link.asset_id), position: link.position, isCover: link.is_cover })) }
      }
    }
    await event(run, 'step_completed', 'context_loaded', '生成证据已读取并校验'); return { content: [{ type: 'text' as const, text: JSON.stringify(context) }], details: {} }
  } })
  const save = defineTool({ name: 'save_generated_result', label: '保存生成结果', description: 'Persist the generated result for this run. Use fields required by the loaded Skill.', parameters: Type.Object({ result: Type.Record(Type.String(), Type.Unknown()) }), execute: async (_id, params) => {
    if (!context) throw new Error('必须先读取上下文'); const result = params.result as Record<string, unknown>
    if (run.run_type === 'topic_synthesis') {
      const refs = context.references as Record<string, any>[]; const comicId = refs[0]?.comic_id; if (!comicId || refs.some((r) => r.comic_id !== comicId)) throw new Error('参考笔记必须属于同一漫画')
      const title = text(result.title, 120) || text(run.input.title, 120)
      if (!title) throw new Error('选题缺少标题')
      const insert = await db.from('topics').insert({ user_id: run.user_id, account_id: run.account_id, comic_id: comicId, title, subtitle: text(result.subtitle, 240) || text(run.input.subtitle, 240), pillar: text(run.input.pillar, 80), status: 'idea', score: 60, tags: strings(result.tags, 8, 30), custom_fields: { synthesis: { angle: structuredText(result.angle, 600), evidenceReason: structuredText(result.evidenceReason, 1000) } } }).select('id').single(); if (insert.error) throw insert.error
      const ids = refs.map((r) => r.id); const links = await db.from('topic_references').insert(ids.map((id, position) => ({ topic_id: insert.data.id, reference_id: id, position, is_primary: position === 0, link_source: 'workflow' })))
      if (links.error) { await db.from('topics').delete().eq('id', insert.data.id); throw links.error }
      await saveRunOutput(db, run.id, { topicId: insert.data.id })
    } else if (run.run_type === 'brief_generation') {
      const c = context as any; const required = ['angle','coreEmotion','hook','audience','coverPlan','structure','assetGuidance','referenceInsights','pagePlan']; for (const field of required) if (!structuredText(result[field])) throw new Error(`Brief 缺少 ${field}`)
      const profile = c.comic.custom_fields?.content_profile
      if (!profile || typeof profile !== 'object') throw new Error('请先补全漫画官方档案，再生成 Brief')
      const brief = { status: 'candidate', generationMode: 'model', model: process.env.PI_RESEARCH_MODEL ?? 'openai-codex/gpt-5.6-terra', angle: structuredText(result.angle, 360), coreEmotion: structuredText(result.coreEmotion, 80), hook: structuredText(result.hook, 100), audience: structuredText(result.audience, 500), referenceInsights: structuredStrings(result.referenceInsights, 12, 1000), coverPlan: structuredText(result.coverPlan, 800), structure: structuredStrings(result.structure, 8, 1200), assetGuidance: structuredStrings(result.assetGuidance, 10, 1000), pagePlan: structuredStrings(result.pagePlan, 12, 1500), verificationNeeds: structuredStrings(result.verificationNeeds, 12, 1000), avoidances: structuredStrings(result.avoidances, 6, 1000), evidence: { comicId: c.comic.id, profile, referenceIds: c.references.map((r: any) => r.id), generatedAt: new Date().toISOString(), imageInputMode: 'analysis', images: c.assets.map((a: any) => ({ id: a.id, referenceId: a.source_reference_id, position: a.source_position, description: a.classification_note || '未知：尚无图片分析', tags: a.tags ?? [] })) } }
      let topicId = run.target_id
      if (c.topic.status === 'published') {
        const inserted = await db.from('topics').insert({ user_id: run.user_id, account_id: run.account_id, comic_id: c.topic.comic_id, title: `${c.topic.title} · 新策划`, subtitle: c.topic.subtitle, pillar: c.topic.pillar, score: c.topic.score, tags: c.topic.tags, status: 'research', brief, custom_fields: { ...(c.topic.custom_fields ?? {}), previousTopicId: c.topic.id } }).select('id').single(); if (inserted.error) throw inserted.error
        topicId = inserted.data.id
        const linkRows = c.referenceLinks.map((link: any) => ({ topic_id: topicId, reference_id: link.reference_id, position: link.position, is_primary: link.is_primary, link_source: 'workflow' }))
        const linked = await db.from('topic_references').insert(linkRows)
        if (linked.error) { await db.from('topics').delete().eq('id', topicId); throw linked.error }
      } else {
        const update = await db.from('topics').update({ brief, status: 'research' }).eq('id', run.target_id).eq('user_id', run.user_id).eq('account_id', run.account_id).neq('status', 'published').select('id').maybeSingle(); if (update.error) throw update.error
        if (!update.data) throw new Error('选题已发布，未覆盖历史内容；请重新触发以创建新策划')
      }
      await saveRunOutput(db, run.id, { topicId, brief })
    } else {
      const c = context as any; const title = text(result.title, 40); const body = text(result.body, 1500); if (!title || !body) throw new Error('草稿缺少标题或正文')
      const previous = await db.from('drafts').select('version').eq('topic_id', run.target_id).order('version', { ascending: false }).limit(1); if (previous.error) throw previous.error; const version = (previous.data[0]?.version ?? 0) + 1
      const draft = await db.from('drafts').insert({ user_id: run.user_id, account_id: run.account_id, topic_id: run.target_id, version, title, body, hashtags: strings(result.hashtags, 5, 30), generation_meta: { label: `Pi 生成 · ${process.env.PI_RESEARCH_MODEL ?? 'openai-codex/gpt-5.6-terra'}`, brief: c.topic.brief, assetIds: c.assets.map((a: any) => a.id), generatedAt: new Date().toISOString() }, review_status: 'draft' }).select('id').single(); if (draft.error) throw draft.error
      await saveRunOutput(db, run.id, { draftId: draft.data.id, version })
    }
    saved = true; await event(run, 'tool_completed', 'result_saved', '生成结果已保存，等待人工审核'); return { content: [{ type: 'text' as const, text: '{"saved":true}' }], details: {} }
  } })
  const config = run.run_type === 'topic_synthesis' ? ['comic-topic-synthesis', '根据证据生成一个候选选题并保存。'] : run.run_type === 'brief_generation' ? ['comic-brief-generation', '根据证据生成完整候选 Brief 并保存。result 使用 Skill 中的字段名。'] : ['comic-draft-generation', '根据已通过 Brief 和有序素材生成一版文案并保存。result 包含 title、body、hashtags。']
  return runSession(root, run, [config[0]], [get, save], config[1], () => saved)
}

export async function executeAdditionalWorkflow(root: string, db: SupabaseClient, run: WorkflowRun, event: EventWriter) {
  if (run.run_type === 'comic_profile_enrichment') return profileWorkflow(root, db, run, event)
  if (run.run_type === 'note_capture') return captureWorkflow(root, db, run, event)
  if (['topic_synthesis', 'brief_generation', 'draft_generation'].includes(run.run_type)) return generatedWorkflow(root, db, run, event)
  throw new Error(`不支持的 Agent run_type：${run.run_type}`)
}
