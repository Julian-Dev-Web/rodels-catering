# Payment, paid-booking changes and confirmation emails

Implementation and verification date: October 20, 2026. This report describes actual repository changes and tests. Sandbox payments used PayMongo test keys and a disposable customer; no live funds were charged.

## Completed behavior

| Area | Result |
| --- | --- |
| PayMongo status | Signed webhooks and authenticated provider lookups verify the session, reservation/payment metadata, amount, PHP currency and test/live mode. Browser return parameters never prove payment. |
| Customer and Manager refresh | Reservation, payment, transaction and balance subscriptions invalidate their canonical queries. Return handling polls for up to 60 seconds, then presents an unresolved outcome safely. Focus/reconnect refetch provides a fallback. |
| Repeat payment | Existing active checkouts are inspected/reused. A settled partial/full request returns the updated state; a balance checkout collects only the outstanding amount. Buttons share a pending state. |
| Customer payment UI | Clean payment summary, applicable down/full/balance actions, payment history and receipt downloads. Checkout closure/diagnostics remain staff-only. |
| Manual receipts | Staff record actual cash/bank amounts and Manila received dates, with optional reference/note, confirmation, stable request identifier and audit. An installment below 50% is retained without fulfilling the deposit milestone. |
| Corrections | A reasoned, staff-only reversal retains the original receipt and creates a separate ledger entry. Refund-linked/closed receipts cannot be silently voided. |
| Paid-booking changes | Prefilled existing wizard, before/after quotations, optional reason and Manager approval/rejection. Original selections and payments remain unchanged while pending. Request and approval both require at least **3 Manila calendar days** before the event. Date/time changes use the separate reschedule workflow. |
| Approval rules | Recheck active menu counts, guest range, location, hours/capacity, shared seating stock, ingredient acknowledgments and current catalog charges. Retain the original paid discount and tax agreement, including a redeemed one-time offer. A changed quote/recipe requires a fresh customer proposal. |
| Increased/decreased prices | Increase exposes the actual additional balance. Decrease exposes refund due, without recording a fictitious payout or applying cancellation penalties. Original receipt-time quotations remain immutable. |
| Adjustment payouts | Staff approval followed by verified original-PayMongo refunds or an explicitly confirmed cash/bank payout with proof. Provider allocations are claimed once; ambiguous operations block another payout. Completed partial provider refunds immediately update net receipts. |
| Cancellation | Existing five-day cutoff and 10% deduction remain separate. Earlier adjustments/reversals are excluded from the refundable paid basis. Approved manual cancellations have a protected actual-payout recording flow. |
| Notices | Each verified ledger event creates separate Customer and active Manager/Super Admin notices, deduplicated by transaction, recipient and event. Deep links open the correct booking. |
| Emails | Verified ledger events queue customer-account emails in a durable outbox. Immediate dispatch plus a minute retry schedule use the existing private Vault token. Provider acceptance IDs, bounded retries and ambiguous outcomes are recorded. Staff can request safe retries. |
| Detailed confirmation | Email states the verified amount/method, reservation reference, event date/time, package, guests, venue, dishes, drink, dessert, setup/seating, discount/VAT, agreed total, deposit and receipt-time balance. It links to the current reservation. |
| PayMongo receipt | `send_email_receipt` remains enabled; billing is prefilled from the authenticated account email. PayMongo's hosted page can accept its own billing details. RodelConnect's own confirmation recipient is independently bound to the reservation's customer account. |
| Reporting/archives | Financial exports separate received, actually refunded and reversed amounts; report net receipts, balance/refund due and approved revisions. Security-invoker reservation view exposes the added fields. Application archives include all **54 public application tables** and the matching installer. |

Net verified paid = gross verified receipts − completed refunds − mistaken-entry reversals. Balance and refund due are derived separately from that value; refunds are not subtracted twice. All authoritative calculations use integer centavos in PostgreSQL.

## Database migrations

Apply incremental updates in order; **never rerun `setup.sql` against an existing project**. Hosted deployment of these updates was performed during this task.

| Migration | Changes |
| --- | --- |
| `0035_payment_ledger_realtime.sql` | Add receipt source/method/date/operator, idempotency and quote snapshots; reversal ledger; server payment summary; manual receipts/void; transactional notices; financial email outbox/leases/retries; Realtime publication. |
| `0036_paid_booking_changes.sql` | Versioned requests/decisions, server quote previews and approval, agreed-price snapshots, adjustment refunds/manual payouts, cancellation/manual refund integration, readable activity. |
| `0037_payment_reporting_integration.sql` | Append net-payment fields to the existing RLS-preserving summary view; use net verified receipts for event completion. |
| `0038_adjustment_provider_refunds.sql` | Claimed original-payment refund allocations; verified partial/success accounting; manual/provider concurrency guard; detailed new-receipt reservation snapshots. |

No historical payment amount, provider reference or original agreed quotation was rewritten. Migrations add columns/tables; existing financial state remains intact. `paid` continues to represent gross receipts, with the separate reversal/refund fields used for net calculations. Existing historical receipts lacking a receipt-time quote are identified honestly rather than assigned an invented snapshot.

Preview uses the existing authoritative catalog validators/calculators inside a rolled-back PostgreSQL subtransaction. Proposed selections, allocations, audits and timestamps never become visible or persistent. Approval performs the same checks again under locks and records a versioned change.

## Modified application files

- `src/components/PaymentPanel.tsx`: canonical totals, customer checkout/verification, manual receipt/correction dialogs, readable receipt history and protected email delivery monitor.
- `src/components/BookingChanges.tsx`: request comparison, approval and adjustment payout actions.
- `src/components/CancellationPayout.tsx`: explicit actual cash/bank cancellation payout.
- `src/pages/ReservationWizard.tsx`, `src/lib/booking-validation.ts`, `src/app/router.tsx`: reuse the existing wizard for paid proposals; retain step validation, counters and local edits; normalize selection identity across validation steps.
- `src/pages/Customer.tsx`, `src/components/BookingDetails.tsx`: integrate payment/change/refund panels and net-paid documents.
- `src/features/payments.ts`, `src/features/reservations.ts`, `src/layouts/Layouts.tsx`: financial queries, subscriptions and reconnect/focus refetch.
- `src/pages/Admin.tsx`: reservation notification deep links, manual cancellation payouts and net-paid completion controls.
- `src/pages/Reports.tsx`, `src/lib/reports.ts`, `src/lib/payments.ts`, `src/types.ts`, `src/styles.css`: net/reversal reporting, centavo input, Manila dates, responsive panels and types.
- Supabase checkout, reconciliation and webhook functions plus shared `http.ts`, `checkout-reconciliation.ts`, `reconcile-payment.ts`: secure verification, duplicate/race handling and readable database errors.
- New `dispatch-payment-emails`, `process-adjustment-refund`, and `_shared/payment-email.ts`: authenticated financial dispatch/provider payout and detailed reservation emails.
- `supabase/config.toml`, `package.json`: function configuration and Edge typechecks.
- Generated `supabase/updates/0035…0038`, `supabase/setup.sql`, `_shared/backup-schema.ts`: incremental updates, fresh installer and matching archive installer.
- `tests/database.test.ts`, `tests/payment-revisions.test.ts`, `tests/consolidated.test.ts`: financial/approval/refund security, idempotency, normalized quote identity, email content and reporting regression tests.

## Test evidence

- **220 automated tests passed**, including 139 PostgreSQL integration tests executed against the bundled migrations. The suite also covers existing auth, discounts, inventory, allergens, reminders and booking validation.
- Production TypeScript/build and ESLint passed. Deno checked all **11 Edge entrypoints**. Existing build warnings concern dependency comments, mixed import splitting and bundle size; the build completed.
- Two independent Chrome profiles used the real hosted backend while viewing the production frontend build. Actual PayMongo sandbox card captures showed partial and full/balance payments on both Customer and Manager without reload.
- Repeated partial/full clicks after settlement returned current verified state. A forged webhook returned HTTP 401. The test produced one receipt per actual captured provider payment.
- Manager entered a controlled PHP 5,000 cash receipt. Both browsers displayed it without refresh. The customer used the prefilled wizard to request 110 guests; Manager approved and the customer saw the additional balance.
- Receipt-time quotes remained intact after approval. Desktop and 390-pixel mobile payment panels were inspected for overflow.
- A further genuine sandbox capture collected only PHP 3,300 after a price increase. Billing matched the authenticated QA account. The resulting receipt captured package, 110 guests and three dish names.
- Reducing that quote exposed PHP 3,300 refund due without an automatic payout. The actual sandbox PayMongo refund progressed to **completed**. Final net receipts were PHP 33,000, completed refunds PHP 3,300 and refund due zero; no cancellation fee was applied.
- Customer financial emails were queued promptly. The real worker deliberately blocked delivery to the disposable `.invalid` QA address with `non_deliverable_test_recipient`, rather than emailing an unrelated address. Hosted Resend/sender/APP_URL configuration was present. Actual customer inbox/spam delivery of the new detailed template is **not yet verified**; provider acceptance and inbox delivery are separate claims.
- Protected-row comparisons found existing customer, reservation, discount, payment, refund, balance and related financial records unchanged. Concurrent recipe updates by a different staff account were observed in the dish audit trail and retained; those legitimate catalog edits were not overwritten.

## Configuration and operational notes

- Production frontend: `https://www.rodelscatering.online`; backend functions and incremental schema deployed to the linked project.
- Internal `rodel-payment-confirmations` Cron job is enabled every minute. Immediate transaction kicks and periodic retry use `rodel_reminder_worker_secret` already held in Vault. Existing daily reminder scheduling remains intact.
- Keep `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` and internal worker tokens in backend secrets. No browser secret or real account credential is included in this report/repository changes.
- PayMongo remains in **test mode**. Live method availability, business activation, fees and live refund restrictions require provider/account confirmation. Successful sandbox captures/refunds do not prove live money movement.
- The configured VAT breakdown still awaits business/accounting confirmation. Downloaded records are system-generated payment/quotation records, not certified BIR tax invoices.
- Ambiguous provider creation/refund results retain their claims. Staff must inspect provider records before resolving them; the app does not create another payout merely because a request timed out. A permanently failed provider operation with an existing refund ID needs operator reconciliation before a manual replacement.
- Booking revisions require currently available catalog selections and configured usable stock. Unconfigured Monoblock stock was not guessed; QA used only the already configured Elegant Chair inventory.
- Confirmation email dispatch is distinct from daily upcoming-event reminders. Existing reminder channel preferences and schedules were preserved.

## Reproducible manual QA

1. In a test account, finalize a complete future booking, then pay 50% using PayMongo's test checkout. Keep Customer and Manager booking details open. Confirm both update and show the same receipt/balance without reload.
2. Reopen the booking and attempt the previous partial/full action. It should show current state. Pay only the outstanding balance and check a second, distinct verified receipt.
3. With a separate controlled booking, use Manager → Reservations → details → Record manual payment. Confirm amount, method and Manila received date; save twice with the same request to check deduplication. Correct a deliberately mistaken entry through the protected void action.
4. Customer → booking → Request changes. Alter guests/setup/seating, review the quote and submit. Confirm the saved booking is unchanged until Manager approves. Check changed stock/recipe/catalog inputs block stale approval safely.
5. For a fully paid booking, approve a decrease and confirm refund due. Request and approve an adjustment refund. Use original-PayMongo processing when supported, or record a separately verified actual cash/bank payout with proof. Confirm each completed payout reduces net funds once.
6. In staff booking details, inspect Customer payment email delivery. Queue/attempt/blocked/accepted states must reflect the provider outcome. Retry only eligible failed jobs. Use an authorized real customer inbox to check the detailed confirmation and spam folder; never use an unrelated test email.
7. Review reports for received/refunded/reversed/net amounts and current refund due. Compare original receipt PDFs against the current revised booking summary.

## Consulted primary references

- PayMongo. [Hosted Checkout and email receipt behavior](https://docs.paymongo.com/docs/payment-channels-hosted-checkout).
- PayMongo. [Checkout session resource, billing, metadata and payments](https://docs.paymongo.com/reference/checkout-session-resource).
- PayMongo. [Checkout key concepts and safe active-session reuse](https://docs.paymongo.com/docs/payment-channels-key-concepts).
- PayMongo. [Webhook event types](https://docs.paymongo.com/docs/developer-tools-webhooks-events).
- PayMongo. [Test-mode cards and payment testing](https://docs.paymongo.com/docs/payment-acceptance-testing).
- PayMongo. [Refund transaction guidance](https://developers.paymongo.com/v1/docs/refunding-transactions). Current sandbox capability was verified through the actual refund API, rather than assumed from older documentation.
- Resend. [Email idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys). Retries reuse the persisted payload/key and stop before the provider's idempotency window expires.

Cleanup verification: the two disposable bookings, test receipt/refund records, queued email jobs and 60 associated fixture notifications were removed. Audit history and PayMongo's sandbox records remain. All original rows across the ten protected customer/financial tables matched their pre-migration hashes after cleanup. The secured archive was generated successfully with 54 tables, schema version `0038_adjustment_provider_refunds.sql`, and an installer exactly matching `supabase/setup.sql`.
