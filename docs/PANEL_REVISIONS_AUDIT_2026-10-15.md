# Panel revisions inventory — October 15, 2026

Baseline: GitHub main `0cf196c`; hosted schema 0022. This audit precedes implementation. No changes to genuine financial records are authorized by this audit.

| Requirement | Current evidence | Status / gap |
|---|---|---|
| Shared Elegant Chair stock | `0019_consolidated_booking_operations.sql` enforces selected quantity and guest count; capacity guard protects three event slots | Missing cross-reservation equipment inventory and allocation locks |
| Tax/VAT | `booking.ts`, SQL pricing functions, booking/PDF/report summaries show package/setup/features/seating charges | No business tax registration/configuration evidence; no tax snapshot or explicit VAT line |
| Manager discounts/promos | Staff reservation controls and audit exist; no discount tables/RPC/UI found | Missing; implement one non-stacking module with no default invented offers |
| Draft persistence | `booking-draft.ts` restores session drafts; wizard saves server draft after validated steps; customer detail links directly to `/confirm` for Draft | Partial: no persistent incomplete-save action; direct review skips the resume step; a blanket Home redirect is not yet reproduced |
| Food allergy warnings | Existing dish/photo catalog has no allergen relationships; wizard has no allergy declaration fields | Missing; unknown metadata must remain explicitly unknown, never safety-approved |
| D-7 through D-1 reminders | Notifications/audit exist; `send-transactional-email` uses Resend with provider idempotency key | Missing scheduled reminders, durable channel ledger, send-hour settings and opt-out; configured email/sender acceptance must be verified |
| Audit trail | `audit_logs`, private audit helper, protected Super Admin dashboard and operation-specific events | Existing; extend actions rather than duplicate dashboard |
| Regression baseline | 108 tests passed in preceding release; 0022 buffet/Wedding rates and photo UI are deployed | Preserve roles, auth, maintenance, payment/refund rules, location/contact/hours, gallery/chat, readable references and reports |

Inventory policy proposed for implementation: use whole-day stock because event duration/turnaround is not known. Existing `holds_capacity` expresses approved/completed and pending-cancellation holds; inventory follows that confirmed-event policy. Draft/pending requests do not allocate. Stock reductions flag overcommitments rather than cancel bookings. Actual usable quantity, tax treatment and reminder hour are pending explicit business answers; do not assume the example stock or 12% tax.

Draft reproduction and implementation findings, source paths, migrations, actual tests and externally required settings will be appended as work progresses. Do not interpret this inventory as completed implementation or defense meeting minutes.
