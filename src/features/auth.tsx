import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router-dom'
import { authCallback, configured, supabase } from '../lib/supabase'
import { canVisit, roleHome } from '../lib/permissions'
import type { Profile } from '../types'
import { ErrorState, Loading } from '../components/ui'
type Auth = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: unknown
  recovery: boolean
  refresh: () => void
}
const Context = createContext<Auth>({
  session: null,
  profile: null,
  loading: true,
  error: null,
  recovery: false,
  refresh: () => {},
})
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(configured)
  const [recovery, setRecovery] = useState(authCallback.recovery)
  const [sessionError, setSessionError] = useState<unknown>(null)
  const client = useQueryClient()
  useEffect(() => {
    if (!configured) return
    let active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, value) => {
      if (!active) return
      setSession(value)
      setBooting(false)
      setSessionError(null)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      client.removeQueries({
        predicate: (q) =>
          q.queryKey[0] !== 'catalog' && q.queryKey[0] !== 'maintenance',
      })
    })
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        setSession(data.session)
        setSessionError(error)
        setBooting(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setSessionError(error)
        setBooting(false)
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])
  const profile = useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single()
      if (error) throw error
      return data as Profile
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  })
  useEffect(() => {
    if (!configured || !session?.user.id) return
    const userId = session.user.id
    const channel = supabase
      .channel('account-status-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'id=eq.' + userId,
        },
        () => {
          void client.invalidateQueries({ queryKey: ['profile', userId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user.id, client])
  return (
    <Context.Provider
      value={{
        session,
        profile: profile.data ?? null,
        loading: booting || (!!session && profile.isPending),
        error: sessionError ?? profile.error,
        recovery,
        refresh: () => void profile.refetch(),
      }}
    >
      {children}
    </Context.Provider>
  )
}
export const useAuth = () => useContext(Context)
export function RoleGuard({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    location = useLocation()
  if (auth.loading) return <Loading />
  if (!auth.session)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    )
  if (auth.error) return <ErrorState error={auth.error} retry={auth.refresh} />
  if (!auth.profile)
    return (
      <ErrorState
        error={new Error('Your profile could not be loaded. Contact support.')}
      />
    )
  if (auth.profile.account_status === 'suspended')
    return (
      <main className="container section">
        <ErrorState
          error={
            new Error(
              'This account is suspended. Contact Rodel’s Catering through the website contact page to request a review.',
            )
          }
        />
        <a className="button secondary" href="/about">
          Contact the team
        </a>
        <button
          className="text-button"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </main>
    )
  if (!canVisit(auth.profile.role, location.pathname))
    return <Navigate to={roleHome[auth.profile.role]} replace />
  return children
}
