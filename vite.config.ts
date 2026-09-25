import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const execFileAsync = promisify(execFile)
const projectRoot = dirname(fileURLToPath(import.meta.url))
const NOTE_CARD_SELECTOR = 'section.note-item, section:has(a[href*="/search_result/"]), section:has(a[href*="/explore/"])'

type RawNote = { title?: unknown; author?: unknown; likes?: unknown; url?: unknown }
type DownloadedImage = { filename: string; path: string; mimeType: string; byteSize: number }
type CaptureFile = DownloadedImage & { expiresAt: number }
type LocalAiInput = { system?: unknown; prompt?: unknown; maxTokens?: unknown; temperature?: unknown }
type LocalVisionInput = LocalAiInput & { imageDataUrl?: unknown; formatRetry?: unknown }
type KuaikanCoverCapture = { bytes: Buffer; filename: string; mimeType: string; expiresAt: number }

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

function sanitizeKuaikanTopicUrl(value: unknown) {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'https:' || url.hostname !== 'www.kuaikanmanhua.com' || !/^\/web\/topic\/\d+\/?$/.test(url.pathname)) return ''
    return `https://www.kuaikanmanhua.com${url.pathname.replace(/\/$/, '')}`
  } catch {
    return ''
  }
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, digits: string) => {
      const codePoint = Number.parseInt(digits, 16)
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match
    })
    .replace(/&#(\d+);/g, (match, digits: string) => {
      const codePoint = Number.parseInt(digits, 10)
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
}

function htmlAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  return match ? decodeHtml(match[2]).trim() : ''
}

function htmlText(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalizeComicTitle(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/漫画$/u, '').replace(/[\s·•・:：,，。.!！?？—_\-《》【】()[\]（）]/g, '')
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

async function fetchKuaikanHtml(url: string, context: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'User-Agent': 'Mozilla/5.0 CreatorOpsStudio/1.0',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${context}失败（${response.status}）`)
  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10)
  if (contentLength > 4 * 1024 * 1024) throw new Error(`${context}返回内容过大`)
  const html = await response.text()
  if (!html || html.length > 4 * 1024 * 1024) throw new Error(`${context}返回内容异常`)
  return html
}

async function resolveKuaikanTopicUrl(title: string, sourceUrl: unknown) {
  const supplied = sanitizeKuaikanTopicUrl(sourceUrl)
  if (supplied) return supplied

  const searchHtml = await fetchKuaikanHtml(`https://www.kuaikanmanhua.com/sou/${encodeURIComponent(title)}`, '搜索快看漫画')
  const candidates = [...searchHtml.matchAll(/<a\b[^>]*>/gi)].flatMap((match) => {
    const href = htmlAttribute(match[0], 'href')
    const candidateTitle = htmlAttribute(match[0], 'title')
    const topicUrl = sanitizeKuaikanTopicUrl(href.startsWith('/') ? `https://www.kuaikanmanhua.com${href}` : href)
    return topicUrl && candidateTitle ? [{ title: candidateTitle, url: topicUrl }] : []
  })
  const unique = [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()]
  if (!unique.length) throw new Error(`快看官网没有找到“${title}”的作品页，请先填写官方链接`)

  const normalizedTarget = normalizeComicTitle(title)
  const ranked = unique.map((candidate) => ({
    ...candidate,
    distance: editDistance(normalizedTarget, normalizeComicTitle(candidate.title)),
  })).sort((left, right) => left.distance - right.distance)
  const closest = ranked[0]
  const allowedDistance = normalizedTarget.length <= 8 ? 1 : Math.max(1, Math.floor(normalizedTarget.length * 0.2))
  if (!closest || closest.distance > allowedDistance) throw new Error(`快看官网没有找到与“${title}”匹配的作品页，请先填写官方链接`)
  return closest.url
}

function metaContent(html: string, key: string) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    if ([htmlAttribute(tag, 'name'), htmlAttribute(tag, 'property')].some((value) => value.toLowerCase() === key.toLowerCase())) return htmlAttribute(tag, 'content')
  }
  return ''
}

function parseKuaikanTopic(html: string, officialSourceUrl: string) {
  const headingMatch = html.match(/<h3\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)
  const metaTitle = metaContent(html, 'og:title').replace(/漫画[｜|].*$/u, '').trim()
  const canonicalTitle = htmlText(headingMatch?.[1] ?? '') || metaTitle
  if (!canonicalTitle) throw new Error('快看作品页缺少可识别的官方标题')

  const rawDescription = metaContent(html, 'description')
  const prefix = `${canonicalTitle}简介：`
  const synopsis = (rawDescription.startsWith(prefix) ? rawDescription.slice(prefix.length) : rawDescription)
    .replace(/[【[][^】\]]*(?:责编|更新|独家|授权|完结)[^】\]]*[】\]]\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!synopsis) throw new Error('快看作品页缺少可用的官方简介')

  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
  const coverUrl = imageTags.map((tag) => ({
    src: htmlAttribute(tag, 'src'),
    alt: htmlAttribute(tag, 'alt'),
    className: htmlAttribute(tag, 'class'),
  })).find((image) => image.className.split(/\s+/).includes('img') && normalizeComicTitle(image.alt) === normalizeComicTitle(canonicalTitle))?.src ?? ''
  if (!coverUrl) throw new Error('快看作品页缺少可下载的官方横版封面')

  const headerEnd = html.indexOf('conversionData')
  const headerHtml = headerEnd > 0 ? html.slice(0, headerEnd) : html.slice(0, 30_000)
  const tags = [...headerHtml.matchAll(/<span\b[^>]*class=["'][^"']*\btab\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => htmlText(match[1]))
    .filter(Boolean)
    .slice(0, 12)
  const author = htmlText(headerHtml.match(/<div\b[^>]*class=["'][^"']*\bnickname\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  return { canonicalTitle, officialSynopsis: synopsis, officialSourceUrl, coverUrl, tags: [...new Set(tags)], author }
}

async function downloadKuaikanCover(coverUrl: string, canonicalTitle: string): Promise<KuaikanCoverCapture> {
  const url = new URL(coverUrl)
  const allowedHost = url.hostname === 'kuaikanmanhua.com' || url.hostname.endsWith('.kuaikanmanhua.com') || url.hostname === 'v3mh.com' || url.hostname.endsWith('.v3mh.com')
  if (url.protocol !== 'https:' || !allowedHost) throw new Error('快看作品页返回了不受信任的封面地址')
  const response = await fetch(url, {
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*', Referer: 'https://www.kuaikanmanhua.com/' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`下载快看官方封面失败（${response.status}）`)
  const declaredSize = Number.parseInt(response.headers.get('content-length') ?? '0', 10)
  if (declaredSize > 5 * 1024 * 1024) throw new Error('快看官方封面超过 5MB，已停止下载')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('快看官方封面超过 5MB，已停止下载')
  const mimeType = detectImageMime(bytes.subarray(0, 16))
  if (!mimeType) throw new Error('快看官方封面不是可识别的图片')
  const safeTitle = [...canonicalTitle]
    .filter((character) => character.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(character))
    .join('')
    .trim() || 'kuaikan-cover'
  return { bytes, filename: `${safeTitle}${extensionForMime(mimeType)}`, mimeType, expiresAt: Date.now() + 30 * 60 * 1000 }
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
    env: { ...process.env, OPENCLI_BROWSER_COMMAND_TIMEOUT: String(Math.max(1, Math.floor((timeout - 15_000) / 1000))) },
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
    const links = [...card.querySelectorAll('a[href*="/search_result/"], a[href*="/explore/"], a[href*="/note/"]')];
    const link = links.find((item) => (item.getAttribute('href') || '').includes('xsec_token='))
      || links.find((item) => (item.getAttribute('href') || '').includes('/search_result/'))
      || links[0];
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
  // XHS currently exposes the image-post tab as a stable URL parameter. This avoids
  // repeatedly opening the fragile visual filter drawer in an automated browser.
  const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&type=51`
  await runOpenCli(['browser', session, 'open', url, '--window', 'background'], 75_000)
  await inspectPageHealth(session)
  if (!await waitForSearchResults(session)) return []

  const notes = parseJson<RawNote[]>(await runOpenCli(['browser', session, 'eval', EXTRACT_VISIBLE_NOTES_JS, '--window', 'background']), '读取搜索结果时')
  if (!Array.isArray(notes)) throw new Error('小红书搜索结果格式异常，已停止本次任务')
  const normalized = notes.map((note) => {
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
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return normalized
    .filter((note) => publishedWithin === 'all' || (note.publishedAt !== null && new Date(`${note.publishedAt}T00:00:00+08:00`).getTime() >= sevenDaysAgo))
    .sort((a, b) => b.likes - a.likes)
}

async function readJsonBody(req: IncomingMessage) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 8_192) throw new Error('请求内容过大')
  }
  return JSON.parse(body) as { keywords?: unknown; requiredComicTitle?: unknown; limit?: unknown; publishedWithin?: unknown }
}

type XhsDraftInput = { title?: unknown; body?: unknown; hashtags?: unknown; images?: unknown }

async function readXhsDraftBody(req: IncomingMessage): Promise<XhsDraftInput> {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 24_000) throw new Error('暂存请求过大')
  }
  return JSON.parse(body) as XhsDraftInput
}

async function stageXhsImages(images: unknown, root: string, supabaseOrigin: string) {
  if (!Array.isArray(images) || images.length < 1 || images.length > 9) throw new Error('请选择 1–9 张图片')
  const paths: string[] = []
  for (const [index, raw] of images.entries()) {
    if (typeof raw !== 'string') throw new Error('图片地址无效')
    const url = new URL(raw)
    if (url.origin !== supabaseOrigin || !url.pathname.includes('/storage/v1/object/sign/content-assets/')) throw new Error('仅可使用当前素材库的签名图片')
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`第 ${index + 1} 张图片读取失败，请刷新页面后重试`)
    const declaredSize = Number(response.headers.get('content-length') ?? 0)
    if (declaredSize > 15 * 1024 * 1024) throw new Error(`第 ${index + 1} 张图片超过 15MB`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 15 * 1024 * 1024) throw new Error(`第 ${index + 1} 张图片超过 15MB`)
    const mime = detectImageMime(bytes.subarray(0, 16))
    if (!mime) throw new Error(`第 ${index + 1} 张不是可用图片`)
    const path = resolve(root, `${index + 1}${extensionForMime(mime)}`)
    await writeFile(path, bytes)
    paths.push(path)
  }
  return paths
}

async function readAiJsonBody(req: IncomingMessage) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 32_768) throw new Error('AI 请求内容过大')
  }
  return JSON.parse(body) as LocalAiInput
}

async function readVisionJsonBody(req: IncomingMessage) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 24 * 1024 * 1024) throw new Error('图片分析请求过大，请使用不超过 15MB 的图片')
  }
  return JSON.parse(body) as LocalVisionInput
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

function localOpenCliPlugin(env: Record<string, string>) {
  const captures = new Map<string, Map<string, CaptureFile>>()
  const kuaikanCovers = new Map<string, KuaikanCoverCapture>()
  return {
    name: 'local-creator-ops-web-bridge',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use('/api/opencli/xhs-save-draft', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: '只允许 POST 请求' })); return }
        if (!isLocalBridgeRequest(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: '仅允许 Creator Ops 本地页面调用' })); return }
        let root = ''
        try {
          const input = await readXhsDraftBody(req)
          const title = String(input.title ?? '').trim()
          const body = String(input.body ?? '').trim()
          if (!title || title.length > 20 || !body) throw new Error('请先保存有效的标题和正文（标题不超过 20 字）')
          const hashtags = Array.isArray(input.hashtags) ? input.hashtags.map((value) => String(value).trim().replace(/^#/, '')).filter(Boolean).slice(0, 5) : []
          const origin = new URL(env.VITE_SUPABASE_URL).origin
          root = await mkdtemp(resolve(tmpdir(), 'creator-ops-xhs-draft-'))
          const imagePaths = await stageXhsImages(input.images, root, origin)
          const raw = await runOpenCli(['xiaohongshu', 'publish', body, '--title', title, '--images', imagePaths.join(','), '--topics', hashtags.join(','), '--draft', 'true', '--window', 'foreground', '--keep-tab', 'true', '-f', 'json'], 240_000)
          const result = parseJson<unknown>(raw, '小红书暂存')
          if (!JSON.stringify(result).includes('暂存成功')) throw new Error('小红书未确认暂存成功，请在创作者中心核对')
          res.end(JSON.stringify({ status: 'saved', detail: result }))
        } catch (caught) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: caught instanceof Error ? caught.message : '暂存小红书草稿失败' }))
        } finally {
          if (root) await rm(root, { recursive: true, force: true }).catch(() => undefined)
        }
      })
      server.middlewares.use('/api/opencli/kuaikan-profile', async (req, res) => {
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
          const input = await readJsonBody(req) as { title?: unknown; sourceUrl?: unknown }
          const title = String(input.title ?? '').trim()
          if (!title || title.length > 100) throw new Error('缺少有效的漫画名称')
          const officialSourceUrl = await resolveKuaikanTopicUrl(title, input.sourceUrl)
          const html = await fetchKuaikanHtml(officialSourceUrl, '读取快看作品页')
          const official = parseKuaikanTopic(html, officialSourceUrl)
          const normalizedInput = normalizeComicTitle(title)
          const normalizedOfficial = normalizeComicTitle(official.canonicalTitle)
          const distance = editDistance(normalizedInput, normalizedOfficial)
          const allowedDistance = normalizedInput.length <= 8 ? 1 : Math.max(1, Math.floor(normalizedInput.length * 0.2))
          if (distance > allowedDistance) throw new Error(`官方页标题“${official.canonicalTitle}”与库内漫画“${title}”不匹配，请先核对链接`)

          const cover = await downloadKuaikanCover(official.coverUrl, official.canonicalTitle)
          const coverToken = randomUUID()
          kuaikanCovers.set(coverToken, cover)
          for (const [token, stored] of kuaikanCovers) {
            if (stored.expiresAt <= Date.now()) kuaikanCovers.delete(token)
          }
          const titleWarning = normalizedInput === normalizedOfficial
            ? ''
            : `快看官方标题为“${official.canonicalTitle}”；已保留库内名称“${title}”，未自动改名。`
          res.statusCode = 200
          res.end(JSON.stringify({
            canonicalTitle: official.canonicalTitle,
            officialSynopsis: official.officialSynopsis,
            officialSourceUrl: official.officialSourceUrl,
            author: official.author,
            tags: official.tags,
            titleWarning,
            cover: {
              filename: cover.filename,
              mimeType: cover.mimeType,
              byteSize: cover.bytes.byteLength,
              downloadUrl: `/api/opencli/kuaikan-cover/${coverToken}`,
            },
          }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : '快看漫画档案抓取失败'
          res.statusCode = 502
          res.end(JSON.stringify({ error: message }))
        }
      })

      server.middlewares.use('/api/opencli/kuaikan-cover', async (req, res) => {
        if (req.method !== 'GET' || !isLocalBridgeRequest(req)) {
          res.statusCode = req.method === 'GET' ? 403 : 405
          res.end()
          return
        }
        const token = (req.url ?? '').split('?')[0].split('/').filter(Boolean)[0]
        const cover = token ? kuaikanCovers.get(token) : undefined
        if (!cover || cover.expiresAt <= Date.now()) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('Content-Type', cover.mimeType)
        res.setHeader('Content-Length', cover.bytes.byteLength)
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(cover.filename)}`)
        res.setHeader('Cache-Control', 'no-store')
        res.statusCode = 200
        res.end(cover.bytes)
      })

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

          // Note detail pages can take longer than OpenCLI's 60s default while
          // the logged-in tab finishes loading. Keep the host timeout aligned
          // with the adapter timeout so the adapter reports the real failure.
          const rawDetail = await runOpenCli(['xiaohongshu', 'note', sourceUrl, '-f', 'json', '--window', 'background'], 135_000)
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

class SiliconFlowRequestError extends Error {
  status?: number
  retryable: boolean
  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.name = 'SiliconFlowRequestError'
    this.status = status
    this.retryable = retryable
  }
}

const waitForRetry = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

function localSiliconFlowPlugin(env: Record<string, string>) {
  const apiKey = env.SILICONFLOW_API_KEY?.trim()
  const model = env.SILICONFLOW_MODEL?.trim() || 'Qwen/Qwen3.5-35B-A3B'
  const visionModel = env.SILICONFLOW_VISION_MODEL?.trim() || 'zai-org/GLM-4.5V'
  const visionFallbackModel = env.SILICONFLOW_VISION_FALLBACK_MODEL?.trim() || 'Qwen/Qwen3.6-35B-A3B'
  const requestCompletion = async (input: {
    system: string
    prompt: string
    maxTokens: number
    temperature: number
    model: string
    imageDataUrl?: string
    jsonMode?: boolean
    disableThinking?: boolean
    maxAttempts?: number
  }) => {
    const messages = input.imageDataUrl
      ? [{ role: 'system', content: input.system }, { role: 'user', content: [{ type: 'image_url', image_url: { url: input.imageDataUrl, detail: 'low' } }, { type: 'text', text: input.prompt }] }]
      : [{ role: 'system', content: input.system }, { role: 'user', content: input.prompt }]
    const maxAttempts = Math.max(1, Math.min(2, input.maxAttempts ?? 2))
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: input.model,
            messages,
            temperature: input.temperature,
            max_tokens: input.maxTokens,
            ...(input.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            ...(input.disableThinking ? { enable_thinking: false } : {}),
          }),
          signal: AbortSignal.timeout(75_000),
        })
        const payload = await response.json().catch(() => ({})) as {
          choices?: Array<{ message?: { content?: unknown } }>
          error?: { message?: unknown } | string
          message?: unknown
        }
        const providerError = typeof payload.error === 'string'
          ? payload.error
          : typeof payload.error?.message === 'string'
            ? payload.error.message
            : typeof payload.message === 'string'
              ? payload.message
              : ''
        if (!response.ok) {
          const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
          throw new SiliconFlowRequestError(providerError || `硅基流动请求失败（${response.status}）`, response.status, retryable)
        }
        const content = payload.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content.trim()) throw new SiliconFlowRequestError('硅基流动未返回可用内容', response.status, true)
        return content
      } catch (caught) {
        const failure = caught instanceof SiliconFlowRequestError
          ? caught
          : new SiliconFlowRequestError('硅基流动连接超时或网络异常，请重试', undefined, true)
        if (!failure.retryable || attempt === maxAttempts - 1) throw failure
        await waitForRetry(600 * (attempt + 1))
      }
    }
    throw new SiliconFlowRequestError('硅基流动请求失败')
  }
  return {
    name: 'local-siliconflow-ai-bridge',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use('/api/ai/generate', async (req, res) => {
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
        if (!apiKey) {
          res.statusCode = 503
          res.end(JSON.stringify({ code: 'AI_NOT_CONFIGURED', error: '尚未配置 SILICONFLOW_API_KEY，当前将使用可见的模板模式' }))
          return
        }
        try {
          const input = await readAiJsonBody(req)
          const system = String(input.system ?? '').trim()
          const prompt = String(input.prompt ?? '').trim()
          if (!system || !prompt || system.length > 4_000 || prompt.length > 24_000) throw new Error('AI 请求缺少有效提示词')
          const maxTokens = Math.min(5_000, Math.max(200, Number.parseInt(String(input.maxTokens ?? 900), 10) || 900))
          const temperature = Math.min(1, Math.max(0, Number(input.temperature ?? 0.7) || 0.7))
          const content = await requestCompletion({ system, prompt, maxTokens, temperature, model, jsonMode: true, disableThinking: true })
          res.statusCode = 200
          res.end(JSON.stringify({ content, model }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : '硅基流动请求失败'
          res.statusCode = 502
          res.end(JSON.stringify({ error: message }))
        }
      })

      server.middlewares.use('/api/ai/vision', async (req, res) => {
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
        if (!apiKey) {
          res.statusCode = 503
          res.end(JSON.stringify({ code: 'AI_VISION_NOT_CONFIGURED', error: '尚未配置 SILICONFLOW_API_KEY，无法自动分析素材' }))
          return
        }
        try {
          const input = await readVisionJsonBody(req)
          const system = String(input.system ?? '').trim()
          const prompt = String(input.prompt ?? '').trim()
          const imageDataUrl = String(input.imageDataUrl ?? '').trim()
          const formatRetry = input.formatRetry === true
          if (!system || !prompt || !/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) throw new Error('图片分析请求缺少有效图片或提示词')
          // SiliconFlow's vision models do not support response_format JSON Mode.
          // The prompt asks for JSON and the client validates the returned structure instead.
          let usedVisionModel = visionModel
          let content: string
          try {
            content = await requestCompletion({ system, prompt, imageDataUrl, maxTokens: 350, temperature: 0.2, model: visionModel, disableThinking: true, maxAttempts: formatRetry ? 1 : 2 })
          } catch (caught) {
            const failure = caught instanceof SiliconFlowRequestError ? caught : undefined
            const canFallback = !formatRetry && visionFallbackModel !== visionModel && (failure?.status === 404 || failure?.status === 503)
            if (!canFallback) throw caught
            usedVisionModel = visionFallbackModel
            content = await requestCompletion({ system, prompt, imageDataUrl, maxTokens: 350, temperature: 0.2, model: visionFallbackModel, disableThinking: true, maxAttempts: 1 })
          }
          res.statusCode = 200
          res.end(JSON.stringify({ content, model: usedVisionModel }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : '硅基流动图片分析失败'
          res.statusCode = 502
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  return { plugins: [react(), localOpenCliPlugin(env), localSiliconFlowPlugin(env)] }
})
