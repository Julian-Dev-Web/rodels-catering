# Unified discount, inventory and booking fixes — completion report

## Implemented features and UI locations

**Manager > Customer Management** now uses a staff-only, paginated directory joining registered profile names to their actual Supabase Auth email. Search by name or email, select the readable name/email option, choose 5/10/15/20% or a custom rate, and save. No UUID, reservation ID, subtotal or mandatory reason is typed. Custom rates use the existing supported 0–100% range with at most two decimals; no separate business discount cap is configured. The list shows email, rate, Active/None and Edit/Remove. Removing an existing benefit, including a custom zero-percent change, requires confirmation. Success alerts use the committed server response; failures never announce success.

Account assignments reuse schema 0029, one profile rate and the existing reservation-discount/tax engine. They apply across Simple Buffet, Birthday and Wedding until changed or removed. Staff-selected promotions replace account discounts instead of stacking. Pending checkouts and verified paid/completed snapshots remain protected. Refreshed unpaid checkout quotes require review before a provider session is created. A saved account discount now also shows the customer-facing Special offer message in the shared quotation/payment-record breakdown. Existing VAT, rounding, deposit and reporting calculations remain in place.

**Manager > Equipment inventory** shows physical stock separately from the chosen date's allocated/available quantities, for Elegant Chairs and Monoblock Chairs. Add Stock and Remove Stock use positive whole quantities, optional notes and confirmation. Alerts appear after commit. NULL stock needs a one-time verified starting-count confirmation, which cannot overwrite stock already confirmed by another manager. Pause/resume of new allocations remains available and never overwrites physical quantities. Audits preserve actor, time, previous/new quantity, delta and note; retried adjustment requests reuse an operation ID without repeating the movement.

Availability retains the existing **whole-day** rule, because no event turnaround/duration policy exists. The largest current/future single-day commitment limits removals; quantities are not summed across unrelated days. Row locks serialize stock changes and allocations. Cancellation releases held allocations once without increasing physical stock. Drafts and pending requests do not hold chairs; approved/completed records and applicable pending-cancellation holds follow the existing policy. Modern selected guest seating cannot exceed guest count. Monoblock guest seats remain included, selected Elegant guest seats retain the existing PHP10 surcharge, and fixed setup components are not converted into a guessed per-chair price or quantity.

**Customer booking > The occasion** labels the optional text as Venue notes and asks for venue/access instructions. The duplicated dietary/allergy wording is removed. Stored venue notes and structured allergy declarations are preserved.

**Customer booking > Your menu** retains the structured allergy input and stored-metadata warnings. Acknowledgments allow keeping the selected dish; changing ingredients, declarations or selections refreshes warnings. Review still displays the saved declarations. Sticky counters track actual selected dishes against the chosen Supabase `dish_count`, and **one drink**, matching the current single `drink_id` schema. Missing/excess selections block Continue; unchecked dish choices disable at the limit. Changing a package retains choices and explains the required adjustment. Counters remain visible without a fixed bottom overlay on desktop/mobile.

## Files changed

| Area | Files |
| --- | --- |
| Manager discounts | `src/pages/CustomerManagement.tsx` |
| Manager stock | New `src/pages/EquipmentManagement.tsx`; existing `src/pages/PanelOperations.tsx` re-exports it to preserve routes |
| Shared UI | New `src/components/FeedbackNotice.tsx`, `src/components/MenuSelectionProgress.tsx`; updated `src/components/ui.tsx`, `EquipmentAvailability.tsx`, `FinancialBreakdown.tsx`, `BookingFields.tsx` |
| Booking flow | `src/pages/ReservationWizard.tsx`, `src/booking.css` |
| Input/progress logic | New `src/lib/manager-input.ts`, `src/lib/menu-selection.ts` |
| Database | New migration/update `0030_customer_directory_chair_stock.sql`; generated `supabase/setup.sql`, `supabase/functions/_shared/backup-schema.ts` |
| Tests | `tests/database.test.ts`; new `tests/manager-booking-improvements.test.ts` |
| Handoff | This report, `README.md`, `docs/README.md`, `supabase/SCHEMA.md` |

Private QA credentials, records, screenshots and scripts remain ignored and are excluded from the repository.

## Database/security changes and deployment

Migration **0030_customer_directory_chair_stock.sql** is idempotent and was reapplied successfully in the isolated regression test. It adds an unconfigured Monoblock inventory entry only if absent, links the current Monoblock chair catalog item, and backfills missing allocation evidence for existing holds. It does not update original reservation totals, financial snapshots, payments or tax settings, and does not guess physical counts. It adds no public table: the archive still covers 46 tables.

| RPC/helper | Purpose and authorization |
| --- | --- |
| `staff_customer_directory(search,page_number,page_size)` | Active staff only; bounded name/email search and pagination. Returns approved directory fields, not Auth passwords, tokens, metadata or an admin API handle. |
| `manage_customer_account_discount(customer_id,percentage_bps)` | Active staff only; locks the customer, reuses the audited 0029 setter and returns committed previous/new percentages. |
| `adjust_equipment_stock(eid,adjustment,quantity,note,operation_id)` | Active staff only; atomic positive add/remove, reduction guard, audited idempotent retry. |
| `confirm_equipment_stock(eid,quantity)` | Staff-only initial NULL-to-confirmed count; refuses stale repeated initialization. |
| `set_equipment_active(eid,is_active)` | Staff-only pause/resume without replacing the stock count. |
| `configure_equipment` | Existing compatibility RPC now rejects reductions below upcoming commitments. |
| `private.equipment_committed`, `private.sync_equipment` | Single-day commitments and existing transactional hold/allocation checks, extended to Monoblock. |
| `export_application_snapshot` | Service-only archive version 0030, preserving the existing archive contents/scope. |

Existing RLS stays enabled. Customers still cannot directly write stock, allocations or account-discount fields. Private helpers and Auth-directory access are not granted to browser roles. The directory is a narrow SECURITY DEFINER function with an empty search path and an active-staff check; no service-role key or Auth Admin API is exposed to React.

The connected project has received incremental 0030 and the matching archive function. The frontend is published through the existing GitHub/Vercel flow. For another existing project already on 0029, apply the entire generated `supabase/updates/0030_customer_directory_chair_stock.sql` in SQL Editor, then deploy the matching archive function and frontend:

```powershell
npm.cmd run db:bundle
npx.cmd --yes supabase@2.120.0 functions deploy export-application-data --project-ref YOUR_PROJECT_REF --use-api
npm.cmd run build
```

Use normal migration review for projects on an older version. `supabase/setup.sql` is for a fresh empty project only; never run it over an existing installation. No new provider secret or server environment variable is needed.

## Tests actually executed

- **142 tests across 12 files passed**, including 90 database tests executing the real bundled SQL in isolated PostgreSQL/PGlite. Tests cover restricted directory fields/search/pagination, inactive/unauthorized access, cross-event account discounts and removal, unchanged tax/deposit/reporting behavior, stock input validation, add/remove auditing and retry identity, commitment guards, initial-stock races, pause/resume, cancellation release, mixed seating quantities, unchanged pricing and migration reapplication. Prior reservation/payment/refund/reminder/draft/allergy regressions remain in the suite.
- TypeScript/production build, lint and all eight Edge Function type checks passed. The build retains the earlier bundle-size, mixed-import and dependency annotation warnings, with no build failure.
- Hosted tests used isolated temporary identities/equipment/unpaid bookings. Actual parallel PostgreSQL allocation requests competed for shared stock: one succeeded and one failed for shortage. Parallel stock additions produced the correct combined total. Duplicate adjustment retry did not add stock twice. A below-commitment reduction failed, and repeated release did not increase physical stock. Customer access to staff directory/stock mutation was denied. These tests used trusted writes through the actual database triggers; they did not announce fake events to staff.
- Browser tests against the built UI and hosted backend passed name/email selection, committed assign/update/remove alerts, removal cancellation/confirmation, rejected custom precision, both chair-stock controls, missing menu-field validation, recorded seafood warnings and acknowledgment, live dish/single-drink limits, sticky desktop/mobile counters, Previous/Next, reload and saved menu/allergy data.
- A private six-table comparison confirmed that original booking, financial snapshot, payment, refund and balance records were unchanged after the migration. Final post-cleanup results and release verification are recorded below.

Additional browser acceptance passed verified initial-stock confirmation, pause/resume without changing physical counts, package changes retaining five selections while requiring adjustment to a three-dish menu, and final review preserving the account discount and allergy declaration. With real Monoblock stock still unconfigured, both the setup step and server finalization correctly refused to secure those chairs. The failed finalization retained the complete unsubmitted draft and created no reservation/payment. The authenticated archive matched schema 0030 with 46 public tables.

No real charge, refund, customer email, paid provider webhook or end-to-end paid receipt was generated during this acceptance. Existing paid-payment verification and reporting were exercised in isolated regressions. This report does not claim live merchant payment acceptance or inbox delivery.

## Configuration and limitations

1. **Monoblock usable stock is unconfigured.** A manager must verify the actual count and use Equipment inventory > Monoblock Chairs > Confirm starting stock. Until then new bookings requiring those chairs cannot pass the stock check/finalization. Saving an incomplete draft remains available. The recorded Elegant Chair setting is preserved; this work does not certify the physical count.
2. Whole-day inventory holds remain the approved implementation. There is no invented event duration or hourly reuse rule. Three-day booking notice, saved operating hours, coverage, guest limits and three-confirmed-events-per-day rules are unchanged.
3. The fixed Birthday/Wedding Elegant Chair setup component has no confirmed guest-chair unit quantity. Its existing fixed price remains separate from selected guest seating; no speculative allocation or additional per-chair fee is introduced.
4. Tax configuration is unchanged. Business/accounting confirmation of VAT registration/treatment remains an existing open item; generated records are not certified BIR invoices. There is no separately configured business percentage cap or account-discount expiry.
5. The drink model supports exactly one included drink and one dessert. Multiple-drink packages/quantities would require an approved schema/business-rule change; the counter does not invent a two-drink option.
