# Daily manager preparation reminders

Active managers receive separate reminders for every approved event from seven days through one day before its saved event date. In-app and email channels follow each manager's own preferences under **Manager > Settings > Manager preparation reminders**. Customer reminders remain scoped to the customer's own bookings and preferences. Managers open **Upcoming preparation** from their reminder. Super admins are not added to this broadcast.

The existing Cron job runs every five minutes. The first successful eligible tick at or after **07:00 Asia/Manila** handles that day's reminders. No event-day reminder or burst of missed prior-day messages is generated. The specifically requested manager account has both channels enabled. This rollout does not enable email for other managers or customers.

## Implementation and deployment

- Incremental migration `0028_manager_event_reminders.sql` adds the recipient and audience to the existing reminder ledger. The uniqueness key is reservation, reminder day, channel and recipient. It preserves previous sent customer history.
- The dispatcher resolves the recorded recipient's Auth email. It does not fall back to the reservation owner for a manager message. Leases, immutable retry payloads and provider idempotency remain in place.
- RLS limits customers and managers to their own delivery rows; super admins retain oversight. Opt-out, suspension, role changes, rescheduling and cancellation stop eligible unsent messages. Already accepted email cannot be recalled.
- Hosted migration, dispatcher and archive function are deployed together. The archive contains schema 0028 and 46 public tables. Fresh-project SQL and embedded recovery schema were regenerated. Do not rerun setup or installed migrations on the connected project.

## Verification and remaining observation

All 126 tests passed, including 78 database tests. New cases cover distinct customer/manager recipients, multiple managers, recipient RLS, repeated ticks, D-7 through D-1 boundaries, opt-out isolation, suspension/role changes, rescheduling and completion. Type checks, lint, production build and all eight Edge Function type checks passed.

Hosted checks confirmed the enabled 07:00 schedule, both requested manager channels, preserved historical customer sent reminders, and unchanged existing reservation/financial records across six tables. Customer preferences were only read during verification. Provider acceptance from the earlier authorized setup email is a separate transport check.

The GitHub release was pushed and its matching Vercel bundle verified on the custom domain. Authenticated production browser checks passed for the manager reminder heading and enabled channels, desktop/mobile Settings layout, updated Upcoming preparation text, and unchanged customer reminder wording. The internal worker rejected an unauthenticated call; an authorized pre-07:00 tick queued and sent zero reminders. The active five-minute Cron job reported a successful latest run.

The release occurred before 07:00 Manila on October 17. The approved October 22 event is five days away on that date. Do not claim its new manager daily email has already been delivered. At or after 07:00, inspect the manager bell, the recipient's ledger status/provider acceptance, Resend logs, and the inbox/spam folder. Provider acceptance alone is not proof of inbox receipt.
