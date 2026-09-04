import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const execFileAsync = promisify(execFile)
const projectRoot = dirname(fileURLToPath(import.meta.url))
const NOTE_CARD_SELECTOR = 'section.note-item, section:has(a[href*="/search_result/"]), section:has(a[href*="/explore/"])'
const FILTER_TRIGGER_SELECTOR = '#app .filter'
const FILTER_OPTION_SELECTOR = '#app .filter-panel .tags'

type BrowserFindEntry = { ref?: number; text?: string; visible?: boolean; attrs?: Record<string, string> }
type BrowserFindResult = { matches_n?: number; entries?: BrowserFindEntry[]; error?: { message?: string } }
type RawNote = { title?: unknown; author?: unknown; likes?: unknown; url?: unknown }
type DownloadedImage = { filename: string; path: string; mimeType: string; byteSize: number }
type CaptureFile = DownloadedImage & { expiresAt: number }

function parseMetric(value: unknown) {
  const text = String(value ?? '0').trim().replace(/,/g, '')
  const number = Number.parseFloat(text)
  if (!Number.isFinite(number)) return 0
  if (text.includes('万')) return Math.round(number * 10_000)
  if (text.toLowerCase().includes('k')) return Math.round(number * 1_000)
  return Math.round(number)
}

function parseTags(value: unknown) {
  if (typeof value !== 'string') return []
  return [...new Set(value.split(/[，,]/).map((item) => item.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 20)
}

function extensionForMime(mimeType: string) {
  return mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : mimeType === 'image/gif' ? '.gif' : '.jpg'
}

function detectImageMime(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a')) return 'image/gif'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return ''
}

function sourceNoteIdFromUrl(sourceUrl: string) {
  return sourceUrl.match(/\/(?:search_result|explore|note)\/([0-9a-f]{24})(?=[?#/]|$)/i)?.[1] ?? ''
}

function sanitizeXhsUrl(value: unknown) {
  try {
    const url = new URL(String(value))
    if (!['www.xiaohongshu.com', 'xiaohongshu.com'].includes(url.hostname)) return ''
    const accessParams = new URLSearchParams()
    for (const name of ['xsec_token', 'xsec_source']) {
      const parameter = url.searchParams.get(name)
      if (parameter) accessParams.set(name, parameter)
    }
    url.search = accessParams.toString()
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function noteIdToDate(url: string) {
  const match = url.match(/\/(?:search_result|explore|note)\/([0-9a-f]{24})(?=[?#/]|$)/i)
  if (!match) return null
  const seconds = Number.parseInt(match[1].slice(0, 8), 16)
  if (!seconds || seconds < 1_000_000_000 || seconds > 4_000_000_000) return null
  return new Date((seconds + 8 * 3600) * 1000).toISOString().slice(0, 10)
}

function findOpenCliNode() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10)
  if (major >= 20) return process.execPath
  const candidates = [
    process.env.OPENCLI_NODE_BINARY,
    process.env.USERPROFILE ? resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe') : undefined,
  ].filter((value): value is string => Boolean(value))
  const candidate = candidates.find(existsSync)
  if (candidate) return candidate
  throw new Error('OpenCLI 需要 Node.js 20 或更高版本；请升级 Node，或设置 OPENCLI_NODE_BINARY')
}

async function runOpenCli(args: string[], timeout = 60_000) {
  const cliEntry = resolve(projectRoot, 'node_modules/@jackwener/opencli/dist/src/main.js')
  const { stdout } = await execFileAsync(findOpenCliNode(), [cliEntry, ...args], {
    cwd: projectRoot,
    timeout,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  })
  return stdout.trim()
}

function parseJson<T>(value: string, context: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    throw new Error(`${context}返回了无法识别的数据`)
  }
}

async function findExactTextRef(session: string, selector: string, label: string, windowMode: 'background' | 'foreground' = 'background') {
  const payload = parseJson<BrowserFindResult>(await runOpenCli([
    'browser', session, 'find', '--css', selector, '--limit', '500', '--text-max', '80', '--window', windowMode,
  ]), `查找“${label}”时`)
  if (payload.error) throw new Error(payload.error.message || `未找到筛选项“${label}”`)
  const normalize = (value: unknown) => String(value ?? '').replace(/\s+/g, '').trim()
  const entry = payload.entries?.find((item) => item.visible !== false && normalize(item.text) === normalize(label))
  if (entry?.ref == null) throw new Error(`小红书页面中未找到筛选项“${label}”，已停止本次任务`)
  return String(entry.ref)
}

async function clickFreshTextTarget(session: string, selector: string, label: string, windowMode: 'background' | 'foreground' = 'background') {
  const ref = await findExactTextRef(session, selector, label, windowMode)
  const result = parseJson<{ clicked?: boolean; match_level?: string; error?: { message?: string } }>(await runOpenCli([
    'browser', session, 'click', ref, '--window', windowMode,
  ]), `点击“${label}”时`)
  if (result.error || !result.clicked) throw new Error(result.error?.message || `筛选项“${label}”点击失败`)
  if (result.match_level === 'reidentified') throw new Error(`筛选项“${label}”在点击前发生变化，已停止本次任务`)
}

async function readFilterState(session: string) {
  const raw = await runOpenCli(['browser', session, 'eval', String.raw`(() => ({
    open: Boolean(document.querySelector('#app .filter-panel .tags')),
    active: [...document.querySelectorAll('#app .filter-panel .tags.active')]
      .map((item) => (item.textContent || '').replace(/\s+/g, '').trim())
  }))()`, '--window', 'foreground'])
  return parseJson<{ open?: boolean; active?: string[] }>(raw, '检查筛选状态时')
}

async function ensureFilterOption(session: string, label: string) {
  const before = await readFilterState(session)
  if (!before.open) throw new Error('小红书筛选面板未正常打开，已停止本次任务')
  if (before.active?.includes(label)) return
  await clickFreshTextTarget(session, FILTER_OPTION_SELECTOR, label, 'foreground')
  await runOpenCli(['browser', session, 'wait', 'time', '2', '--window', 'foreground'])
  await inspectPageHealth(session)
  const after = await readFilterState(session)
  if (!after.active?.includes(label)) throw new Error(`筛选项“${label}”未生效，已停止本次任务`)
}

const EXTRACT_VISIBLE_NOTES_JS = String.raw`(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const normalizeUrl = (href) => {
    if (!href) return '';
    try { return new URL(href, location.origin).href; } catch { return ''; }
  };
  const cards = document.querySelectorAll('section.note-item').length
    ? [...document.querySelectorAll('section.note-item')]
    : [...new Set([...document.querySelectorAll('a[href*="/search_result/"], a[href*="/explore/"]')].map((link) => link.closest('section')).filter(Boolean))];
  const seen = new Set();
  const results = [];
  const viewportHeight = innerHeight || screen.availHeight || 900;
  for (const card of cards) {
    if (card.classList && card.classList.contains('query-note-item')) continue;
    const rect = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= viewportHeight || style.display === 'none' || style.visibility === 'hidden') continue;
    const link = card.querySelector('a.cover.mask, a[href*="/search_result/"], a[href*="/explore/"], a[href*="/note/"]');
    const url = normalizeUrl(link && link.getAttribute('href'));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const titleElement = card.querySelector('.title, .note-title, a.title, .footer .title span');
    const nameElement = card.querySelector('a.author .name, .author-name, .nick-name, .name');
    const likesElement = card.querySelector('.count, .like-count, .like-wrapper .count');
    let title = clean(titleElement && titleElement.textContent);
    if (!title) title = clean(link && link.querySelector('span') && link.querySelector('span').textContent);
    const author = clean(nameElement && nameElement.textContent);
    if (title) results.push({ title, author, likes: clean(likesElement && likesElement.textContent) || '0', url });
  }
  return results;
})()`

async function inspectPageHealth(session: string) {
  const raw = await runOpenCli(['browser', session, 'eval', `(() => ({ loginWall: /登录后查看搜索结果/.test(document.body?.innerText || ''), verification: /验证码|安全验证|访问异常|操作频繁/.test(document.body?.innerText || '') }))()`, '--window', 'background'])
  const state = parseJson<{ loginWall?: boolean; verification?: boolean }>(raw, '检查小红书页面时')
  if (state.loginWall) throw new Error('小红书登录状态已失效，请在 Chrome 中登录后再试')
  if (state.verification) throw new Error('小红书页面出现安全验证或访问异常，已停止本次任务')
}

async function waitForSearchResults(session: string) {
  try {
    await runOpenCli(['browser', session, 'wait', 'selector', NOTE_CARD_SELECTOR, '--timeout', '15000', '--window', 'background'], 25_000)
    return true
  } catch (caught) {
    const raw = await runOpenCli(['browser', session, 'eval', String.raw`(() => ({
      noResults: /没找到相关内容|换个词试试吧/.test(document.body?.innerText || ''),
      resultCards: document.querySelectorAll('section.note-item, section:has(a[href*="/search_result/"]), section:has(a[href*="/explore/"])').length,
    }))()`, '--window', 'background'])
    const state = parseJson<{ noResults?: boolean; resultCards?: number }>(raw, '检查搜索结果时')
    if (state.noResults || state.resultCards === 0) return false
    throw caught
  }
}

async function searchOneKeyword(session: string, keyword: string, publishedWithin: 'all' | 'week') {
  const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes`
  await runOpenCli(['browser', session, 'open', url, '--window', 'background'], 75_000)
  await inspectPageHealth(session)
  if (!await waitForSearchResults(session)) return []

  await clickFreshTextTarget(session, '#image', '图文')
  await runOpenCli(['browser', session, 'wait', 'time', '1', '--window', 'background'])
  await inspectPageHealth(session)
  const filterState = await readFilterState(session)
  if (!filterState.open) {
    await clickFreshTextTarget(session, FILTER_TRIGGER_SELECTOR, '筛选', 'foreground')
    await runOpenCli(['browser', session, 'wait', 'selector', FILTER_OPTION_SELECTOR, '--timeout', '15000', '--window', 'foreground'], 25_000)
  }
  for (const label of ['最多点赞', ...(publishedWithin === 'week' ? ['一周内'] : []), '未看过']) {
    await ensureFilterOption(session, label)
  }
  if (!await waitForSearchResults(session)) return []
  const notes = parseJson<RawNote[]>(await runOpenCli(['browser', session, 'eval', EXTRACT_VISIBLE_NOTES_JS, '--window', 'background']), '读取搜索结果时')
  if (!Array.isArray(notes)) throw new Error('小红书搜索结果格式异常，已停止本次任务')
  return notes.map((note) => {
    const cleanUrl = sanitizeXhsUrl(note.url)
    return {
      rank: 0,
      noteId: sourceNoteIdFromUrl(cleanUrl),
      title: String(note.title ?? '无标题'),
      author: String(note.author ?? '未知作者') || '未知作者',
      likes: parseMetric(note.likes),
      publishedAt: noteIdToDate(cleanUrl),
      url: cleanUrl,
      matchedKeyword: keyword,
    }
  }).filter((note) => note.url)
}

async function readJsonBody(req: IncomingMessage) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 8_192) throw new Error('请求内容过大')
  }
  return JSON.parse(body) as { keywords?: unknown; requiredComicTitle?: unknown; limit?: unknown; publishedWithin?: unknown }
}

async function readDownloadedImages(outputRoot: string) {
  const directories = await readdir(outputRoot, { withFileTypes: true })
  const candidates = await Promise.all(directories.flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const directory = resolve(outputRoot, entry.name)
    return [readdir(directory, { withFileTypes: true }).then((items) => items
      .filter((item) => item.isFile())
      .map((item) => resolve(directory, item.name)))]
  }))
  const files = candidates.flat()
  const images: DownloadedImage[] = []
  for (const path of files) {
    const sample = await readFile(path)
    const mimeType = detectImageMime(sample.subarray(0, 16))
    if (!mimeType) continue
    const fileStat = await stat(path)
    const filename = path.split(/[\\/]/).at(-1) ?? `image-${images.length + 1}${extensionForMime(mimeType)}`
    const normalizedName = `${filename.replace(/\.[^.]+$/, '')}${extensionForMime(mimeType)}`
    images.push({ filename: normalizedName, path, mimeType, byteSize: fileStat.size })
  }
  return images.sort((left, right) => left.filename.localeCompare(right.filename, undefined, { numeric: true }))
}

function isLocalBridgeRequest(req: IncomingMessage) {
  const remoteAddress = req.socket.remoteAddress ?? ''
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress) && req.headers['x-creator-ops-bridge'] === '1'
}

function localOpenCliPlugin() {
  const captures = new Map<string, Map<string, CaptureFile>>()
  return {
    name: 'local-opencli-xhs-bridge',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use('/api/opencli/xhs-search', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: '只允许 POST 请求' }))
          return
        }
        if (!isLocalBridgeRequest(req)) {
          res.statusCode = 403
          res.end(JSON.stringify({ error: '仅允许 Creator Ops 本地页面调用' }))
          return
        }

        const session = `creator-ops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        try {
          const input = await readJsonBody(req)
          const keywords = Array.isArray(input.keywords)
            ? [...new Set(input.keywords.map((item) => String(item).trim()).filter(Boolean))]
            : []
          if (keywords.length < 2 || keywords.length > 3) throw new Error('每个批次需要 2–3 个不重复关键词')
          if (keywords.some((keyword) => keyword.length < 2 || keyword.length > 80)) throw new Error('每个关键词长度需要在 2–80 个字符之间')
          const requiredComicTitle = String(input.requiredComicTitle ?? '').trim()
          if (!requiredComicTitle || requiredComicTitle.length > 80) throw new Error('缺少有效的漫画名')
          if (keywords.some((keyword) => !keyword.includes(requiredComicTitle))) throw new Error(`每个关键词都必须包含漫画名“${requiredComicTitle}”`)
          const limit = Math.min(10, Math.max(1, Number.parseInt(String(input.limit ?? 10), 10) || 10))
          const publishedWithin = input.publishedWithin === 'all' ? 'all' : 'week'

          const byUrl = new Map<string, Awaited<ReturnType<typeof searchOneKeyword>>[number]>()
          for (const keyword of keywords) {
            const notes = await searchOneKeyword(session, keyword, publishedWithin)
            for (const note of notes) {
              const identity = note.noteId || note.url
              const existing = byUrl.get(identity)
              if (!existing || note.likes > existing.likes) byUrl.set(identity, note)
            }
          }
          const results = [...byUrl.values()]
            .sort((a, b) => b.likes - a.likes)
            .slice(0, limit)
            .map((note, index) => ({ ...note, rank: index + 1 }))

          res.statusCode = 200
          res.end(JSON.stringify({ results }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'OpenCLI 查询失败'
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        } finally {
          void runOpenCli(['browser', session, 'close', '--window', 'background'], 15_000).catch(() => undefined)
        }
      })

      server.middlewares.use('/api/opencli/xhs-note-capture', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: '只允许 POST 请求' }))
          return
        }
        if (!isLocalBridgeRequest(req)) {
          res.statusCode = 403
          res.end(JSON.stringify({ error: '仅允许 Creator Ops 本地页面调用' }))
          return
        }
        try {
          const input = await readJsonBody(req)
          const sourceUrl = sanitizeXhsUrl((input as { sourceUrl?: unknown }).sourceUrl)
          if (!sourceUrl || !sourceUrl.includes('xsec_token=')) throw new Error('笔记链接缺少有效访问参数，请重新从调研结果导入')
          const noteId = sourceNoteIdFromUrl(sourceUrl)
          if (!noteId) throw new Error('无法从笔记链接识别笔记 ID，已停止本次采集')

          const rawDetail = await runOpenCli(['xiaohongshu', 'note', sourceUrl, '-f', 'json', '--window', 'background'], 90_000)
          const detailRows = parseJson<Array<{ field?: unknown; value?: unknown }>>(rawDetail, '读取笔记详情时')
          const field = (name: string) => String(detailRows.find((row) => row.field === name)?.value ?? '').trim()
          const captureToken = randomUUID()
          const outputRoot = resolve(projectRoot, '.tmp', 'asset-ingestion', captureToken)
          await runOpenCli(['xiaohongshu', 'download', sourceUrl, '--output', outputRoot, '-f', 'json', '--window', 'background'], 240_000)
          const downloadedImages = await readDownloadedImages(outputRoot)
          if (!downloadedImages.length) throw new Error('该笔记未下载到可识别的图片，已停止写入素材库')

          const expiresAt = Date.now() + 30 * 60 * 1000
          const files = new Map<string, CaptureFile>()
          for (const image of downloadedImages) files.set(image.filename, { ...image, expiresAt })
          captures.set(captureToken, files)
          for (const [token, stored] of captures) {
            if ([...stored.values()].every((file) => file.expiresAt <= Date.now())) captures.delete(token)
          }

          res.statusCode = 200
          res.end(JSON.stringify({
            noteId,
            title: field('title'),
            author: field('author'),
            body: field('content'),
            likes: parseMetric(field('likes')),
            collects: parseMetric(field('collects')),
            comments: parseMetric(field('comments')),
            hashtags: parseTags(field('tags')),
            imageCount: downloadedImages.length,
            images: downloadedImages.map((image, index) => ({
              filename: image.filename,
              mimeType: image.mimeType,
              byteSize: image.byteSize,
              position: index + 1,
              downloadUrl: `/api/opencli/xhs-media/${captureToken}/${encodeURIComponent(image.filename)}`,
            })),
          }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'OpenCLI 笔记采集失败'
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      })

      server.middlewares.use('/api/opencli/xhs-media', async (req, res) => {
        if (req.method !== 'GET' || !isLocalBridgeRequest(req)) {
          res.statusCode = req.method === 'GET' ? 403 : 405
          res.end()
          return
        }
        const parts = (req.url ?? '').split('?')[0].split('/').filter(Boolean)
        const [captureToken, filename] = parts
        const file = captureToken && filename ? captures.get(captureToken)?.get(decodeURIComponent(filename)) : undefined
        if (!file || file.expiresAt <= Date.now()) {
          res.statusCode = 404
          res.end()
          return
        }
        try {
          const bytes = await readFile(file.path)
          res.setHeader('Content-Type', file.mimeType)
          res.setHeader('Content-Length', bytes.byteLength)
          res.setHeader('Cache-Control', 'no-store')
          res.statusCode = 200
          res.end(bytes)
        } catch {
          res.statusCode = 404
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localOpenCliPlugin()],
})
