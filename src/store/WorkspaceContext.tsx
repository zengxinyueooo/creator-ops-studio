/* oxlint-disable react/only-export-components -- Provider and hook intentionally share one typed context. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Database, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { demoState } from '../data/demo'
import { dataMode } from '../lib/supabase'
import {
  createCloudTopic,
  createCloudResearchTask,
  importCloudResearchResults,
  loadCloudWorkspace,
  markCloudResearchImported,
  seedCloudWorkspace,
  updateCloudTopicStatus,
} from '../lib/workspaceRepository'
import type { Topic, TopicStatus, WorkspaceState, XhsResearchResult } from '../types'

const STORAGE_KEY = 'creator-ops-studio:workspace:v1'
const EMPTY_STATE: WorkspaceState = { accounts: [], activeAccountId: '', topics: [], references: [], researchTasks: [], schedules: [] }

interface WorkspaceContextValue {
  state: WorkspaceState
  activeAccount: WorkspaceState['accounts'][number]
  accountTopics: Topic[]
  setActiveAccount: (accountId: string) => void
  updateTopicStatus: (topicId: string, status: TopicStatus) => void
  addTopic: (input: Pick<Topic, 'title' | 'subtitle' | 'pillar'>) => void
  markResearchImported: (taskId: string) => void
  addResearchTask: (input: { keyword: string; purpose: string; limit: number }) => Promise<void>
  importResearchResults: (taskId: string, results: XhsResearchResult[]) => Promise<void>
  resetDemo: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function loadLocalState(): WorkspaceState {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return demoState
  try {
    return JSON.parse(stored) as WorkspaceState
  } catch {
    return demoState
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const [state, setState] = useState<WorkspaceState>(() => dataMode === 'local' ? loadLocalState() : EMPTY_STATE)
  const [loading, setLoading] = useState(dataMode === 'supabase')
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (dataMode !== 'supabase' || !user) return
    setLoading(true)
    setError('')
    try {
      setState(await loadCloudWorkspace(user.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '云端数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (dataMode !== 'supabase') return
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    if (dataMode === 'local') localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeAccount = state.accounts.find((account) => account.id === state.activeAccountId) ?? state.accounts[0] ?? demoState.accounts[0]
  const accountTopics = state.topics.filter((topic) => topic.accountId === activeAccount.id)

  const value = useMemo<WorkspaceContextValue>(() => ({
    state,
    activeAccount,
    accountTopics,
    setActiveAccount: (accountId) => {
      localStorage.setItem('creator-ops-studio:active-account', accountId)
      setState((current) => ({ ...current, activeAccountId: accountId }))
    },
    updateTopicStatus: (topicId, status) => {
      const previous = state
      setState((current) => ({
        ...current,
        topics: current.topics.map((topic) => topic.id === topicId ? { ...topic, status, updatedAt: '刚刚' } : topic),
      }))
      if (dataMode === 'supabase') {
        void updateCloudTopicStatus(topicId, status).catch((caught) => {
          setState(previous)
          setError(caught instanceof Error ? caught.message : '选题状态保存失败')
        })
      }
    },
    addTopic: (input) => {
      if (dataMode === 'supabase' && user) {
        void createCloudTopic(user.id, state.activeAccountId, input).then((row) => {
          setState((current) => ({
            ...current,
            topics: [{
              id: row.id,
              accountId: row.account_id,
              title: row.title,
              subtitle: row.subtitle,
              status: row.status,
              score: row.score,
              pillar: row.pillar,
              tags: row.tags ?? [],
              referenceCount: 0,
              assetCount: 0,
              updatedAt: '刚刚',
            }, ...current.topics],
          }))
        }).catch((caught) => setError(caught instanceof Error ? caught.message : '选题创建失败'))
        return
      }
      setState((current) => ({
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
      }))
    },
    markResearchImported: (taskId) => {
      const previous = state
      setState((current) => ({
        ...current,
        researchTasks: current.researchTasks.map((task) => task.id === taskId ? { ...task, status: 'imported' } : task),
      }))
      if (dataMode === 'supabase') {
        void markCloudResearchImported(taskId).catch((caught) => {
          setState(previous)
          setError(caught instanceof Error ? caught.message : '调研任务保存失败')
        })
      }
    },
    addResearchTask: async (input) => {
      if (dataMode === 'supabase' && user) {
        const row = await createCloudResearchTask(user.id, state.activeAccountId, input)
        setState((current) => ({
          ...current,
          researchTasks: [{
            id: row.id,
            accountId: row.account_id,
            keyword: row.keyword,
            purpose: row.purpose,
            status: 'queued',
            limit: row.result_limit,
            createdAt: '刚刚',
          }, ...current.researchTasks],
        }))
        return
      }
      setState((current) => ({
        ...current,
        researchTasks: [{
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          keyword: input.keyword,
          purpose: input.purpose,
          status: 'queued',
          limit: input.limit,
          createdAt: '刚刚',
        }, ...current.researchTasks],
      }))
    },
    importResearchResults: async (taskId, results) => {
      if (dataMode === 'supabase' && user) {
        await importCloudResearchResults(user.id, state.activeAccountId, taskId, results)
        await reload()
        return
      }
      setState((current) => ({
        ...current,
        references: [...results.map((result) => ({
          id: crypto.randomUUID(),
          accountId: current.activeAccountId,
          title: result.title,
          author: result.author,
          sourceUrl: result.url,
          likes: result.likes,
          collects: 0,
          comments: 0,
          capturedAt: '刚刚',
          insight: '',
        })), ...current.references],
        researchTasks: current.researchTasks.map((task) => task.id === taskId ? { ...task, status: 'imported' } : task),
      }))
    },
    resetDemo: () => dataMode === 'local' ? setState(demoState) : void reload(),
  }), [accountTopics, activeAccount, reload, state, user])

  if (loading) return <div className="app-state">正在读取 Supabase 数据…</div>

  if (error && state.accounts.length === 0) {
    return <div className="app-state-card"><Database size={28} /><h2>云端数据暂时无法读取</h2><p>{error}</p><button className="primary-button" onClick={() => void reload()}><RefreshCw size={15} />重新加载</button></div>
  }

  if (dataMode === 'supabase' && state.accounts.length === 0) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <span className="auth-logo"><Sparkles size={20} /></span>
          <span className="eyebrow">FIRST RUN</span>
          <h1>数据库已经准备好了</h1>
          <p>初始化后会创建“漫画放映室”和“成长实验室”两个账号，并加入少量示例选题，方便你直接开始整理。</p>
          {error && <p className="form-message error">{error}</p>}
          <button className="primary-button" disabled={seeding} onClick={() => {
            if (!user) return
            setSeeding(true)
            setError('')
            void seedCloudWorkspace(user.id).then(reload).catch((caught) => {
              setError(caught instanceof Error ? caught.message : '初始化失败')
            }).finally(() => setSeeding(false))
          }}>{seeding ? '正在初始化…' : '初始化我的工作台'}</button>
          <button className="auth-switch" onClick={() => void signOut()}>退出当前账号</button>
        </section>
      </main>
    )
  }

  return <WorkspaceContext.Provider value={value}>{error && <div className="sync-error">{error}</div>}{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}
