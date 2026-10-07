import { useState } from 'react'
import { Layers3 } from 'lucide-react'
import { startSession, verifyCredentials } from '../lib/auth'

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const submit = async () => {
    setChecking(true)
    setError('')
    try {
      if (await verifyCredentials(username, password)) { startSession(); onLogin(); return }
      setError('Incorrect username or password.')
      setPassword('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign-in is unavailable in this browser.')
    }
    setChecking(false)
  }

  return <main className="login-page">
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={event => { event.preventDefault(); void submit() }}>
        <div className="brand"><span className="brandmark"><Layers3 size={21}/></span>3DSmartLoad</div>
        <div className="login-heading">
          <h2>Welcome back.</h2>
          <p className="login-intro">Sign in to open your cargo planning workspace.</p>
        </div>
        <label className="field">
          <span>Username</span>
          <div className="input-unit">
            <input autoFocus required autoComplete="username" autoCapitalize="off" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)}/>
          </div>
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-unit">
            <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/>
          </div>
        </label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button className="btn primary full-width" type="submit" disabled={checking || !username || !password}>{checking ? 'Signing in…' : 'Sign in'}</button>
        <div className="demo-account">
          <span className="eyebrow">DEMO ACCOUNT</span>
          <dl>
            <div><dt>Username</dt><dd>USER1</dd></div>
            <div><dt>Password</dt><dd>User1234!</dd></div>
          </dl>
        </div>
      </form>
      <p className="login-footer">3DSMARTLOAD / Make every cubic meter count.</p>
    </div>
  </main>
}
