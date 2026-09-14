export function errorText(error: unknown): string {
  const e = error as { message?: unknown; code?: unknown; details?: unknown; cause?: { code?: unknown } } | null
  const message = typeof error === 'string' ? error : [e?.code, e?.message, e?.details, e?.cause?.code].filter(v => typeof v === 'string').join(' · ')
  return (message || '未知错误（未提供错误详情）').replace(/https?:\/\/[^\s]+/g, '[链接已隐藏]').slice(0, 800)
}

export class RecoveryGate {
  constructor(private readonly audit?: (entry: Record<string, unknown>) => Promise<void>) {}
  private async record(entry: Record<string, unknown>) {
    try { await this.audit?.(entry) } catch { console.warn('工具审计记录失败，业务执行继续') }
  }
  private attempts = new Map<string, number>()
  private blocked = new Map<string, string>()
  private calls = 0
  private tail: Promise<unknown> = Promise.resolve()
  lastError = ''
  terminal = false

  /** Serialize tools even if the model issues parallel calls. Budgets are host enforced. */
  run(stage: string, action: () => Promise<unknown>) {
    const task = this.tail.then(async () => {
      const callId = crypto.randomUUID()
      const attempt = (this.attempts.get(stage) ?? 0) + 1
      await this.record({ phase: 'started', stage, callId, attempt })
      const started = Date.now()
      const result = await this.execute(stage, action)
      const details = 'result' in result ? result.result as Record<string, unknown> | undefined : undefined
      await this.record({ phase: 'finished', stage, callId, attempt, durationMs: Date.now() - started,
        ok: result.ok, ...(!result.ok ? { message: result.message, retryable: result.retryable, action: result.action } : {}),
        ...(details ? Object.fromEntries(Object.entries(details).filter(([key]) => ['skipped', 'position', 'completed', 'remainingPositions', 'savedPositions', 'expectedPositions', 'imageCount'].includes(key))) : {}),
      })
      return result
    })
    this.tail = task.catch(() => undefined)
    return task
  }

  private async execute(stage: string, action: () => Promise<unknown>) {
    const attempt = (this.attempts.get(stage) ?? 0) + 1
    const observe = stage === 'observe'
    if (++this.calls > 120 || this.terminal || this.blocked.has(stage) || (!observe && attempt > 3)) {
      this.lastError = this.blocked.get(stage) || this.lastError || '恢复预算耗尽'
      return { ok: false, stage, retryable: false, action: 'stop', message: this.lastError }
    }
    this.attempts.set(stage, attempt)
    try {
      return { ok: true, stage, result: await action() }
    } catch (error) {
      const message = errorText(error)
      const requiresHuman = /usage limit|quota|余额|额度|登录|验证|SECURITY_BLOCK|Navigation rejected|401|403|权限|不再保留/i.test(message)
      const transient = /fetch failed|ECONN|ETIMEDOUT|timeout|超时|502|503|504|network|连接/i.test(message)
      // Browser capture is never replayed automatically: a timed-out child may still run.
      const retryable = stage !== 'capture' && !requiresHuman && transient && attempt < 3
      this.lastError = `${stage}：${message}`
      if (!retryable) this.blocked.set(stage, this.lastError)
      if (requiresHuman || stage === 'capture') this.terminal = true
      return { ok: false, stage, message, attempt, retryable, action: retryable ? 'observe_then_retry' : 'stop', preserveCompleted: true }
    }
  }
}

export function missingPositions(expected: number[], saved: number[]) {
  const present = new Set(saved)
  return expected.filter(position => !present.has(position))
}
