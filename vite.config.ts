import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const execFileAsync = promisify(execFile)
const projectRoot = dirname(fileURLToPath(import.meta.url))

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
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function localOpenCliPlugin() {
  return {
    name: 'local-opencli-xhs-bridge',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void) => void } }) {
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

        try {
          let body = ''
          for await (const chunk of req) {
            body += chunk
            if (body.length > 8_192) throw new Error('请求内容过大')
          }
          const input = JSON.parse(body) as { query?: unknown; limit?: unknown }
          const query = String(input.query ?? '').trim()
          const limit = Math.min(20, Math.max(1, Number.parseInt(String(input.limit ?? 10), 10) || 10))
          if (query.length < 2 || query.length > 80) throw new Error('关键词长度需要在 2–80 个字符之间')

          const cliEntry = resolve(projectRoot, 'node_modules/@jackwener/opencli/dist/src/main.js')
          const { stdout } = await execFileAsync(process.execPath, [
            cliEntry,
            'xiaohongshu',
            'search',
            query,
            '--limit',
            String(limit),
            '--window',
            'background',
            '-f',
            'json',
          ], { cwd: projectRoot, timeout: 90_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })

          const rows = JSON.parse(stdout) as Array<Record<string, unknown>>
          const results = rows.map((row) => {
            const url = sanitizeXhsUrl(row.url)
            return {
              rank: Number(row.rank) || 0,
              noteId: url.split('/').filter(Boolean).at(-1) ?? '',
              title: String(row.title ?? '无标题'),
              author: String(row.author ?? '未知作者'),
              likes: parseMetric(row.likes),
              publishedAt: row.published_at ? String(row.published_at) : null,
              url,
            }
          }).filter((row) => row.url)

          res.statusCode = 200
          res.end(JSON.stringify({ results }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'OpenCLI 查询失败'
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localOpenCliPlugin()],
})
