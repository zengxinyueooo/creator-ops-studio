/* oxlint-disable react/only-export-components -- Provider and hook intentionally share one typed context. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoState } from '../data/demo'
import type { Topic, TopicStatus, WorkspaceState } from '../types'

const STORAGE_KEY = 'creator-ops-studio:workspace:v1'

interface WorkspaceContextValue {
  state: WorkspaceState
  activeAccount: WorkspaceState['accounts'][number]
  accountTopics: Topic[]
  setActiveAccount: (accountId: string) => void
  updateTopicStatus: (topicId: string, status: TopicStatus) => void
  addTopic: (input: Pick<Topic, 'title' | 'subtitle' | 'pillar'>) => void
  markResearchImported: (taskId: string) => void
  resetDemo: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function loadInitialState(): WorkspaceState {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return demoState
  try {
    return JSON.parse(stored) as WorkspaceState
  } catch {
    return demoState
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(loadInitialState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeAccount = state.accounts.find((account) => account.id === state.activeAccountId) ?? state.accounts[0]
  const accountTopics = state.topics.filter((topic) => topic.accountId === activeAccount.id)

  const value = useMemo<WorkspaceContextValue>(() => ({
    state,
    activeAccount,
    accountTopics,
    setActiveAccount: (accountId) => setState((current) => ({ ...current, activeAccountId: accountId })),
    updateTopicStatus: (topicId, status) => setState((current) => ({
      ...current,
      topics: current.topics.map((topic) => topic.id === topicId ? { ...topic, status, updatedAt: '刚刚' } : topic),
    })),
    addTopic: (input) => setState((current) => ({
      ...current,
      topics: [{
        id: crypto.randomUUID(),
        accountId: current.activeAccountId,
        title: input.title,
        subtitle: input.subtitle || '新建选题',
        status: 'idea',
        score: 60,
        pillar: input.pillar,
        tags: [],
        referenceCount: 0,
        assetCount: 0,
        updatedAt: '刚刚',
      }, ...current.topics],
    })),
    markResearchImported: (taskId) => setState((current) => ({
      ...current,
      researchTasks: current.researchTasks.map((task) => task.id === taskId ? { ...task, status: 'imported' } : task),
    })),
    resetDemo: () => setState(demoState),
  }), [accountTopics, activeAccount, state])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}
