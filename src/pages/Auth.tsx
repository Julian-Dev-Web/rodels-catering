import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Form } from '../components/Form'
import type { Field } from '../components/Form'
import { Brand } from '../layouts/Layouts'
import { authCallback, requireConfiguration, supabase } from '../lib/supabase'
import { fieldErrors, fullName, passwordSchema, registrationSchema } from '../lib/account'
import { ErrorState, Loading } from '../components/ui'
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
  const fields: Field[] =
    mode === 'register'
      ? [
          { name: 'first_name', label: 'First name', required: true, max: 60, autoComplete: 'given-name' },
          { name: 'middle_name', label: 'Middle name (optional)', max: 60, autoComplete: 'additional-name' },
          { name: 'last_name', label: 'Last name', required: true, max: 60, autoComplete: 'family-name' },
          { name: 'phone', label: 'Mobile number', type: 'tel', required: true, max: 30, placeholder: '09XXXXXXXXX' },
          { name: 'email', label: 'Email address', type: 'email', required: true },
          { name: 'password', label: 'Password', type: 'password', required: true, passwordRules: true },
          { name: 'confirm_password', label: 'Confirm password', type: 'password', required: true },
        ]
      : mode === 'reset'
        ? [
            { name: 'password', label: 'New password', type: 'password', required: true, passwordRules: true },
            { name: 'confirm_password', label: 'Confirm new password', type: 'password', required: true },
          ]
        : [
            { name: 'email', label: 'Email address', type: 'email', required: true },
            ...(mode === 'login'
              ? [{ name: 'password', label: 'Password', type: 'password', required: true, autoComplete: 'current-password' }]
              : []),
          ]
  async function submit(v: Record<string, string>) {
    requireConfiguration()
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: v.email.trim(),
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
      const values = registrationSchema.parse(v)
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { first_name: values.first_name, middle_name: values.middle_name, last_name: values.last_name, full_name: fullName(values), phone: values.phone },
          emailRedirectTo: window.location.origin + '/customer/reservations',
        },
      })
      if (error) throw error
      if (data.session) {
        navigate(roleHome.customer, { replace: true })
        return
      }
      setDone(true)
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(v.email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw error
      setDone(true)
    } else {
      const values = passwordSchema.parse(v)
      if (!auth.session) throw new Error('Open the password reset link in your email first.')
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) throw error
      setDone(true)
      await supabase.auth.signOut({ scope: 'local' })
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
          {mode === 'reset' && auth.loading ? <Loading /> : mode === 'reset' && !done && (authCallback.failed || !auth.session) ? (
            <div>
              <ErrorState error={new Error(authCallback.failed ? 'This reset link is invalid or expired. Request a new email below.' : 'Open the password reset link from your email to choose a new password.')} />
              <Link className="button" to="/forgot-password">Request a new reset link</Link>
            </div>
          ) : done ? (
            <div className="success-card" role="status">
              <CheckCircle2 size={30} />
              <h3>{mode === 'reset' ? 'Password updated' : 'Check your inbox'}</h3>
              <p>
                {mode === 'reset'
                  ? 'Your new password is ready. Sign in with it to continue.'
                  : 'If your address is eligible, you’ll receive an email with the next steps. Follow the link to continue.'}
              </p>
              <Link className="button" to="/login">
                Back to sign in
              </Link>
            </div>
          ) : (
            <Form
              key={mode}
              fields={fields}
              validate={mode === 'register' ? (values) => fieldErrors(registrationSchema, values) : mode === 'reset' ? (values) => fieldErrors(passwordSchema, values) : undefined}
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
