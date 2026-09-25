import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

try { process.loadEnvFile(resolve(import.meta.dirname, '../.env.local')) } catch { /* optional in local demo mode */ }

const withWorker = process.env.VITE_DATA_MODE !== 'local'
  && Boolean(process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const target = withWorker ? 'dev:agent' : 'dev:web'
if (!withWorker) process.stdout.write('未配置 Supabase Worker，启动本地演示页面。\n')

const child = process.platform === 'win32'
  ? spawn('cmd.exe', ['/d', '/s', '/c', `pnpm ${target}`], { stdio: 'inherit', windowsHide: true })
  : spawn('pnpm', [target], { stdio: 'inherit' })
child.on('error', (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
