import type { ReactNode } from 'react'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  Check,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react'
import { human, message } from '../lib/format'
import type { RecordRow } from '../types'
export function Loading() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>Preparing everything for you…</p>
    </div>
  )
}
export function Empty({
  title = 'Nothing here yet',
  children,
}: {
  title?: string
  children?: ReactNode
}) {
  return (
    <div className="state empty">
      <span className="empty-icon">✧</span>
      <h3>{title}</h3>
      <p>{children || 'New activity will appear here.'}</p>
    </div>
  )
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  return (
    <div className="alert error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We couldn’t complete that</strong>
        <p>{message(error)}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
export function Badge({ value }: { value: string }) {
  return <span className={'badge status-' + value}>{human(value)}</span>
}
export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">
          {eyebrow || 'YOUR CELEBRATIONS, SIMPLIFIED'}
        </span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}
export function Action({
  label,
  run,
  onSuccess,
  kind = 'secondary',
  confirm,
}: {
  label: string
  run: () => Promise<unknown>
  onSuccess?: () => void
  kind?: string
  confirm?: string
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: () => {
      void qc.invalidateQueries()
      setOpen(false)
      onSuccess?.()
    },
  })
  return (
    <>
      <button
        className={kind === 'text-button' ? 'text-button' : 'button ' + kind}
        disabled={mutation.isPending}
        onClick={() => (confirm ? setOpen(true) : mutation.mutate())}
      >
        {mutation.isPending ? (
          <LoaderCircle size={16} className="spin" />
        ) : null}
        {label}
      </button>
      {mutation.isError && <ErrorState error={mutation.error} />}{' '}
      {open && (
        <Modal title={label} close={() => setOpen(false)}>
          <p>{confirm}</p>
          <div className="actions">
            <button className="button secondary" onClick={() => setOpen(false)}>
              Go back
            </button>
            <button
              className="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Confirm {label.toLowerCase()}
            </button>
          </div>
        </Modal>
      )}
      {mutation.isSuccess && !confirm && (
        <span className="success-inline" role="status">
          <Check size={14} /> Done
        </span>
      )}
    </>
  )
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
          if (e.key === 'Tab') {
            const items = Array.from(
              panel.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
              ) || [],
            )
            const first = items[0],
              last = items.at(-1)
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last?.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <button
          autoFocus
          className="icon-button modal-close"
          aria-label="Close dialog"
          onClick={close}
        >
          <X />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  )
}
export function DataTable({
  rows,
  columns,
  actions,
  searchValue,
  onSearchChange,
}: {
  rows: RecordRow[]
  columns: {
    key: string
    label: string
    render?: (row: RecordRow) => ReactNode
  }[]
  actions?: (row: RecordRow) => ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
}) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState<{ key: string; ascending: boolean } | null>(null)
  const term = searchValue ?? search
  const filtered = useMemo(() => {
    const result = rows.filter((r) =>
      Object.values(r).some(
        (v) =>
          (typeof v === 'string' || typeof v === 'number') &&
          String(v).toLowerCase().includes(term.toLowerCase()),
      ),
    )
    if (sort)
      result.sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key]
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x ?? '').localeCompare(String(y ?? ''), undefined, {
                numeric: true,
              })
        return sort.ascending ? order : -order
      })
    return result
  }, [rows, term, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  return (
    <div className="table-panel">
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search records"
            placeholder="Search records…"
            value={term}
            onChange={(e) => {
              setSearch(e.target.value)
              onSearchChange?.(e.target.value)
              setPage(0)
            }}
          />
        </label>
        <label>
          Rows per page
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(0)
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <span className="muted" aria-live="polite">
          {filtered.length} records
        </span>
      </div>
      {filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    aria-sort={
                      sort?.key === c.key
                        ? sort.ascending
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => {
                        setSort({
                          key: c.key,
                          ascending:
                            sort?.key === c.key ? !sort.ascending : true,
                        })
                        setPage(0)
                      }}
                    >
                      {c.label}
                      {sort?.key === c.key
                        ? sort.ascending
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </button>
                  </th>
                ))}
                {actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(current * pageSize, current * pageSize + pageSize)
                .map((row) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td key={c.key}>
                        {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                      </td>
                    ))}
                    {actions && (
                      <td>
                        <div className="row-actions">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No matching records" />
      )}
      <div className="pagination">
        <button
          className="button small secondary"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </button>
        <span>
          {current + 1} / {pages}
        </span>
        <button
          className="button small secondary"
          disabled={current >= pages - 1}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
