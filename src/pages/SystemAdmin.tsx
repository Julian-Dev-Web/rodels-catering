import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Download, Image, ShieldCheck, Users, UtensilsCrossed } from 'lucide-react'
import { edge, rpc, supabase } from '../lib/supabase'
import { date, human } from '../lib/format'
import { DataTable, Empty, ErrorState, Loading, PageHeading } from '../components/ui'
import { Stat } from './Customer'
import type { RecordRow } from '../types'

interface Overview {
  users: number; customers: number; managers: number; super_admins: number
  menus: number; published_photos: number; featured_photos: number; maintenance: boolean
  last_export: string | null; recent_activity: { action: string; created_at: string }[]
}
export function SystemOverview() {
  const query = useQuery({ queryKey: ['system-overview'], queryFn: () => rpc<Overview>('system_overview'), refetchInterval: 60000 })
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const data = query.data
  return <>
    <PageHeading eyebrow="SUPER ADMIN · SYSTEM MANAGEMENT" title="Your system, at a glance.">Manage user access, pricing, published content and recovery. Managers handle daily reservations, payments and support.</PageHeading>
    <div className="stat-grid four">
      <Stat label="Registered users" value={data.users} icon={<Users />} />
      <Stat label="Active set menus" value={data.menus} icon={<UtensilsCrossed />} />
      <Stat label="Published gallery photos" value={data.published_photos} icon={<Image />} />
      <Stat label="Customer access" value={data.maintenance ? 'Maintenance' : 'Open'} icon={<ShieldCheck />} />
    </div>
    <div className="system-grid">
      <section className="panel"><h2>User access</h2><dl className="system-counts"><div><dt>Customers</dt><dd>{data.customers}</dd></div><div><dt>Managers</dt><dd>{data.managers}</dd></div><div><dt>Super admins</dt><dd>{data.super_admins}</dd></div></dl><Link className="text-button" to="/super-admin/users">Manage user roles →</Link></section>
      <section className="panel"><h2>Backups & recovery</h2><p>Last application export generated: <strong>{data.last_export ? date(data.last_export) : 'No export recorded'}</strong></p><p>Generate a private data archive and open the Supabase database backup tools.</p><Link className="button secondary" to="/super-admin/backups"><Database size={17} /> Open backup tools</Link></section>
      <section className="panel"><h2>Website & catalog</h2><p>{data.featured_photos} photos are marked for the landing-page showcase. Keep set-menu prices and event upgrades current.</p><div className="actions"><Link className="button secondary small" to="/super-admin/gallery">Manage showcases</Link><Link className="button secondary small" to="/super-admin/packages">Manage packages</Link></div></section>
      <section className="panel"><h2>System controls</h2><p>Set maintenance access, review refund policy settings and inspect the audit trail.</p><div className="actions"><Link className="button secondary small" to="/super-admin/maintenance">System settings</Link><Link className="button secondary small" to="/super-admin/audit-logs">Audit trail</Link></div></section>
    </div>
    <section className="panel"><h2>Recent system activity</h2>{data.recent_activity.length ? <ul className="system-activity">{data.recent_activity.map((item, i) => <li key={i}><span>{human(item.action.replaceAll('.', ' '))}</span><time>{date(item.created_at)}</time></li>)}</ul> : <Empty title="No activity recorded yet" />}</section>
    <p className="muted system-operations">Need to review catering operations? <Link className="text-button" to="/manager/dashboard">Open the manager workspace →</Link></p>
  </>
}

interface ExportFile { filename: string; file_content: string; sha256: string; row_count: number; table_count: number }
export function Backups() {
  const qc = useQueryClient()
  const history = useQuery({ queryKey: ['backup-history'], queryFn: async () => {
    const { data, error } = await supabase.from('audit_logs').select('id,created_at,details').eq('action','backup.application_export_created').order('created_at', { ascending: false }).limit(25)
    if (error) throw error
    return data.map((entry) => ({ ...entry, ...(entry.details as Record<string, unknown>) })) as RecordRow[]
  } })
  const download = useMutation({ mutationFn: async () => {
    const result = await edge<ExportFile>('export-application-data', {})
    const bytes = new TextEncoder().encode(result.file_content)
    const actualHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2,'0')).join('')
    if (actualHash !== result.sha256) throw new Error('Export checksum did not match. Please retry.')
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename
    document.body.append(anchor); anchor.click(); anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    return { sha256: result.sha256, row_count: result.row_count, table_count: result.table_count }
  }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['backup-history'] }); void qc.invalidateQueries({ queryKey: ['system-overview'] }) } })
  return <>
    <PageHeading eyebrow="SUPER ADMIN · BACKUPS & RECOVERY" title="Keep a copy. Have a recovery plan.">Generate an application-data archive or use Supabase for a full database backup and recovery.</PageHeading>
    <div className="system-grid">
      <section className="panel"><Database className="system-panel-icon" /><h2>Application data export</h2><p>Download public application records, including profiles, reservations, catalog, payments, support and audit logs, as one JSON file.</p><p><strong>Scope:</strong> excludes Auth login accounts and credentials, actual image files, database schema and server secrets. It requires the matching migrations and operator review to restore.</p><p>Store this private file securely. The export contains customer records.</p><button className="button" disabled={download.isPending} onClick={() => download.mutate()}><Download size={17} />{download.isPending ? 'Preparing export…' : 'Download application data'}</button>
        {download.error && <ErrorState error={download.error} />}
        {download.data && <div className="backup-result" role="status"><strong>Download started · checksum verified</strong><p>{download.data.row_count} records across {download.data.table_count} tables. Check your browser downloads and save the file securely.</p><small>SHA-256</small><code>{download.data.sha256}</code></div>}
      </section>
      <section className="panel"><ShieldCheck className="system-panel-icon" /><h2>Full database & file recovery</h2><p>Database backups are managed in the Supabase project dashboard. Available backups and retention depend on the project plan.</p><p>Verify that a database backup exists, copy Storage files separately, and keep server configuration securely. Test recovery in a separate project before restoring production.</p><div className="actions"><a className="button secondary" href="https://supabase.com/dashboard/project/azjzapendjsfouysueiw/database/backups" target="_blank" rel="noreferrer">Open Supabase backups ↗</a><a className="text-button" href="https://supabase.com/docs/guides/platform/backups" target="_blank" rel="noreferrer">Official backup guide ↗</a></div><p className="muted">A Supabase project operator account is required. Provider backup status is not monitored by this app.</p></section>
    </div>
    <section className="panel"><h2>Exports generated</h2><p className="muted">The server records generation. Browser download completion and off-site storage require your confirmation.</p>{history.isPending ? <Loading /> : history.error ? <ErrorState error={history.error} /> : <DataTable rows={history.data} columns={[{key:'created_at',label:'Generated',render:(r) => date(String(r.created_at))},{key:'filename',label:'File'},{key:'row_count',label:'Records'},{key:'table_count',label:'Tables'}]} />}</section>
  </>
}
