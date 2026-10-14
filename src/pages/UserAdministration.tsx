import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth'
import { records, rpc, edge } from '../lib/supabase'
import { date } from '../lib/format'
import {
  Action,
  Badge,
  DataTable,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import { Form } from '../components/Form'
import type { Profile, RecordRow } from '../types'

export function UserManagement() {
  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => records<Profile>('profiles'),
  })
  const { profile } = useAuth()
  const [role, setRole] = useState('all'),
    [status, setStatus] = useState('all'),
    [target, setTarget] = useState<Profile | null>(null)
  return (
    <>
      <PageHeading
        eyebrow="SUPER ADMIN · USER ADMINISTRATION"
        title="People, roles and account access."
      >
        Search registered profiles, review roles, and suspend or reactivate
        application access. Role changes and account actions are audited.
      </PageHeading>
      <div className="filter-bar">
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {['all', 'customer', 'manager', 'super_admin'].map((v) => (
              <option value={v} key={v}>
                {v.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Account status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {['all', 'active', 'suspended'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={
            query.data.filter(
              (p) =>
                (role === 'all' || p.role === role) &&
                (status === 'all' || p.account_status === status),
            ) as unknown as RecordRow[]
          }
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'phone', label: 'Primary contact' },
            {
              key: 'role',
              label: 'Role',
              render: (r) => <Badge value={String(r.role)} />,
            },
            {
              key: 'account_status',
              label: 'Account status',
              render: (r) => <Badge value={String(r.account_status)} />,
            },
            {
              key: 'created_at',
              label: 'Created',
              render: (r) => date(String(r.created_at)),
            },
            {
              key: 'status_changed_at',
              label: 'Status changed',
              render: (r) =>
                r.status_changed_at ? date(String(r.status_changed_at)) : '—',
            },
          ]}
          actions={(r) => (
            <>
              {r.role !== 'super_admin' && r.id !== profile?.id && (
                <button
                  className="text-button"
                  onClick={() =>
                    setTarget(query.data.find((p) => p.id === r.id)!)
                  }
                >
                  Change role
                </button>
              )}
              {r.id !== profile?.id && (
                <Action
                  label={r.account_status === 'active' ? 'Suspend' : 'Activate'}
                  kind="small secondary"
                  confirm={
                    r.account_status === 'active'
                      ? 'Suspend this account? Protected application access will stop immediately at the server; the current browser will show its status on refresh.'
                      : 'Restore this account’s protected application access?'
                  }
                  run={() =>
                    rpc('admin_account_status', {
                      target_id: r.id,
                      new_status:
                        r.account_status === 'active' ? 'suspended' : 'active',
                    })
                  }
                />
              )}
            </>
          )}
        />
      )}
      <p className="muted">
        Super-admin role assignment remains an operator-managed procedure. You
        cannot demote or suspend yourself, and the last active super admin must
        remain active.
      </p>
      {target && (
        <Modal
          title={'Change access for ' + target.full_name}
          close={() => setTarget(null)}
        >
          <p>
            Managers can read customer booking/payment/support records. Confirm
            the intended access.
          </p>
          <Form
            fields={[
              {
                name: 'target_role',
                label: 'Assign role',
                required: true,
                options: [
                  { label: 'Customer', value: 'customer' },
                  { label: 'Manager', value: 'manager' },
                ],
              },
            ]}
            initial={{ target_role: target.role }}
            label="Confirm role change"
            submit={(v) =>
              edge('admin-set-role', {
                target_id: target.id,
                target_role: v.target_role,
              })
            }
            onSuccess={() => setTarget(null)}
          />
        </Modal>
      )}
    </>
  )
}
