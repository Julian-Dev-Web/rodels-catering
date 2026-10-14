import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Form } from '../components/Form'
import { Brand } from '../layouts/Layouts'
import { requireConfiguration, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth'
import { roleHome } from '../lib/permissions'
export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const [done, setDone] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const titles = {
    login: 'Good to see you again.',
    register: 'Your next celebration starts here.',
    forgot: 'Let’s get you back in.',
    reset: 'A fresh start.',
  }
  const descriptions = {
    login: 'Sign in to plan, manage, and make memories.',
    register: 'Create your account and make room for something wonderful.',
    forgot: 'We’ll email you a secure link to reset your password.',
    reset: 'Choose a new password for your account.',
  }
  const fields =
    mode === 'register'
      ? [
          { name: 'full_name', label: 'Full name', required: true, max: 150 },
          { name: 'email', label: 'Email address', type: 'email', required: true },
          { name: 'password', label: 'Password', type: 'password', required: true },
        ]
      : mode === 'reset'
        ? [{ name: 'password', label: 'New password', type: 'password', required: true }]
        : [
            { name: 'email', label: 'Email address', type: 'email', required: true },
            ...(mode === 'login'
              ? [{ name: 'password', label: 'Password', type: 'password', required: true }]
              : []),
          ]
  async function submit(v: Record<string, string>) {
    requireConfiguration()
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      })
      if (error) throw error
      const { data: p, error: pe } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      if (pe) throw pe
      const requested = location.state?.from
      navigate(
        typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//')
          ? requested
          : roleHome[p.role as keyof typeof roleHome],
        { replace: true },
      )
    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
        options: {
          data: { full_name: v.full_name },
          emailRedirectTo: window.location.origin + '/customer/reservations',
        },
      })
      if (error) throw error
      setDone(true)
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(v.email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw error
      setDone(true)
    } else {
      if (!auth.session) throw new Error('Open the password reset link in your email first.')
      const { error } = await supabase.auth.updateUser({ password: v.password })
      if (error) throw error
      setDone(true)
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-art">
        <Brand light />
        <div>
          <span className="eyebrow">MADE FOR YOUR MOMENTS</span>
          <h2>
            A good meal.
            <br />
            Your favorite people.
            <br />
            <em>Something to remember.</em>
          </h2>
        </div>
        <span>Rodel’s Catering · Shared with love.</span>
      </aside>
      <main className="auth-main">
        <Link className="text-button" to="/">
          <ArrowLeft size={15} />
          Back to home
        </Link>
        <div className="auth-form">
          <span className="eyebrow">WELCOME TO THE TABLE</span>
          <h1>{titles[mode]}</h1>
          <p>{descriptions[mode]}</p>
          {done ? (
            <div className="success-card" role="status">
              <CheckCircle2 size={30} />
              <h3>{mode === 'reset' ? 'Password updated' : 'Check your inbox'}</h3>
              <p>
                {mode === 'reset'
                  ? 'Your new password is ready to use.'
                  : 'If your address is eligible, you’ll receive an email with the next steps. Follow the link to continue.'}
              </p>
              <Link className="button" to="/login">
                Back to sign in
              </Link>
            </div>
          ) : (
            <Form
              fields={fields}
              submit={submit}
              label={
                mode === 'login'
                  ? 'Sign in'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : 'Update password'
              }
            />
          )}
          <div className="auth-links">
            {mode === 'login' ? (
              <>
                <Link to="/forgot-password">Forgot password?</Link>
                <p>
                  New to the table? <Link to="/register">Create an account</Link>
                </p>
              </>
            ) : (
              <Link to="/login">Already have an account? Sign in</Link>
            )}
          </div>
          {mode === 'register' && (
            <small>
              By registering, you agree to our{' '}
              <Link to="/policies">reservation & refund policies</Link>.
            </small>
          )}
        </div>
      </main>
    </div>
  )
}
