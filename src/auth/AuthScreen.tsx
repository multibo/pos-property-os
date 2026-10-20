import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'

export type AuthMode = 'sign-in' | 'sign-up' | 'reset-password'

export interface AuthScreenProps {
  configured: boolean
  loading: boolean
  error: string | null
  message: string | null
  onAuthenticate: (mode: AuthMode, email: string, password: string, displayName: string) => Promise<void>
}

export function AuthScreen({ configured, loading, error, message, onAuthenticate }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)
    if (!configured) return
    if (!email.trim()) return setLocalError('Enter your email address.')
    if (mode !== 'reset-password' && password.length < 8) return setLocalError('Use a password with at least 8 characters.')
    if (mode === 'sign-up' && !displayName.trim()) return setLocalError('Enter your name to set up your profile.')
    await onAuthenticate(mode, email.trim(), password, displayName.trim())
  }

  const title = mode === 'sign-in' ? 'Welcome back.' : mode === 'sign-up' ? 'Make space for better.' : 'Reset your password.'
  return <main className="auth-page">
    <section className="auth-story" aria-label="About pOS">
      <div className="auth-brand"><span className="brand-mark-static"><b>p</b><i>o</i><b>S</b></span><span>property OS <small>BETA</small></span></div>
      <div className="auth-story-content"><span className="auth-eyebrow"><i/> YOUR PROPERTY, IN GOOD ORDER</span><h1>More clarity.<br/><em>Less overhead.</em></h1><p>A calmer home for your properties, people, and the details that keep everything moving.</p><div className="auth-feature"><span><ShieldCheck size={17}/></span><div><strong>Your workspace, protected</strong><small>Private by default, with database-enforced access boundaries.</small></div></div></div>
      <div className="auth-story-footer">Thoughtfully made for the spaces you care for.</div>
      <div className="auth-orbit orbit-one"/><div className="auth-orbit orbit-two"/>
    </section>
    <section className="auth-form-side"><div className="auth-form-wrap">
      <div className="auth-mobile-brand"><span className="brand-mark-static"><b>p</b><i>o</i><b>S</b></span><span>property OS</span></div>
      <div className="auth-heading"><div className="auth-lock"><LockKeyhole size={19}/></div><p className="auth-kicker">YOUR WORKSPACE AWAITS</p><h2>{title}</h2><p>{mode === 'sign-in' ? 'Sign in to pick up where you left off.' : mode === 'sign-up' ? 'Create your account to get started.' : 'We’ll send you a secure password reset link.'}</p></div>
      {!configured && <div className="auth-alert" role="alert"><strong>Supabase setup required</strong><span>Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and publishable/anon key, then restart Vite. No account data is sent anywhere until configured.</span></div>}
      {(error || localError) && <div className="auth-error" role="alert">{localError || error}</div>}
      {message && <div className="auth-success" role="status">{message}</div>}
      <form className="auth-form" onSubmit={submit}>
        {mode === 'sign-up' && <label>Your name<input autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jordan Davis" disabled={loading} required/></label>}
        <label>Email address<span className="auth-input"><Mail size={16}/><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading} required/></span></label>
        {mode !== 'reset-password' && <label>Password<span className="auth-input"><LockKeyhole size={16}/><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={loading} required/><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>}
        {mode === 'sign-in' && <button type="button" className="auth-forgot" onClick={() => { setMode('reset-password'); setLocalError(null) }}>Forgot password?</button>}
        <button className="auth-submit" type="submit" disabled={!configured || loading}>{loading ? <span className="auth-spinner"/> : null}{loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}{!loading && <ArrowRight size={16}/>}</button>
      </form>
      <div className="auth-switch">{mode === 'reset-password' ? <>Remembered it? <button onClick={() => setMode('sign-in')}>Back to sign in</button></> : mode === 'sign-in' ? <>New to pOS? <button onClick={() => setMode('sign-up')}>Create an account</button></> : <>Already have an account? <button onClick={() => setMode('sign-in')}>Sign in</button></>}</div>
      <div className="auth-privacy"><ShieldCheck size={14}/> Sessions are managed by Supabase Auth. Workspace access is checked by PostgreSQL RLS.</div>
    </div></section>
  </main>
}
