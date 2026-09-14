import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { agentProgressMessage } from '../lib/agentWorkflow'
import type { AgentRun } from '../types'

export function AgentRunStatus({ run, error, successText }: { run: AgentRun | null; error?: string; successText: string }) {
  if (error) return <div className="agent-run-status failed" role="alert"><AlertCircle size={15} /><div><strong>无法读取后台进度</strong><span>{error}</span></div></div>
  if (!run) return null
  const active = run.status === 'queued' || run.status === 'running'
  const failed = run.status === 'failed' || run.status === 'cancelled'
  return <div className={`agent-run-status ${failed ? 'failed' : run.status}`} role="status" aria-live="polite">
    {active ? <LoaderCircle className="spin" size={15} /> : failed ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
    <div><strong>{failed ? '任务执行失败' : run.status === 'succeeded' ? successText : agentProgressMessage(run)}</strong><span>{failed ? run.errorMessage || '请修复提示的问题后重试' : active ? agentProgressMessage(run) : '结果已保存，可继续人工审核'}</span></div>
  </div>
}
