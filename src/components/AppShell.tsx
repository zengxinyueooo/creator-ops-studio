import {
  BarChart3,
  BookOpenCheck,
  Library,
  Boxes,
  CalendarDays,
  ChevronDown,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Search,
  Sparkles,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { dataMode } from '../lib/supabase'
import { useWorkspace } from '../store/WorkspaceContext'
import { useAuth } from '../auth/AuthContext'

const navigation = [
  { to: '/', label: '总览台', icon: LayoutDashboard },
  { to: '/topics', label: '选题工作流', icon: BookOpenCheck },
  { to: '/research', label: '调研导入箱', icon: Search },
  { to: '/comics', label: '漫画候选库', icon: Library },
  { to: '/assets', label: '素材库', icon: Boxes },
  { to: '/drafts', label: '文案工作台', icon: FileText },
  { to: '/calendar', label: '内容日历', icon: CalendarDays },
  { to: '/analytics', label: '数据复盘', icon: BarChart3 },
]

export function AppShell() {
  const { state, activeAccount, setActiveAccount } = useWorkspace()
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell" style={{ '--account-accent': activeAccount.accent } as CSSProperties}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <div><strong>Creator Ops</strong><span>内容运营工作台</span></div>
          <PanelLeftClose size={18} className="muted-icon" />
        </div>

        <div className="account-switcher-wrap">
          <label>当前账号</label>
          <div className="account-switcher">
            <span className="account-avatar">{activeAccount.kind === 'manga' ? '漫' : '成'}</span>
            <select value={activeAccount.id} onChange={(event) => setActiveAccount(event.target.value)}>
              {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
          <p>{activeAccount.handle === '待创建' ? '第二账号 · 待创建' : `小红书号 ${activeAccount.handle}`}</p>
        </div>

        <nav>
          <span className="nav-heading">工作空间</span>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="mode-pill"><span className={dataMode === 'supabase' ? 'dot online' : 'dot'} />{dataMode === 'supabase' ? 'Supabase 已连接' : '本地演示模式'}</div>
          <p>v0.1.0 · 数据自动保存</p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-search"><Search size={17} /><span>搜索选题、素材和参考内容</span><kbd>⌘ K</kbd></div>
          <div className="topbar-actions"><button className="icon-button" aria-label="导入箱"><Inbox size={18} /></button><span className="user-avatar">{user?.email?.slice(0, 1).toUpperCase() ?? 'Z'}</span>{dataMode === 'supabase' && <button className="icon-button" aria-label="退出登录" title="退出登录" onClick={() => void signOut()}><LogOut size={16} /></button>}</div>
        </header>
        <div className="page-container"><Outlet /></div>
      </main>
    </div>
  )
}
