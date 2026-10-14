import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Action,
  Badge,
  DataTable,
  ErrorState,
  Loading,
  PageHeading,
} from '../components/ui'
import { date, dateTime, human } from '../lib/format'
import { rpc, supabase } from '../lib/supabase'
import { Stat } from './Customer'
import { ShieldCheck, Users } from 'lucide-react'
import type { RecordRow } from '../types'

export interface MaintenanceState {
  enabled: boolean
  message: string
  changed_at: string
}
export function Maintenance() {
  const query = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => rpc<MaintenanceState>('maintenance_state'),
    refetchInterval: 30000,
  })
  const [message, setMessage] = useState<string | null>(null)
  return (
    <>
      <PageHeading
        eyebrow="SUPER ADMIN · WEBSITE MAINTENANCE"
        title="Manage website availability."
      >
        Pause public and customer operations while retaining secure
        administrative access.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <section className="panel form">
          <h2>Maintenance mode</h2>
          <Badge value={query.data.enabled ? 'active' : 'disabled'} />
          <p>Last changed: {dateTime(query.data.changed_at)} Manila</p>
          <label>
            Maintenance message · optional
            <textarea
              maxLength={500}
              value={message ?? query.data.message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <Action
            label={
              query.data.enabled ? 'Disable maintenance' : 'Enable maintenance'
            }
            confirm={
              query.data.enabled
                ? 'Reopen public browsing, bookings and checkout?'
                : 'Pause public and customer use? Super admins retain secured access. Staff operational review and verified provider callbacks remain available.'
            }
            run={() =>
              rpc('configure_maintenance', {
                enabled: !query.data.enabled,
                message: message ?? query.data.message,
              })
            }
          />
          <Action
            label="Save message"
            kind="small secondary"
            run={() =>
              rpc('configure_maintenance', {
                enabled: query.data.enabled,
                message: message ?? query.data.message,
              })
            }
          />
          <p className="muted">
            Existing payment/refund callbacks keep processing. Managers retain
            operational review access. Booking and new customer checkout are
            blocked by server rules.
          </p>
        </section>
      )}
    </>
  )
}
export function RolePermissions() {
  return (
    <>
      <PageHeading
        eyebrow="SUPER ADMIN · SECURITY"
        title="Roles and permissions."
      >
        These permissions describe the enforced application roles; this screen
        does not grant arbitrary database privileges.
      </PageHeading>
      <DataTable
        rows={[
          {
            id: 'customer',
            role: 'customer',
            scope:
              'Own reservations, contacts, payments, requests, feedback and support',
            restricted:
              'No staff routes or privileged account/system operations',
          },
          {
            id: 'manager',
            role: 'manager',
            scope:
              'Operational reservations, reviews, reports, approved operating hours and menu-library entries',
            restricted:
              'No user roles, account suspension, backups, maintenance/security settings or gallery publishing',
          },
          {
            id: 'super_admin',
            role: 'super_admin',
            scope:
              'User access, catalog pricing, gallery, maintenance, application backup, audit and operational oversight',
            restricted:
              'Auth credential/Storage recovery requires a Supabase project operator; self suspension/demotion is prohibited',
          },
        ]}
        columns={[
          { key: 'role', label: 'Role' },
          { key: 'scope', label: 'Allowed access' },
          { key: 'restricted', label: 'Restrictions' },
        ]}
      />
      <section className="panel">
        <h2>Where permissions are enforced</h2>
        <p>
          React route guards, current account status, Supabase row-level
          security and authenticated database/Edge operations enforce access
          together. Public registration always creates a customer profile.
        </p>
        <Link className="button secondary" to="/super-admin/users">
          Manage eligible user roles
        </Link>
      </section>
    </>
  )
}
export function SecurityMonitoring() {
  const overview = useQuery({
    queryKey: ['system-overview'],
    queryFn: () =>
      rpc<{ active_accounts: number; suspended_accounts: number }>(
        'system_overview',
      ),
  })
  const audit = useQuery({
    queryKey: ['security-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id,action,created_at')
        .in('action', [
          'role.changed',
          'account.status_changed',
          'maintenance.changed',
          'backup.application_export_created',
        ])
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as RecordRow[]
    },
  })
  return (
    <>
      <PageHeading
        eyebrow="SUPER ADMIN · SECURITY"
        title="Administrative security activity."
      >
        Inspect account status and recorded privileged actions. Sign-in failures
        and infrastructure alerts are reviewed separately in Supabase
        Auth/platform logs.
      </PageHeading>
      {overview.data && (
        <div className="stat-grid">
          <Stat
            label="Active accounts"
            value={overview.data.active_accounts}
            icon={<Users />}
          />
          <Stat
            label="Suspended accounts"
            value={overview.data.suspended_accounts}
            icon={<ShieldCheck />}
          />
        </div>
      )}
      {overview.error && <ErrorState error={overview.error} />}
      {audit.isPending ? (
        <Loading />
      ) : audit.error ? (
        <ErrorState error={audit.error} />
      ) : (
        <DataTable
          rows={audit.data}
          columns={[
            {
              key: 'action',
              label: 'Action',
              render: (r) => human(String(r.action).replaceAll('.', ' ')),
            },
            {
              key: 'created_at',
              label: 'Recorded',
              render: (r) => date(String(r.created_at)),
            },
          ]}
        />
      )}
      <a
        className="text-button"
        href="https://supabase.com/dashboard/project/azjzapendjsfouysueiw/logs/auth-logs"
        target="_blank"
        rel="noreferrer"
      >
        Open Supabase Auth logs ↗
      </a>
    </>
  )
}
