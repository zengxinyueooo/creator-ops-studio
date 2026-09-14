import { afterEach, expect, it, vi } from 'vitest'
import { captureWorkflow } from './additionalWorkflows.js'

afterEach(() => vi.unstubAllGlobals())

it('observes a committed-but-failed response, skips it before vision, and verifies remaining images despite event failure', async () => {
  const rows: any[] = []
  let ambiguous = true
  let visionCalls = 0
  let completed = false
  const db: any = {
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from(table: string) {
      let op = 'select'; let values: any
      const query: any = {
        select: () => query, eq: () => query, maybeSingle: () => query, single: () => query,
        update: (v: any) => { op = 'update'; values = v; return query },
        upsert: (v: any) => { op = 'upsert'; values = v; return query },
        then(resolve: any) {
          let data: any = null; let error: any = null
          if (table === 'agent_runs') data = { id: 'run' }
          if (table === 'references') {
            data = { id: 'ref', comic_id: 'comic', review_status: 'kept', title: '笔记', source_url: 'https://example.com' }
            if (op === 'update' && values.detail_status === 'detailed') completed = true
          }
          if (table === 'comics') data = { id: 'comic', title: '漫画' }
          if (table === 'assets') {
            if (op === 'upsert') {
              rows.push(values)
              if (ambiguous) { ambiguous = false; error = { code: 'ECONNRESET', message: 'fetch failed after commit' } }
            } else data = rows
          }
          return Promise.resolve({ data, error }).then(resolve)
        },
      }
      return query
    },
  }
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('xhs-note-capture')) return Response.json({ noteId: 'note', title: '笔记', body: '正文', images: [1, 2].map(position => ({ position, downloadUrl: '/image/' + position, mimeType: 'image/png', filename: position + '.png' })) })
    if (url.endsWith('/vision')) { visionCalls++; return Response.json({ content: JSON.stringify({ visualFormat: 'single', tags: ['甜'], confidence: 0.9 }) }) }
    return new Response(new Uint8Array([1, 2, 3]))
  })
  const runner: any = async (_root: any, _run: any, _skills: any, tools: any[], _prompt: any, saved: () => boolean) => {
    const call = async (name: string, args = {}) => JSON.parse((await tools.find(t => t.name === name).execute('call', args)).content[0].text)
    expect((await call('inspect_capture_state')).ok).toBe(true)
    await call('prepare_note_capture')
    const partial = await call('finalize_note_capture')
    expect(partial.result).toMatchObject({ completed: false, remainingPositions: [1, 2] })
    expect(await call('process_capture_image', { position: 1 })).toMatchObject({ ok: false, retryable: true })
    expect((await call('inspect_capture_state')).result.remainingPositions).toEqual([2])
    expect((await call('process_capture_image', { position: 1 })).result.skipped).toBe(true)
    expect((await call('process_capture_image', { position: 2 })).ok).toBe(true)
    expect((await call('finalize_note_capture')).result.completed).toBe(true)
    expect(saved()).toBe(true)
    return 'test-session'
  }
  await captureWorkflow(process.cwd(), db, { id: 'run', user_id: 'user', account_id: 'account', run_type: 'note_capture', target_type: 'reference', target_id: 'ref', input: {} }, async () => { throw { message: 'progress unavailable' } }, runner)
  expect(visionCalls).toBe(2)
  expect(rows).toHaveLength(2)
  expect(completed).toBe(true)
})
