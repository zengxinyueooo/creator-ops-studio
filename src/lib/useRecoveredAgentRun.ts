import { useEffect, useRef, useState } from 'react'
import { loadLatestAccountAgentWorkflow, loadLatestAgentWorkflow, type AgentRunType, type AgentTargetType } from './agentWorkflow'
import { dataMode } from './supabase'
import type { AgentRun } from '../types'

export function useRecoveredAgentRun(
  input: { runType: AgentRunType; targetType: AgentTargetType; targetId?: string },
  onRecoveredSuccess?: (run: AgentRun) => void | Promise<void>,
) {
  const { runType, targetType, targetId } = input
  const taskKey = `${runType}:${targetType}:${targetId ?? ''}`
  const [snapshot, setSnapshot] = useState<{ key: string; run: AgentRun | null; error: string }>({ key: taskKey, run: null, error: '' })
  const observedActive = useRef(new Set<string>())
  const handled = useRef(new Set<string>())
  const onSuccessRef = useRef(onRecoveredSuccess)
  useEffect(() => { onSuccessRef.current = onRecoveredSuccess }, [onRecoveredSuccess])

  useEffect(() => {
    if (dataMode !== 'supabase' || !targetId) return
    let stopped = false
    let timer: number | undefined
    const handleError = (caught: unknown) => {
      if (!stopped) setSnapshot({ key: taskKey, run: null, error: caught instanceof Error ? caught.message : '读取后台任务失败' })
    }
    const poll = async () => {
      const latest = await loadLatestAgentWorkflow({ runType, targetType, targetId })
      if (stopped) return
      setSnapshot({ key: taskKey, run: latest, error: '' })
      const active = latest?.status === 'queued' || latest?.status === 'running'
      if (latest && active) observedActive.current.add(latest.id)
      if (latest?.status === 'succeeded' && observedActive.current.has(latest.id) && !handled.current.has(latest.id)) {
        handled.current.add(latest.id)
        await onSuccessRef.current?.(latest)
      }
      if (!stopped && active) timer = window.setTimeout(() => void poll().catch(handleError), 1800)
    }
    void poll().catch(handleError)
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [runType, targetId, targetType, taskKey])

  const current = snapshot.key === taskKey ? snapshot : { key: taskKey, run: null, error: '' }
  return { run: current.run, error: current.error, active: current.run?.status === 'queued' || current.run?.status === 'running' }
}

export function useRecoveredAccountAgentRun(
  input: { runType: AgentRunType; accountId?: string },
  onRecoveredSuccess?: (run: AgentRun) => void | Promise<void>,
) {
  const { runType, accountId } = input
  const taskKey = `${runType}:account:${accountId ?? ''}`
  const [snapshot, setSnapshot] = useState<{ key: string; run: AgentRun | null; error: string }>({ key: taskKey, run: null, error: '' })
  const observedActive = useRef(new Set<string>())
  const handled = useRef(new Set<string>())
  const onSuccessRef = useRef(onRecoveredSuccess)
  useEffect(() => { onSuccessRef.current = onRecoveredSuccess }, [onRecoveredSuccess])

  useEffect(() => {
    if (dataMode !== 'supabase' || !accountId) return
    let stopped = false
    let timer: number | undefined
    const handleError = (caught: unknown) => {
      if (!stopped) setSnapshot({ key: taskKey, run: null, error: caught instanceof Error ? caught.message : '读取后台任务失败' })
    }
    const poll = async () => {
      const latest = await loadLatestAccountAgentWorkflow({ runType, accountId })
      if (stopped) return
      setSnapshot({ key: taskKey, run: latest, error: '' })
      const active = latest?.status === 'queued' || latest?.status === 'running'
      if (latest && active) observedActive.current.add(latest.id)
      if (latest?.status === 'succeeded' && observedActive.current.has(latest.id) && !handled.current.has(latest.id)) {
        handled.current.add(latest.id)
        await onSuccessRef.current?.(latest)
      }
      if (!stopped && active) timer = window.setTimeout(() => void poll().catch(handleError), 1800)
    }
    void poll().catch(handleError)
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [accountId, runType, taskKey])

  const current = snapshot.key === taskKey ? snapshot : { key: taskKey, run: null, error: '' }
  return { run: current.run, error: current.error, active: current.run?.status === 'queued' || current.run?.status === 'running' }
}
