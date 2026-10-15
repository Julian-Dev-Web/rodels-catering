import { useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Clock,
  Database,
  Headphones,
  Image,
  LogOut,
  Menu,
  MessageSquare,
  ReceiptText,
  RotateCcw,
  Settings,
  Star,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { configured, records, rpc, supabase } from '../lib/supabase'
import { navigation, roleHome } from '../lib/permissions'
import { useAuth } from '../features/auth'
import { Action, ErrorState, Loading } from '../components/ui'
import { date, human } from '../lib/format'
import type { Notice } from '../types'
import { PublicAssistant } from '../components/PublicAssistant'
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={'brand ' + (light ? 'light' : '')}
      to="/"
      aria-label="Rodel's Catering home"
    >
      <img className="original-logo" src="/images/logo.png" alt="" />
      <span>
        Rodel’s<small>C A T E R I N G</small>
      </span>
    </Link>
  )
}
export function MaintenanceBoundary({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  const { pathname } = useLocation()
  const query = useQuery({
    queryKey: ['maintenance'],
    enabled: configured,
    queryFn: () =>
      rpc<{ enabled: boolean; message: string; changed_at: string }>(
        'maintenance_state',
      ),
    refetchInterval: 30000,
  })
  if (configured && query.isPending) return <Loading />
  if (query.isError && pathname !== '/login')
    return (
      <main className="container section">
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </main>
    )
  if (
    query.data?.enabled &&
    pathname !== '/login' &&
    !pathname.startsWith('/super-admin') &&
    !pathname.startsWith('/manager')
  ) {
    if (loading) return <Loading />
    if (profile?.role !== 'super_admin')
      return (
        <div className="maintenance-screen">
          <Brand />
          <span
            className="maintenance-spinner"
            role="status"
            aria-label="Maintenance in progress"
          />
          <span className="eyebrow">RODELCONNECT · MAINTENANCE</span>
          <h1>We’ll be back at the table soon.</h1>
          <p>{query.data.message}</p>
          <Link className="button secondary" to="/login">
            Staff sign in
          </Link>
        </div>
      )
  }
  return children
}
export function PublicLayout() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <>
      <header className="public-header">
        <div className="container nav-inner">
          <Brand />
          <button
            className="icon-button mobile-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav className={open ? 'open' : ''} aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/packages">Our packages</NavLink>
            <NavLink to="/gallery">The gallery</NavLink>
            <NavLink to="/about">Our story</NavLink>
            <Link
              className="button small"
              to={profile ? roleHome[profile.role] : '/login'}
            >
              {profile ? 'My dashboard' : 'Plan your event'}
              <ArrowUpRight size={16} />
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="container footer-grid">
          <div>
            <Brand light />
            <p>
              Good food. Thoughtful details.
              <br />
              Moments that bring us together.
            </p>
          </div>
          <div>
            <span className="eyebrow">LET’S CELEBRATE</span>
            <Link to="/packages">Explore our packages</Link>
            <Link to="/login">Start a reservation</Link>
          </div>
          <div>
            <span className="eyebrow">A LITTLE MORE</span>
            <Link to="/about">About & contact</Link>
            <Link to="/terms">Terms and Conditions</Link>
            <Link to="/privacy">Privacy Notice</Link>
            <Link to="/policies">Reservation & refund policies</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Rodel’s Catering</span>
          <span>Made for your moments.</span>
        </div>
      </footer>
      {pathname === '/' && <PublicAssistant />}
    </>
  )
}
const icons: Record<string, typeof CalendarDays> = {
  calendar: CalendarDays,
  date: CalendarDays,
  utensils: UtensilsCrossed,
  wallet: Wallet,
  receipt: ReceiptText,
  cancel: X,
  return: RotateCcw,
  clock: Clock,
  star: Star,
  chat: MessageSquare,
  settings: Settings,
  chart: ChartNoAxesCombined,
  users: Users,
  image: Image,
  database: Database,
}
export function PortalLayout() {
  const { profile } = useAuth(),
    location = useLocation(),
    navigate = useNavigate()
  const [open, setOpen] = useState(false),
    [showNotices, setShowNotices] = useState(false)
  const qc = useQueryClient()
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => navigate('/'),
  })
  const notices = useQuery({
    queryKey: ['notifications', profile?.id],
    enabled: !!profile,
    queryFn: () =>
      records<Notice>('notifications', 'created_at', false, {
        user_id: profile!.id,
      }),
    refetchInterval: 60000,
  })
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('notices-' + profile.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile, qc])
  useEffect(() => setOpen(false), [location.pathname])
  if (!profile) return null
  const role = location.pathname.startsWith('/manager')
    ? 'manager'
    : profile.role
  const unread = notices.data?.filter((n) => !n.read_at).length ?? 0
  const current = navigation[role].find((n) =>
    location.pathname.startsWith(n.path),
  )
  return (
    <div className="portal">
      <button
        className={'sidebar-scrim ' + (open ? 'visible' : '')}
        aria-label="Close menu"
        onClick={() => setOpen(false)}
      />
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <Brand />
        <div className="workspace-label">{human(role)} workspace</div>
        <nav aria-label="Workspace navigation">
          {navigation[role].map((n) => {
            const Icon = icons[n.icon] || CalendarDays
            return (
              <NavLink key={n.path} to={n.path}>
                <Icon size={18} />
                {n.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="sidebar-help">
          <Headphones size={25} />
          <strong>A helping hand</strong>
          <p>
            {role === 'customer'
              ? 'We’re here for your celebration.'
              : 'Keep every celebration running smoothly.'}
          </p>
          <Link
            to={role === 'customer' ? '/customer/support' : '/manager/support'}
          >
            Open support <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{profile.full_name.slice(0, 1) || 'R'}</span>
          <div>
            <strong>{profile.full_name || 'Your account'}</strong>
            <small>{human(profile.role)}</small>
          </div>
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="portal-body">
        <header className="portal-topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>{current?.label || 'Reservation'}</strong>
          </span>
          <div className="topbar-right">
            <Link to="/">
              Visit website <ArrowUpRight size={14} />
            </Link>
            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
              aria-expanded={showNotices}
              onClick={() => setShowNotices(!showNotices)}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </button>
            <span className="avatar small">
              {profile.full_name.slice(0, 1) || 'R'}
            </span>
          </div>
        </header>
        {showNotices && (
          <section className="notification-panel">
            <div className="section-title">
              <h2>Notifications</h2>
              <button
                className="icon-button"
                aria-label="Close notifications"
                onClick={() => setShowNotices(false)}
              >
                <X size={18} />
              </button>
            </div>
            {notices.isPending ? (
              <Loading />
            ) : notices.error ? (
              <ErrorState error={notices.error} />
            ) : notices.data?.length ? (
              notices.data.map((n) => (
                <article key={n.id} className={n.read_at ? '' : 'unread'}>
                  <Link to={n.href} onClick={() => setShowNotices(false)}>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <small>{date(n.created_at)}</small>
                  </Link>
                  {!n.read_at && (
                    <Action
                      label="Mark as read"
                      kind="secondary small notification-read"
                      run={async () => {
                        const { error } = await supabase
                          .from('notifications')
                          .update({ read_at: new Date().toISOString() })
                          .eq('id', n.id)
                          .eq('user_id', profile.id)
                        if (error) throw error
                      }}
                    />
                  )}
                </article>
              ))
            ) : (
              <p>No notifications yet.</p>
            )}
          </section>
        )}
        <main className="portal-content">
          {logout.error && <ErrorState error={logout.error} />}
          <Outlet />
        </main>
        <footer className="portal-footer">
          <span>Rodel’s Catering · Every detail, thoughtfully handled.</span>
          <Link to="/policies">Policies</Link>
        </footer>
      </div>
      {profile.role === 'customer' && <PublicAssistant />}
    </div>
  )
}
