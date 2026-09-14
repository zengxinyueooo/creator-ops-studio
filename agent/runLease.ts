import type { SupabaseClient } from '@supabase/supabase-js'

type Logger = Pick<Console, 'warn'>

export class RunLease {
  private timer?: ReturnType<typeof setInterval>
  private lost = false

  constructor(
    private readonly db: SupabaseClient,
    private readonly runId: string,
    private readonly workerId: string,
    private readonly intervalMs = 60_000,
    private readonly logger: Logger = console,
  ) {}

  async renew(step?: string) {
    const { data, error } = await this.db.rpc('renew_agent_run_lease', {
      p_run_id: this.runId,
      p_worker_id: this.workerId,
      p_step: step ?? null,
    })
    if (error) throw error
    if (data !== true) {
      this.lost = true
      throw new Error('任务执行权已失效，当前 Worker 已停止写入')
    }
  }

  start() {
    this.timer = setInterval(() => {
      void this.renew().catch((error) => {
        if (this.lost) return
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`[agent-worker] run ${this.runId} 心跳续租失败，将在下一周期重试: ${message}`)
      })
    }, this.intervalMs)
  }

  assertOwned() {
    if (this.lost) throw new Error('任务执行权已失效，当前 Worker 已停止写入')
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }
}

export async function finishOwnedRun(
  db: SupabaseClient,
  input: { runId: string; workerId: string; status: 'succeeded' | 'failed'; errorMessage?: string; piSessionId?: string },
) {
  const { data, error } = await db.rpc('finish_agent_run', {
    p_run_id: input.runId,
    p_worker_id: input.workerId,
    p_status: input.status,
    p_error_message: input.errorMessage ?? null,
    p_pi_session_id: input.piSessionId ?? null,
  })
  if (error) throw error
  if (data !== true) throw new Error('任务执行权已失效，拒绝覆盖其他 Worker 的执行结果')
}
