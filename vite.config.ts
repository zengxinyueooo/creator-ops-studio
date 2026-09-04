import react from '@vitejs/plugin-react'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const execFileAsync = promisify(execFile)
const projectRoot = dirname(fileURLToPath(import.meta.url))
const NOTE_CARD_SELECTOR = 'section.note-item, section:has(a[href*="/search_result/"]), section:has(a[href*="/explore/"])'
const FILTER_OPTION_SELECTOR = '#app span'

type BrowserFindEntry = { ref?: number; text?: string; visible?: boolean; attrs?: Record<string, string> }
type BrowserFindResult = { matches_n?: number; entries?: BrowserFindEntry[]; error?: { message?: string } }
type RawNote = { title?: unknown; author?: unknown; likes?: unknown; url?: unknown }

function parseMetric(value: unknown) {
  const text = String(value ?? '0').trim().replace(/,/g, '')
  const number = Number.parseFloat(text)
  if (!Number.isFinite(number)) return 0
  if (text.includes('万')) return Math.round(number * 10_000)
  if (text.toLowerCase().includes('k')) return Math.round(number * 1_000)
  return Math.round(number)
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

async function findExactTextRef(session: string, selector: string, label: string) {
  const payload = parseJson<BrowserFindResult>(await runOpenCli([
    'browser', session, 'find', '--css', selector, '--limit', '500', '--text-max', '80', '--window', 'background',
  ]), `查找“${label}”时`)
  if (payload.error) throw new Error(payload.error.message || `未找到筛选项“${label}”`)
  const normalize = (value: unknown) => String(value ?? '').replace(/\s+/g, '').trim()
  const entry = payload.entries?.find((item) => item.visible !== false && normalize(item.text) === normalize(label))
  if (entry?.ref == null) throw new Error(`小红书页面中未找到筛选项“${label}”，已停止本次任务`)
  return String(entry.ref)
}

async function clickFreshTextTarget(session: string, selector: string, label: string) {
  const ref = await findExactTextRef(session, selector, label)
  const result = parseJson<{ clicked?: boolean; match_level?: string; error?: { message?: string } }>(await runOpenCli([
    'browser', session, 'click', ref, '--window', 'background',
  ]), `点击“${label}”时`)
  if (result.error || !result.clicked) throw new Error(result.error?.message || `筛选项“${label}”点击失败`)
  if (result.match_level === 'reidentified') throw new Error(`筛选项“${label}”在点击前发生变化，已停止本次任务`)
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

async function searchOneKeyword(session: string, keyword: string) {
  const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes`
  await runOpenCli(['browser', session, 'open', url, '--window', 'background'], 75_000)
  await inspectPageHealth(session)
  await runOpenCli(['browser', session, 'wait', 'selector', NOTE_CARD_SELECTOR, '--timeout', '15000', '--window', 'background'], 25_000)

  await clickFreshTextTarget(session, '#image', '图文')
  await runOpenCli(['browser', session, 'wait', 'time', '1', '--window', 'background'])
  await inspectPageHealth(session)
  await clickFreshTextTarget(session, '.filter span, .filter', '筛选')
  await runOpenCli(['browser', session, 'wait', 'text', '最多点赞', '--timeout', '8000', '--window', 'background'])
  for (const label of ['最多点赞', '一周内', '未看过']) {
    await clickFreshTextTarget(session, FILTER_OPTION_SELECTOR, label)
    await runOpenCli(['browser', session, 'wait', 'time', '1', '--window', 'background'])
    await inspectPageHealth(session)
  }
  await runOpenCli(['browser', session, 'wait', 'selector', NOTE_CARD_SELECTOR, '--timeout', '15000', '--window', 'background'], 25_000)
  const notes = parseJson<RawNote[]>(await runOpenCli(['browser', session, 'eval', EXTRACT_VISIBLE_NOTES_JS, '--window', 'background']), '读取搜索结果时')
  if (!Array.isArray(notes)) throw new Error('小红书搜索结果格式异常，已停止本次任务')
  return notes.map((note) => {
    const cleanUrl = sanitizeXhsUrl(note.url)
    return {
      rank: 0,
      noteId: cleanUrl.split('/').filter(Boolean).at(-1) ?? '',
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
  return JSON.parse(body) as { keywords?: unknown; requiredComicTitle?: unknown; limit?: unknown }
}

function localOpenCliPlugin() {
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
        const remoteAddress = req.socket.remoteAddress ?? ''
        const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)
        if (!isLoopback || req.headers['x-creator-ops-bridge'] !== '1') {
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

          const byUrl = new Map<string, Awaited<ReturnType<typeof searchOneKeyword>>[number]>()
          for (const keyword of keywords) {
            const notes = await searchOneKeyword(session, keyword)
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
    },
  }
}

export default defineConfig({
  plugins: [react(), localOpenCliPlugin()],
})
