# Customer discount expiration options

The existing Manager > Customer Management dialog now has **No expiration**, **30 days**, **90 days**, and **Specific date** radio options. Only Specific date displays the date picker. Existing styling, percentage presets/custom input, ongoing/one-time usage cards, Save Discount, removal confirmation and committed notifications remain in place. No separate Manager discount page was added.

The summary shows the percentage, usage, selected expiration option and computed Valid Until date. Preset success notices include “Valid for 30 days” or “Valid for 90 days”; the saved customer row displays the actual deadline.

## Calendar and security rules

- A preset uses the successful assignment's **Asia/Manila calendar date plus 30 or 90 days**. For example, October 20 plus 30 days is November 19. The chosen deadline remains valid through the end of that Philippine calendar day; expiration starts at the following midnight.
- The server captures assignment time after acquiring the customer lock, calculates the date, and stores both the actual `expires_on` and selection metadata on the newly created assignment version. Client-supplied dates for presets/No expiration are rejected. Specific dates must be finite and today or later in Manila, including for compatible older API calls.
- Preview dates use the server's Manila day and calendar arithmetic independent of the browser timezone. An open dialog refreshes the server date every minute. The saved response is authoritative if saving crosses midnight.
- Editing and saving a preset creates a new assignment version and starts a new 30/90-day period from that save date; the dialog explains this before saving. Editing existing offers retains their saved radio choice. Older offers without selection metadata display as Specific date or No expiration according to their existing deadline.
- Existing lifecycle eligibility, inclusive deadlines, quote review, one-time checkout holds, verified-payment redemption and frozen paid terms are reused. Assigning/editing/removing expiration settings does not automatically rewrite existing finalized reservations or any payment records. Existing before-checkout quote validation remains in effect for eligible unpaid bookings.

## Files and migration

| File | Purpose |
|---|---|
| `src/pages/CustomerManagement.tsx` | Four existing-style radio choices, conditional picker, preview, saved choice and notices |
| `src/lib/account-discount.ts` | Typed expiration options and calendar preview |
| `supabase/migrations/0032_discount_expiration_options.sql` | Optional selection column, server resolver, secure save API, compatible manual-date API, directory clock/metadata and archive version |
| `supabase/updates/0032_discount_expiration_options.sql` | Generated transactional update for the existing project |
| `supabase/setup.sql`, `supabase/functions/_shared/backup-schema.ts` | Matching fresh installer and application archive schema |
| `tests/database.test.ts`, `tests/discount-expiration.test.ts` | All eight combinations, calendar boundaries, tampered inputs, lifecycle and financial preservation regressions |

Migration **0032** is additive: it does not replace or bulk-update historical assignments. The new optional `expiration_option` field leaves old records intact; the directory derives a compatible display choice. It adds a six-argument `save_customer_discount` API while retaining the previous five-argument API. Customer mutation restrictions, staff checks, stale-version protection, audit history, financial calculations and redemption rules remain enforced. The matching application export contains the same 47 public application tables. **Do not run setup.sql on an existing database.**

## Validation

- **173 tests across 14 files passed**, including **112 tests executing the actual database installer/migrations**. All eight usage/expiration combinations saved and applied correctly.
- Covered the October 20 → November 19 example, UTC/Manila rollover, other session timezones, year/month/leap-day boundaries, inclusive end-of-day expiry, expired/used exclusion from new bookings, invalid/past/infinite dates, manipulated preset payloads, role protections and legacy API compatibility.
- Verified preset one-time offers still allow only one checkout, redeem only once on a verified half payment, exclude reuse, and retain the original balance and paid snapshot after later assignment changes. Finalized reservation rows remained unchanged when expiration options were assigned, edited or removed.
- Production build, TypeScript, ESLint and nine Edge checks passed. Existing non-blocking Vite chunk/dynamic-import and dependency-annotation warnings remain.
- Real browser acceptance on the built UI and hosted backend passed all eight combinations, conditional picker visibility, computed summary, saved dates/types, preset notices, retained option when editing, past-date rejection, manipulated preset rejection, removal/repricing and mobile dialog bounds. Only an isolated customer and unpaid draft were used; no checkout, charge or email was initiated.
- Schema 0032 and the matching archive function were deployed. An authenticated export confirmed version 0032 and 47 tables. Original customer discount terms and financial records passed an eight-table hash comparison after migration.

Implementation commit `708bafe` was pushed to GitHub main. The custom domain served the exact tested `/assets/index-IwmasNK7.js` build. Production browser acceptance repeated all eight combinations successfully, including conditional picker visibility, server-computed dates, summaries, preset notices, saved choices, invalid-date rejection, automatic pricing and removal.

All tracked temporary QA assignments, identity and unpaid draft were cleaned up; audit evidence was retained. The final eight-table comparison confirmed original customer discount terms, profiles, reservations/financial snapshots, payments, refunds, transactions, balances and refund operations unchanged. The deployed archive's installer also matched the tested local setup SQL byte-for-byte.
