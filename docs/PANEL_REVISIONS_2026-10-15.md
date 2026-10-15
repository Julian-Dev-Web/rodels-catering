# RodelConnect panel revisions — October 15, 2026

This report covers the supplied updated panel-revision prompt and the owner's subsequent answers. It describes implementation and executed checks, not authenticated defense minutes or a certification of merchant, food-safety or tax compliance. The pre-change inventory is in [the audit](PANEL_REVISIONS_AUDIT_2026-10-15.md). Earlier DOCX/PDF documentation remains a historical snapshot.

## Feature audit and resulting behavior

| Area | Before this release | Implemented result | Remaining business/provider setup |
|---|---|---|---|
| Shared Elegant Chair inventory | Per-booking quantity validation; no shared allocation ledger | Whole-day stock, per-date availability, atomic allocation/release/reschedule, manager stock editing and overcommitment warning | Confirm actual usable stock; no uncertain 500/1,000 estimate was installed |
| VAT and financial records | No explicit tax snapshot/breakdown | Server centavo calculations, configurable inclusive/exclusive/non-VAT, saved discount/tax snapshots, quotes/payment details/PDF/report fields | Verify registration and accounting treatment; current 12% inclusive breakdown is explicitly provisional, with no extra VAT added to gross |
| Discounts/promotions | No controlled offer module | One staff-controlled fixed/percentage module, eligibility/dates/usage cap, one discount per booking, reason and audit | Business creates its own offers; no mandatory/default promotion invented |
| Incomplete drafts | Session restore plus validated reservation writes; Draft action jumped directly to review | Persistent incomplete drafts, My Drafts/Continue Editing, correct stored step, optimistic versions, transactional/idempotent finalization | The exact historical redirect to Home was not reliably reproduced; no such reproduction is claimed |
| Allergy cautions | No declared-allergen/dish relationship or acknowledgment | Current server metadata, notes, per-dish explicit acknowledgment, revision-bound warnings and staff preparation caution | Ingredient review remains incomplete; no allergen-free guarantee |
| Daily upcoming reminders | Status notifications and generic email worker only | D-7 through D-1, configurable 07:00 Manila, in-app/email channel ledger, secure scheduled worker, opt-out and safe retries | Real email delivery requires Resend key and verified sender; owner currently has no domain |
| Audit and roles | Existing protected audit and distinct dashboards | Existing audit extended; Manager operational pages, Super Admin oversight/settings | No duplicate audit dashboard or second promo module |

## Inventory policy and access

`equipment_inventory` stores confirmed usable quantity; Elegant Chair starts unconfigured (`NULL`). Only staff can update it through the audited RPC. Customers cannot write stock or allocations. Manager → Equipment inventory shows selected-date total, allocations, availability and consuming reservations. The customer setup step shows requested quantity and checks availability again before proceeding. SQL checks again during save/finalize and confirmed status transitions.

All events on a date share the same stock because no trusted duration/turnaround rule exists. Allocation follows the application's existing `holds_capacity` policy: approved/completed events hold their date's quantity, pending cancellation retains the previous hold until reviewed, and drafts/pending/rejected/cancelled/refund states do not allocate. Cancellation releases it; approved rescheduling moves it atomically. Repeating a confirmed update cannot allocate twice. Lowering stock preserves approved bookings, clamps available stock to zero and exposes overcommitment for review.

The allocation trigger locks equipment rows in a consistent order in PostgreSQL. Selecting Elegant Chairs remains PHP10 per selected guest chair, capped by guests; remaining Monoblock seating stays included. Inventory does not add a second charge. Fixed Birthday/Wedding styling components retain their existing separate pricing. No additional physical quantity was invented for those fixed components.

## Financial and promotion rules

The owner described current quoted prices as already including VAT. New calculations provisionally extract 12% from the existing discounted gross instead of adding 12% again. Business/accounting confirmation is false and is displayed. Super Admin → Tax & reminders can select the appropriate confirmed treatment. Switching to exclusive VAT requires explicit business confirmation. This setting does not rewrite old quotes.

The server uses integer centavos. A percentage discount is rounded to the nearest centavo; tax is rounded once on the resulting amount. Inclusive tax is `round(discounted gross × rate / (10000 + rate))` for basis-point rates; exclusive tax uses `round(basis × rate / 10000)`. The 50% down payment rounds upward by a centavo when necessary. Verified paid amounts and balances come from stored records; paid/refunded history is not fabricated or recalculated.

Manager → Discounts & promos creates fixed peso or percentage offers with optional application-date bounds, minimum guests/subtotal and usage cap. Dates use Manila. Staff apply one offer with a reason in Reservation → Details; Super Admin can oversee offers. Offer terms are snapshotted on assignment. Usage excludes cancelled/rejected/refunded bookings. Customers cannot assign discounts through form payloads or RPCs. Paid, closed and pending-checkout bookings cannot have their totals changed here. Existing 10%-of-paid refund deduction and payment verification remain in place.

Customer and staff financial detail, customer booking/payment PDF, payment tables and CSV/PDF report data show saved VAT and discount information, including reason. Historical quotes without a snapshot say the breakdown was not recorded; no historical VAT is invented. System-generated booking/payment records explicitly state they are not official BIR tax invoices. The configured rate does not establish the business's VAT registration; accounting review remains required. See [BIR VAT return instructions](https://efps.bir.gov.ph/efps-war/EFPSWeb_war/help/help2550m2006.html).

## Draft and allergy behavior

Save draft bypasses complete-form validation and stores the form and current wizard step without creating a domain reservation, payment or equipment/date hold. It restores package, dishes, allergy declarations/notes/acknowledgments, date/time, guests, venue/contact, theme/colors, setup checklists, selected chair quantities, extras and other form fields. Next applies step validation; invalid finalization leaves the saved draft intact. Owner RLS and version checks prevent other-customer access and stale-tab overwrite. Submitting locks the draft, validates current rules and commits one reservation; repeat submission returns that same reservation. A linked legacy draft reuses its existing reservation instead of duplicating it.

Source inspection confirmed that the earlier Draft detail action linked directly to `/confirm`, and no persistent incomplete-save action existed. Isolated prior-release browser reproduction did not establish the reported exact Home redirect. The new browser acceptance covered partial save, My Drafts, refresh, relogin, deep links, review-step restoration and finalization without Home navigation. Do not present an unverified old cause as proven.

Known seafood-category dishes receive possible-seafood metadata from the supplied menu classification. This is not a complete ingredient review. Staff can review/edit metadata through an audited editor. Declared matching allergens generate warnings; customers may keep the dish after explicit acknowledgment. Tokens bind declarations, notes, selection and metadata revision, so old acknowledgments cannot silently validate changed ingredients. Unknown information always prompts contact with the catering team. Manager details retain declarations, notes and current acknowledgment status as preparation cautions.

## Database, backend and changed files

The hosted project has applied these additive updates once; **do not rerun them or `setup.sql` on this existing project**. Fresh installer and embedded archive schema were regenerated from migrations.

| Migration/update | Tables and principal RPCs |
|---|---|
| `0023_shared_equipment_inventory.sql` | `equipment_inventory`, `equipment_allocations`; `equipment_availability`, `configure_equipment`, allocation triggers and guarded save/finalize wrappers |
| `0024_persistent_drafts_allergy_warnings.sql` | `allergens`, `dish_allergens`, `reservation_drafts`; `configure_dish_allergens`, `allergy_warnings`, `save_booking_draft`, `submit_booking_draft`; reservation allergy columns |
| `0025_financial_tax_discounts.sql` | `discount_offers`, `reservation_discounts`; `tax_configuration`, `configure_tax_policy`, `save_discount_offer`, `apply_reservation_discount`; reservation financial snapshot |
| `0027_payment_inventory_confirmation.sql` | Guard payment auto-approval with locked equipment checks; preserve verified money in pending review on shortage; matching archive version |
| `0026_upcoming_event_reminders.sql` | `reminder_deliveries`, customer preference columns; enqueue/claim/prepare/finish reminder RPCs, policy/preferences/configuration, lifecycle triggers and extended summary/archive |

New tables have RLS. Customers read their own draft/reservation/reminder data; staff read operational records. Writes occur through authorized RPCs or the service role; allergen metadata updates cannot bypass the audited editor. Financial, stock, draft submission and worker checks run in PostgreSQL, not only in UI. New actions extend existing `audit_logs` with actor, entity and sanitized details.

Main frontend changes: `ReservationWizard.tsx`, `Customer.tsx`, `Admin.tsx`, `Reports.tsx`, `Settings.tsx`, new `PanelOperations.tsx`; shared `AllergyFields`, `EquipmentAvailability`, `FinancialBreakdown`, `ReminderPreferences`; draft/financial/report helpers; reservation queries/types, router, navigation and booking styles. Backend changes include the five migration/update pairs, `setup.sql`, embedded backup schema, reminder worker/helper, transactional email acceptance check and function configuration. Tests extend database/draft coverage and add financial/reminder provider cases.

## Scheduler, email and archive deployment

The hosted `export-application-data`, `dispatch-event-reminders` and updated `send-transactional-email` are deployed. The application archive covers **46 public tables, schema 0027**, matching installer and reference state. Auth credentials, actual Storage file bytes, secrets, Vault values and private guest-AI counters remain outside that archive; this is not a full infrastructure backup or a verified restore drill.

`supabase/operations/enable-event-reminder-cron.sql` installs the hosted Cron/pg_net tick. Job `rodel-upcoming-event-reminders` runs every five minutes. Its private SQL function independently enqueues in-app reminders and invokes the Edge dispatcher using a Vault token. The token and project URL were configured privately; no value appears in repository documentation. Cron was observed active and its latest run succeeded. An unauthorized dispatcher request returned 401. An authorized invocation returned 200, `email: not_configured`, zero emails sent.

Eligibility is approved future events, D-7 through D-1, after configured Manila time and subject to customer preferences. D-0 is off. A unique reservation/day/channel ledger prevents repeated ticks from generating duplicate in-app entries. Email uses leased claims, immutable payloads and a stable provider idempotency key; provider success requires a nonempty acceptance ID. Cancellation/reschedule stops stale queued work, and preference/status checks run again before provider submission. A request already accepted in flight cannot be recalled; its actual outcome is recorded. No manager duplicate email flood is introduced.

The owner has no sender domain yet. Follow [the email setup guide](REMINDER_EMAIL_SETUP.md) for domain verification, private `RESEND_API_KEY`/`EMAIL_FROM`, customer consent and an authorized inbox acceptance test. The configured reminder worker token is already installed. No email receipt or live provider success is claimed. The scheduler design follows [Supabase scheduling guidance](https://supabase.com/docs/guides/functions/schedule-functions).

## Executed verification

- TypeScript, ESLint and production build passed; eight Edge Functions passed Deno checking. The build retains existing chunk-size/mixed-import/dependency-annotation warnings, with no build failure.
- **122 tests across 11 files passed**, including real fresh-installer SQL executed in PGlite. Cases cover stock release/reschedule/reduction, ownership, invalid/idempotent draft submission, form normalization/legacy reuse, current allergy acknowledgments, inclusive/exclusive/non-VAT/rounding, discount authorization/eligibility/caps/audit/paid locks, D-7 through D-1 ledger uniqueness/preferences/cancellation/reschedule, provider acceptance and ambiguous retries, plus earlier regressions.
- **Real hosted concurrent PostgreSQL approvals passed:** two different customers' isolated future unpaid fixtures requested 600 and 500 against an isolated 1,000-chair equipment SKU; exactly one approval succeeded, the other was denied for shortage, allocated total never exceeded stock. This was a fixture, not the business's real inventory. Customer stock mutation and other-customer access were denied.
- Real local browser acceptance against hosted Supabase passed incomplete draft save, My Drafts Continue Editing, refresh/relogin/deep link, step restoration, allergy keep-and-acknowledge, unknown ingredient/stock cautions, mobile review, unchanged inclusive gross, finalization and repeat-submission prevention. Manager equipment/offers/upcoming and Super Admin tax/reminder settings rendered.
- Browser offer creation and applying a fixed discount to the isolated unpaid booking passed. A real customer RPC could not forge the discount. Customer details matched stored amounts; the booking/payment PDF downloaded, rendered as one page and passed required-field/page-bound checks. Mobile financial detail fit the viewport. Screenshots/QA records remain private.
- Temporary concurrency/customer/browser fixtures and related staff notices were removed; audit history was retained. A six-table hash comparison confirmed all original booking and financial rows unchanged, including original totals/payment/refund fields. No real charge/refund/customer email was created for this acceptance.

Release verification: implementation commit `cf3ccd4` was pushed to GitHub main. Vercel served the exact tested `/assets/index-L3qyCEpD.js` bundle. Read-only production browser checks passed public hero/four menus, anonymous and Manager role guards, staff login/reload, reports/operating hours, Super Admin archive download, tax/reminder settings, unknown-stock placeholder, Manager discounts, customer Save Draft and reminder preferences. The archive was verified against the matching deployed schema and 46-table scope. A final backend-only payment guard advanced the archive to schema 0027; frontend source/bundle is unchanged.

Final review identified and repaired an equipment/payment race: chairs can fill while checkout is open. Verified payment is now recorded exactly once and the booking stays pending for staff confirmation if equipment is short; it does not oversell or roll back the money ledger. The added fresh-installer regression passed, bringing the suite to 122 tests. This is SQL regression evidence, not a claim of an actual paid PayMongo transaction.

## Remaining decisions and practical use

1. Catering team confirms usable Elegant Chair stock, then Manager enters it with the confirmation checkbox. Until then Elegant Chairs cannot be secured; included Monoblock selection remains available.
2. Business/accountant confirms VAT registration, rate and inclusive/exclusive/non-VAT treatment. Existing gross prices remain unchanged under the provisional inclusive setting. No BIR invoice certification is implied.
3. Business creates approved discount offers; no default commercial rates were invented. Non-stacking, unpaid-only adjustment and existing confirmed-status stock policy are implemented.
4. Reminder hour is resolved: 07:00 Manila, configurable. Actual email needs the domain/provider setup and inbox acceptance described above. In-app scheduling is installed.
5. Live paid PayMongo webhook/refund acceptance, full Auth/Storage disaster recovery and legal/privacy review remain separate earlier open items. This release does not assert that these were completed.
