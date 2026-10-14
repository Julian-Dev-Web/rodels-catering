import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { records, rpc } from '../lib/supabase'
import { useAuth } from '../features/auth'
import type { Ticket, Message } from '../types'
import { Action, Badge, Empty, ErrorState, Loading, Modal, PageHeading } from '../components/ui'
import { Form } from '../components/Form'
import { date } from '../lib/format'
export function Support() {
  const { profile } = useAuth(),
    staff = profile?.role !== 'customer'
  const [selected, setSelected] = useState<string | null>(null),
    [open, setOpen] = useState(false)
  const tickets = useQuery({
    queryKey: ['tickets'],
    queryFn: () => records<Ticket>('support_tickets'),
  })
  const messages = useQuery({
    queryKey: ['messages', selected],
    enabled: !!selected,
    queryFn: () =>
      records<Message>('support_messages', 'created_at', true, { ticket_id: selected }),
    refetchInterval: 15000,
  })
  const ticket = tickets.data?.find((t) => t.id === selected)
  return (
    <>
      <PageHeading
        title={staff ? 'A helping hand, when it matters.' : 'Let’s talk about your celebration.'}
        action={
          !staff && (
            <button className="button" onClick={() => setOpen(true)}>
              <Plus size={16} />
              New conversation
            </button>
          )
        }
      >
        Your questions, replies, and the details that matter—all together.
      </PageHeading>
      <div className="support-layout">
        <aside className="panel ticket-list">
          <h2>{staff ? 'Support inbox' : 'Your conversations'}</h2>
          {tickets.isPending ? (
            <Loading />
          ) : tickets.error ? (
            <ErrorState error={tickets.error} />
          ) : tickets.data.length ? (
            tickets.data.map((t) => (
              <button
                className={selected === t.id ? 'selected' : ''}
                key={t.id}
                onClick={() => setSelected(t.id)}
              >
                <strong>{t.subject}</strong>
                <small>{date(t.created_at)}</small>
                <Badge value={t.status} />
              </button>
            ))
          ) : (
            <Empty title="No conversations yet" />
          )}
        </aside>
        <section className="panel thread">
          {ticket ? (
            <>
              <div className="section-title">
                <h2>{ticket.subject}</h2>
                <Badge value={ticket.status} />
              </div>
              {messages.isPending ? (
                <Loading />
              ) : messages.error ? (
                <ErrorState error={messages.error} />
              ) : (
                <div className="messages">
                  {messages.data?.map((m) => (
                    <article className={m.author_id === profile?.id ? 'mine' : ''} key={m.id}>
                      <strong>
                        {m.author_id === profile?.id
                          ? 'You'
                          : m.author_id === ticket.customer_id
                            ? 'Customer'
                            : 'Rodel’s team'}
                      </strong>
                      <p>{m.body}</p>
                      <small>{date(m.created_at)}</small>
                    </article>
                  ))}
                </div>
              )}
              {ticket.status !== 'done' ? (
                <>
                  <Form
                    key={ticket.id}
                    fields={[
                      {
                        name: 'body',
                        label: 'Your reply',
                        type: 'textarea',
                        required: true,
                        max: 5000,
                      },
                    ]}
                    label="Send reply"
                    submit={(v) => rpc('reply_ticket', { tid: ticket.id, body: v.body })}
                  />
                  {staff && (
                    <Action
                      label="Mark resolved"
                      confirm="This closes the conversation and prevents further replies. The customer can start a new ticket if needed."
                      run={() => rpc('resolve_ticket', { tid: ticket.id })}
                    />
                  )}
                </>
              ) : (
                <p className="success">This conversation is resolved.</p>
              )}
            </>
          ) : (
            <Empty title="Make yourself heard">Choose a conversation to read the replies.</Empty>
          )}
        </section>
      </div>
      {open && (
        <Modal title="How can we help?" close={() => setOpen(false)}>
          <Form
            fields={[
              { name: 'subject', label: 'Subject', required: true, max: 150 },
              {
                name: 'body',
                label: 'Tell us about it',
                required: true,
                type: 'textarea',
                max: 5000,
              },
            ]}
            label="Start conversation"
            submit={(v) =>
              rpc<string>('create_ticket', { subject: v.subject, body: v.body }).then((id) =>
                setSelected(id),
              )
            }
            onSuccess={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  )
}
