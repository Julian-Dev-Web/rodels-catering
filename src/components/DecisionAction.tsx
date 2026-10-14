import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorState, Modal } from './ui'
export const rejectionSuggestions = [
  'Selected event date is no longer available.',
  'We cannot accommodate the requested schedule.',
  'Requested catering setup is unavailable.',
  'Guest count exceeds current capacity.',
  'We need clarification of some reservation details.',
  'We cannot accommodate this reservation at this time.',
]
export function RejectionAction({
  run,
}: {
  run: (reason: string | null) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => run(reason.trim() || null),
    onSuccess: () => {
      setOpen(false)
      setReason('')
      void qc.invalidateQueries()
    },
  })
  return (
    <>
      <button
        className="button small secondary"
        onClick={() => {
          setReason('')
          mutation.reset()
          setOpen(true)
        }}
        disabled={mutation.isPending}
      >
        Reject
      </button>
      {open && (
        <Modal
          title="Review rejection"
          close={() => {
            if (!mutation.isPending) setOpen(false)
          }}
        >
          <p>
            Confirm rejection after reviewing the booking. A reason is optional;
            any supplied reason will be visible to the customer and recorded in
            history.
          </p>
          <label>
            Suggested reply
            <select value="" onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose an editable suggestion</option>
              {rejectionSuggestions.map((text) => (
                <option key={text}>{text}</option>
              ))}
            </select>
          </label>
          <label>
            Reason · optional
            <textarea
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </label>
          {mutation.error && <ErrorState error={mutation.error} />}
          <div className="actions">
            <button
              className="button secondary"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Recording decision…' : 'Confirm rejection'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
