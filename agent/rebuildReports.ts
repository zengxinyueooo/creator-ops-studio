import { createClient } from '@supabase/supabase-js'
import { saveExecutionReport } from './executionReport.js'

process.loadEnvFile('.env.local')
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('缺少 Worker 数据库配置')
const db = createClient(url, key, { auth: { persistSession: false } })
const runId = process.argv[2]
if (!runId) throw new Error('请提供需要重新生成报告的 run_id')
await saveExecutionReport(db, runId)
console.log('任务报告已重新生成：' + runId)
