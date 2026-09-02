import { useState, type FormEvent } from 'react'
import { ArrowRight, Cloud, LockKeyhole, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const result = await signUp(email.trim(), password)
        if (result.needsConfirmation) {
          setMessage('注册成功，请先到邮箱点击 Supabase 验证链接，再返回登录。')
          setMode('signin')
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败，请稍后重试')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <span className="auth-logo"><Sparkles size={20} /></span>
        <div>
          <span className="eyebrow">CREATOR OPS STUDIO</span>
          <h1>把灵感、素材和文案，<br />放进同一个工作台。</h1>
          <p>为你的漫画号与成长号准备的私有内容运营系统。发布仍由你手动完成，工作过程安全同步到 Supabase。</p>
        </div>
        <ul>
          <li><Cloud size={16} /> 云端保存，换设备也能继续</li>
          <li><LockKeyhole size={16} /> RLS 隔离，只能看到自己的数据</li>
        </ul>
      </section>

      <section className="auth-card-wrap">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">{mode === 'signin' ? 'WELCOME BACK' : 'CREATE WORKSPACE'}</span>
            <h2>{mode === 'signin' ? '登录工作台' : '创建你的账号'}</h2>
            <p>{mode === 'signin' ? '使用 Supabase 邮箱账号继续。' : '首次注册后可能需要验证邮箱。'}</p>
          </div>
          <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required /></label>
          {error && <p className="form-message error">{error}</p>}
          {message && <p className="form-message success">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? '处理中…' : mode === 'signin' ? '登录' : '注册'}<ArrowRight size={16} /></button>
          <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>
            {mode === 'signin' ? '还没有账号？创建一个' : '已经有账号？返回登录'}
          </button>
        </form>
      </section>
    </main>
  )
}
