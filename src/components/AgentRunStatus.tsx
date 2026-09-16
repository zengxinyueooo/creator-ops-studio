import { AlertCircle, CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { agentProgressMessage } from '../lib/agentWorkflow'
import { agentFailureGuidance } from '../lib/agentFailureGuidance'
import type { AgentRun } from '../types'

export function AgentRunStatus({ run, error, successText, onRetry, retryLabel = '重新执行' }: { run: AgentRun | null; error?: string; successText: string; onRetry?: () => void; retryLabel?: string }) {
  if (error) return <div className="agent-run-status failed" role="alert"><AlertCircle size={15} /><div><strong>无法读取后台进度</strong><span>{error}</span></div></div>
  if (!run) return null
  const active = run.status === 'queued' || run.status === 'running'
  const failed = run.status === 'failed' || run.status === 'cancelled'
  return <div className={`agent-run-status ${failed ? 'failed' : run.status}`} role="status" aria-live="polite">
    {active ? <LoaderCircle className="spin" size={15} /> : failed ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
    <div><strong>{failed ? '任务执行失败' : run.status === 'succeeded' ? successText : agentProgressMessage(run)}</strong><span>{failed ? run.errorMessage || '任务未完成' : active ? agentProgressMessage(run) : '结果已保存，可继续人工审核'}</span>{failed && <small>{agentFailureGuidance(run.errorMessage)}</small>}</div>
    {failed && onRetry && <button className="agent-run-retry" type="button" onClick={onRetry}><RotateCcw size={13} />{retryLabel}</button>}
  </div>
}
