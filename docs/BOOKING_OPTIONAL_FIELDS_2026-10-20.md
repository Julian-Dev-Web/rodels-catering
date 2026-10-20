# Booking wizard cleanup — October 20, 2026

## Completed behavior

- Removed the **Venue notes · optional** input from the occasion step without removing the location fields or historical notes. Empty notes are omitted from new submission payloads. The backend carries forward an owner's existing reservation notes when the replacement address omits them.
- Cleaned the sticky price summary with readable package, setup, extras and chair labels. Unnecessary zero-price extras are hidden; the included setup remains visible. Subtotal, applicable customer discount, VAT amounts, final total, 50% down payment, verified payments and remaining balance remain available.
- Moved quotation/tax disclosures outside the sticky sidebar into **Quotation and tax information**. Payment/receipt/PDF disclosures remain unchanged. The current unconfirmed business tax configuration is still identified as awaiting business/accounting confirmation; the quotation is not represented as a BIR tax invoice.
- Made validation specific to the current wizard step. Finalize validates all required steps and checks current event-time and equipment availability. Errors appear beside affected fields, focus/scroll to the first invalid field and direct the customer back to the relevant step when needed.
- Kept Save Draft independent of final-booking validation, including incomplete drafts. Existing local persistence, server drafts, optimistic draft version checks and saved contact behavior remain in place.
- Empty, null or omitted optional allergy declarations, notes, setup inclusions and optional quantity maps are normalized appropriately. Clearing quantity inputs becomes zero; clearing optional age becomes null. Supplied values retain their length, integer and range validation.
- Theme, colors, age, allergy notes and optional extras may be skipped. Required contact, venue, date/time, package guest limits, exact dish count, drink, dessert, seating and consent remain enforced. Selecting Other Contact requires a valid Philippine mobile number; saving that number remains optional.
- Automatic customer discounts and existing server financial/payment safeguards remain in effect. No verified payment was altered or refunded.

## Modified files

| File | Change |
| --- | --- |
| `src/lib/booking-validation.ts` | Shared booking schema, step-specific rules, optional-value normalization, field-to-step mapping and historical-note-safe payload helper. |
| `src/pages/ReservationWizard.tsx` | Step validation, final validation, availability feedback, error focus/navigation, draft integration and clean summary/information section. |
| `src/components/BookingFields.tsx` | Removed notes input, optional age normalization, preference errors and contact/location error revalidation. |
| `src/components/AllergyFields.tsx` | Clear optional-allergy guidance, inline notes errors and acknowledgment revalidation. |
| `src/components/FinancialBreakdown.tsx` | Booking-specific compact presentation while retaining the existing document presentation. |
| `src/lib/financial.ts` | Customer-facing labels using the existing computed/saved centavo amounts. |
| `supabase/migrations/0033_optional_booking_fields.sql` | Secure optional-value normalization and existing-note preservation wrappers. |
| `supabase/updates/0033_optional_booking_fields.sql` | Generated incremental transaction for existing projects. |
| `supabase/setup.sql` | Regenerated fresh-project installer. Do not run this against an existing project. |
| `supabase/functions/_shared/backup-schema.ts` | Regenerated backup installer/schema version. |
| `tests/booking-validation.test.ts` | Eight focused validation, payload and financial-rendering regression tests. |
| `tests/database.test.ts` | Five additional database regression cases and schema-version assertion. |

## Database and deployment

Migration **0033_optional_booking_fields.sql** was applied to the linked Supabase project. It adds no application table, drops no column/table and performs no bulk update of historical reservations. Private helpers remain inaccessible to ordinary customers; the public save RPC keeps its customer authorization and delegates to existing booking, price and stock checks.

The protected `export-application-data` function was redeployed. Its archive reports schema 0033, includes all 47 public application tables and contains an installer identical to the current generated `supabase/setup.sql`.

Original rows were hashed before rollout across ten protected tables: profiles, customer discount assignments, reservations, drafts, saved contacts, payments, transactions, balances, refunds and refund operations. Post-migration checks found no changes to those original rows.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Passed `npm run typecheck`. |
| Lint | Passed `npm run lint`. |
| Automated regressions | **186 passed in 15 test files**, including 117 isolated database tests. |
| Production build | Passed `npm run build`. Existing bundler annotation/chunking warnings remain non-blocking. |
| Edge Function type checks | Passed for the nine configured functions. |
| Browser, production build | Passed desktop and 390px mobile checks against real Supabase using an isolated temporary customer. |
| Incomplete draft | Saved before required booking fields were completed; subsequent Next correctly focused the event-name error. |
| Contact/menu validation | Other Contact rejected an empty number; the saved primary number worked. Empty required menu selections were blocked. |
| Optional-value persistence | Voluntary age/theme/colors survived Save Draft and reload, then could be cleared successfully. |
| Complete booking | Reached review and finalized an unpaid reservation with blank age/theme/colors/allergy notes, no declared allergens, no optional extras and no forced saved alternate contact. |
| Financial behavior | A temporary 10% ongoing account discount applied automatically; server totals agreed with the discounted subtotal. VAT/deposit presentation remained available. |
| Data preservation | Ten-table original-row comparison passed after migration. Temporary QA data was removed; audit history retained. |

SQL regressions additionally verify retained historical notes, cross-customer rejection, atomic rejection of incomplete final submissions and invalid provided quantity values. No payment-provider charge, refund or real reminder email was initiated for this task. Existing payment/discount regression coverage passed; this is not a claim of a new live paid transaction.

## Remaining configuration

- Monoblock physical stock remains unconfigured in the existing deployment. Its inventory safeguards are preserved. The isolated finalization test selected 100 Elegant Chairs rather than inventing Monoblock stock.
- Business/accounting confirmation of the configured VAT treatment remains outstanding. This change preserves the configured calculation and the pending-confirmation disclosure.
- Live production-release verification and the final post-cleanup preservation comparison are recorded below after deployment.
