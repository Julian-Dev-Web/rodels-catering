# Customer Management and discount lifecycle V2 — completion report

This report supersedes the account-discount UI/lifecycle descriptions in `UNIFIED_DISCOUNT_INVENTORY_BOOKING_2026-10-20.md`. Earlier inventory, allergy and booking features were inspected and retained. No customer accounts, existing reservations or verified payments were replaced.

## Customer Management

Manager > Customer Management now contains one searchable, paginated customer directory. It obtains real registered names/emails through a staff-only database function. There is no customer-selection dropdown or separate assignment form above the table.

Each row shows the assigned percentage, ongoing/one-time type, expiration, lifecycle status and Assign/Edit/Remove actions. The dialog preselects that customer and contains 5/10/15/20% presets, a validated custom percentage, two usage choices, optional date and a readable summary. Removal requires confirmation. Notifications appear after the database commits and the directory refreshes. Assigning a new offer after removal/expiry/use starts with ongoing/no expiration; editing an active offer retains its saved configuration. Stale concurrent manager edits are rejected instead of silently overwriting newer assignments.

The existing campaign module and `/manager/discounts` route remain functional; the manager navigation calls it **Promotions**. Explicit promotions continue to take precedence without stacking. Removing an explicit promotion restores the eligible account adjustment and its lifecycle metadata immediately.

## Database migration and financial rules

`supabase/migrations/0031_discount_lifecycle.sql` is authoritative. The generated existing-project update is `supabase/updates/0031_discount_lifecycle.sql`; the full fresh-project installer and archive schema were regenerated. **Do not run setup.sql against an existing project.**

The incremental migration adds:

- `customer_discount_assignments`: versioned percentage, usage type, optional expiration, actor, assignment/removal timestamps, pending payment hold and verified redemption references. Older versions remain available for history/audit.
- `profiles.account_discount_id`: one current assignment per account; existing profile percentage fields and staff RPCs remain compatible.
- `reservation_discounts.account_assignment_id`: links a saved account adjustment to the exact version. Existing paid snapshots and legacy pending checkout agreements are not rewritten.
- RLS and select-only authenticated access to permitted assignment records. Customers cannot write offers, read the staff email directory, call service payment verification or release holds directly.
- `save_customer_discount`: authorized row-dialog assignment/removal with expected-version conflict protection; the existing setters remain compatible ongoing-offer integrations.
- `my_account_discount`: owner-only authoritative eligibility/status used by the booking wizard.
- Lifecycle-aware `staff_customer_directory`, quote calculation, checkout and verified-payment wrappers. Existing promotion and VAT arithmetic is reused.
- `release_checkout`: service-only transition after provider expiry, or an atomic check proving no provider operation was ever claimed.
- Updated application export including all **47 public application tables**, bounded record/size limits and schema version 0031. Auth credentials and private anonymous-assistant usage rows remain excluded.

Statuses are derived from persisted facts: ACTIVE, RESERVED, USED, EXPIRED and REMOVED. Expiration is end-of-day Manila: an offer dated November 30 remains eligible through that day's final instant and becomes ineligible at December 1, 00:00 Asia/Manila. Existing payable checkout terms remain frozen even if an offer subsequently expires, changes or is removed.

Draft saving and quoting do not consume a one-time offer. Checkout atomically holds its assignment row, so competing bookings cannot both receive the same one-time benefit. The first independently verified payment, including the 50% down payment, consumes it in the same database transaction as recording the money. Replayed notifications do not consume it twice. The same reservation's balance uses its original saved total; the percentage is not applied again. Cancellation/refund does not restore a redeemed offer.

Unpaid quotes refresh before checkout and require the customer to review a changed quote. Saved subtotal, configured tax mode/rate, discount amount, VAT basis, VAT, total, down payment and balance flow through quotation, payment records, downloadable PDF and manager report helpers. Paid snapshots and verified payments remain fixed.

## Checkout expiry and reconciliation

`reconcile-paymongo-checkout` authenticates the caller and restricts access to the reservation owner or authorized staff. It independently retrieves PayMongo state. A paid payment goes through the existing authoritative verifier; pending/processing attempts stay held. An unpaid active session is explicitly expired and then retrieved again before any local release. Provider rejection or timeout alone never frees an offer.

The create-checkout function automatically reconciles a local payment older than its existing 24-hour expiry when the customer retries. The reservation detail also offers **Close or reconcile unfinished checkout**. A customer with a reserved offer sees a link to the original booking. There is no background job that blindly frees still-payable URLs. If provider creation was claimed but its response/session could not be saved, the operation stays blocked for operator reconciliation; do not manually clear its claim without checking PayMongo.

These rules follow PayMongo's documented session semantics: local time or an unsuccessful attempt does not close a session, expiry rejects paid/ongoing payments, and expired sessions no longer accept payment. References consulted: [Checkout session resource](https://docs.paymongo.com/reference/checkout-session-resource), [Key concepts](https://docs.paymongo.com/docs/payment-channels-key-concepts), [Expire a checkout session](https://docs.paymongo.com/reference/expire-a-checkout-session).

## Inventory, allergy and selection counters

The existing working modules were reused and retested:

- Elegant/Monoblock inventory: Add/Remove Stock, committed success messages, positive whole-number validation, atomic/idempotent adjustments, audit history, daily allocation checks and reductions blocked below active commitments. Releasing a booking allocation does not increase physical stock.
- Allergy declaration remains only in food selection. Venue notes and existing declarations remain intact. Stored allergen tags drive warnings; acknowledgment is required without removing selected dishes.
- Sticky dish counter follows the selected package's exact Supabase dish count. The included drink counter follows the actual single `drink_id` schema, 0/1 to 1/1. Limits, step validation, draft reload and Previous/Next retention remain operational on desktop/mobile.
- Guest count, coverage, operating hours, minimum notice, setup component prices, seating charges, role separation, payment verification, refunds, reschedules and reminders were preserved.

## Modified source files

| Files | Change |
|---|---|
| `src/pages/CustomerManagement.tsx` | Single directory, row dialogs, usage/expiry, validation, conflict/error handling and committed notifications |
| `src/lib/account-discount.ts` | Typed eligibility and readable Manila-date/usage summaries |
| `src/pages/ReservationWizard.tsx` | Server eligibility, reserved-offer booking link and consumed-offer information |
| `src/lib/financial.ts`, `src/components/FinancialBreakdown.tsx`, `src/lib/reports.ts` | Saved usage/expiry metadata, one-time disclosure and consistent quote/PDF/report breakdowns |
| `src/pages/Customer.tsx` | Authenticated checkout reconciliation action and outcome notice |
| `src/lib/permissions.ts`, `src/styles.css` | Promotions navigation and responsive dialog controls |
| `supabase/migrations/0031_discount_lifecycle.sql`, matching `supabase/updates` file | Versioned grants, security, quoting, holds, redemption, release and export |
| `supabase/setup.sql`, `supabase/functions/_shared/backup-schema.ts` | Generated fresh installer and matching archive schema |
| `supabase/functions/_shared/checkout-reconciliation.ts`, `_shared/reconcile-payment.ts` | Independently checked provider state and safe release/confirmation |
| `supabase/functions/reconcile-paymongo-checkout/index.ts` | Authenticated owner/staff reconciliation endpoint |
| `supabase/functions/create-paymongo-checkout/index.ts`, `supabase/config.toml` | Retry expiry reconciliation, pending-state claim guard and endpoint configuration |
| `tests/database.test.ts`, `tests/discount-checkout-reconciliation.test.ts` | Lifecycle, expiry, payment, security, concurrency, reporting and provider-race regressions |
| `package.json` | Nine-function Edge typecheck command |

Inventory/allergy/counter source files did not require duplicate implementations. Their existing SQL rules and UI were exercised again.

## Validation and deployment

- **158 tests across 13 files passed**, including **99 real embedded-PostgreSQL database tests** executing the actual bundled migrations.
- Covered staff access/RLS, stale updates, ongoing offers across all three setup types, draft non-consumption, competing checkout holds, inclusive Manila midnight, expired unpaid repricing, removal/editing during a payable checkout, one-time partial-payment redemption, duplicate verification, same-booking balance, saved financial preservation, cancellation/refund non-restoration and promotion precedence/restoration.
- Provider-state tests covered failed expiry/timeouts, paid races, pending/processing attempts, wrong session/currency/mode, ambiguous creation and database failures.
- TypeScript, ESLint, production build and all nine Deno Edge checks passed. Existing non-fatal Vite chunk-size/dynamic-import and dependency annotation warnings remain.
- Hosted isolated QA passed real staff name/email directory permissions, concurrent stock additions, competing daily chair allocations, reduction safeguards and one-time checkout race with exactly one winner.
- A real **unpaid test-mode PayMongo checkout** was created with the expected discounted down payment, then explicitly expired through the authenticated endpoint. An independent provider read confirmed the actual PHP line-item amount matched the saved discounted down payment and that the session remained expired/unpaid. The unused offer returned to Active only after confirmed provider expiry. **No charge or refund was made.**
- Real browser acceptance passed row-based dialogs, ongoing assignment, one-time expiry editing, inline invalid precision, removal confirmation/success, both chair stock controls, mobile dialog bounds, no duplicated first-step allergy, food/allergen acknowledgment validation, exact dish/drink limits, sticky desktop/mobile counters and saved selections across navigation/reload.
- Schema 0031 and matching create/reconcile/export functions were deployed to the connected Supabase project. An authenticated export verified schema 0031 and 47 public tables.
- Read-only hashes confirmed original reservations/financial snapshots, payments, refunds, transactions, balances and refund operations unchanged after migration/QA and again after cleanup. All tracked temporary QA identities, equipment, chairs, drafts, offer versions and unpaid bookings/payments were removed; audit history was retained. Actual business chair stock was unchanged.

Implementation commit `4d844c6` was pushed to GitHub main. The production custom domain served the exact tested `/assets/index-CZcKgUHX.js` bundle. Authenticated production acceptance passed the single customer directory/preselected edit dialog, Promotions navigation, checkout reconciliation endpoint with real browser origin/CORS and outcome notice, and restored draft food/drink counters. The deployed archive installer was compared byte-for-byte with the tested local setup SQL and matched.

## Remaining configuration and limits

1. Real **Monoblock usable stock is still unconfigured**. A manager must verify the actual physical count and use Confirm starting stock. No guessed quantity was introduced. Draft saving remains available; bookings requiring unconfigured chairs cannot finalize. Whole-day allocation remains the actual scheduling rule.
2. Tax configuration was preserved. Business/accounting confirmation of tax registration/treatment remains pending in the stored policy; system records are not certified BIR invoices. No additional tax, discount cap, chair unit price or event duration was invented.
3. A one-time offer is never automatically restored after verified payment, cancellation or refund. A manager may explicitly grant a new assignment; previous use remains recorded.
4. Ambiguous provider-creation failures require operator/provider reconciliation and remain held for safety. Retry-based expiry and the manual close action are implemented; no unconditional timeout cleanup job was added.
5. Actual paid PayMongo webhook acceptance, live merchant settlement, and a real paid customer receipt were not exercised on the hosted service. Verified-payment/balance/idempotency/reporting logic was tested against the real SQL in an isolated database, with separate provider-state tests and actual unpaid test-session expiry.
