import { useState, type FormEvent } from 'react'
import { ArrowRight, Cloud, LockKeyhole, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { sendLoginLink } = useAuth()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')
    try {
      await sendLoginLink(email.trim())
      setMessage('登录链接已发送，请在邮箱中打开链接继续。')
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
            <span className="eyebrow">WELCOME BACK</span>
            <h2>登录工作台</h2>
            <p>输入邮箱，我们会发送一次性登录链接。</p>
          </div>
          <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          {error && <p className="form-message error">{error}</p>}
          {message && <p className="form-message success">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? '发送中…' : '发送登录链接'}<ArrowRight size={16} /></button>
        </form>
      </section>
    </main>
  )
}
