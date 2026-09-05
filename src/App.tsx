import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AssetsPage } from './pages/AssetsPage'
import { CalendarPage } from './pages/CalendarPage'
import { DashboardPage } from './pages/DashboardPage'
import { DraftsPage } from './pages/DraftsPage'
import { ResearchPage } from './pages/ResearchPage'
import { TopicsPage } from './pages/TopicsPage'
import { LoginPage } from './pages/LoginPage'
import { ComicsPage } from './pages/ComicsPage'
import { useAuth } from './auth/AuthContext'
import { dataMode, needsSupabaseConfiguration } from './lib/supabase'
import { WorkspaceProvider } from './store/WorkspaceContext'
import './App.css'

export default function App() {
  const { user, loading } = useAuth()

  if (needsSupabaseConfiguration) {
    return <main className="setup-page">
      <section className="setup-card">
        <span className="eyebrow">CONFIGURATION REQUIRED</span>
        <h1>尚未连接你的 Supabase 工作台</h1>
        <p>此项目不会再自动展示演示素材。请在当前仓库创建未提交的 <code>.env.local</code>，填入同一个 Supabase 项目的 URL、Publishable Key，并设置 <code>VITE_DATA_MODE=supabase</code>。</p>
        <p>若只想查看纯 UI 演示，请显式设置 <code>VITE_DATA_MODE=local</code>。</p>
      </section>
    </main>
  }

  if (dataMode === 'supabase' && loading) return <div className="app-state">正在连接你的工作台…</div>
  if (dataMode === 'supabase' && !user) return <LoginPage />

  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="topics" element={<TopicsPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="comics" element={<ComicsPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="drafts" element={<DraftsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  )
}
