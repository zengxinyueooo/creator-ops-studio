import {
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronDown,
  Library,
  Boxes,
  CalendarDays,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Search,
  Sparkles,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
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

const AVATAR_SIZE = 96

function avatarStorageKey(accountId: string) {
  return `creator-ops-avatar:${accountId}`
}

function readAvatarDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const source = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(source)
        reject(new Error('无法处理图片'))
        return
      }
      const scale = Math.max(AVATAR_SIZE / image.width, AVATAR_SIZE / image.height)
      const width = image.width * scale
      const height = image.height * scale
      context.drawImage(image, (AVATAR_SIZE - width) / 2, (AVATAR_SIZE - height) / 2, width, height)
      URL.revokeObjectURL(source)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    image.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error('图片读取失败'))
    }
    image.src = source
  })
}

export function AppShell() {
  const { state, activeAccount, setActiveAccount } = useWorkspace()
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState(() => localStorage.getItem(avatarStorageKey(activeAccount.id)))
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAvatarSrc(localStorage.getItem(avatarStorageKey(activeAccount.id)))
  }, [activeAccount.id])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const dataUrl = await readAvatarDataUrl(file)
      localStorage.setItem(avatarStorageKey(activeAccount.id), dataUrl)
      setAvatarSrc(dataUrl)
    } catch {
      // 图片解析失败时保留原头像
    }
  }

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
          <div className="account-switcher" ref={menuRef}>
            <button
              type="button"
              className="account-avatar"
              title="上传头像"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarSrc ? <img src={avatarSrc} alt={activeAccount.name} /> : (activeAccount.kind === 'manga' ? '漫' : '成')}
            </button>
            <button type="button" className="account-trigger" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={menuOpen}>
              <strong>{activeAccount.name}</strong>
              <small>{activeAccount.handle === '待创建' ? '第二账号 · 待创建' : `小红书号 ${activeAccount.handle}`}</small>
            </button>
            <ChevronDown size={16} className={menuOpen ? 'chevron open' : 'chevron'} />
            {menuOpen && (
              <div className="account-menu" role="listbox" aria-label="切换账号">
                {state.accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    role="option"
                    aria-selected={account.id === activeAccount.id}
                    className={account.id === activeAccount.id ? 'active' : ''}
                    onClick={() => { setActiveAccount(account.id); setMenuOpen(false) }}
                  >
                    <span className="menu-dot" style={{ background: account.accent }} />
                    <span className="menu-name">{account.name}</span>
                    {account.id === activeAccount.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={(event) => void handleAvatarChange(event)} />
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
