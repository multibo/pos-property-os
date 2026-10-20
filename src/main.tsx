import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { AuthScreen, type AuthMode } from './auth/AuthScreen'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './styles.css'

function AuthenticatedApplication() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) { setCheckingSession(false); return }
    let alive = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return
      setSession(data.session)
      if (sessionError) setError('Unable to restore your session. Please sign in again.')
      setCheckingSession(false)
    }).catch(() => {
      if (!alive) return
      setSession(null)
      setError('Unable to restore your session. Please sign in again.')
      setCheckingSession(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setError(null)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  const authenticate = useCallback(async (mode: AuthMode, email: string, password: string, displayName: string) => {
    if (!supabase) return
    setLoading(true); setError(null); setMessage(null)
    try {
      if (mode === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      } else if (mode === 'sign-up') {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
        if (authError) throw authError
        if (!data.session) setMessage('Account created. Check your email to confirm the address, then sign in.')
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` })
        if (authError) throw authError
        setMessage('If an account exists for this email, a password reset link will arrive shortly.')
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'An unexpected error occurred.'
      setError(msg.includes('Invalid login credentials') ? 'Email or password is incorrect.' : msg.includes('User already registered') ? 'An account already exists for this email. Try signing in.' : msg)
    } finally { setLoading(false) }
  }, [])

  if (checkingSession) return <main className="auth-loading"><span className="auth-spinner"/><p>Restoring your secure session…</p></main>
  if (session) return <App userEmail={session.user.email ?? ''} onSignOut={async () => { await supabase?.auth.signOut() }} />
  return <AuthScreen configured={isSupabaseConfigured} loading={loading} error={error} message={message} onAuthenticate={authenticate}/>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthenticatedApplication /></React.StrictMode>,
)
