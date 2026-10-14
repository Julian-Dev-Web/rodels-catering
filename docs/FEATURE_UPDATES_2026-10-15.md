# RodelConnect implementation handoff — October 15, 2026

This release implements the two user-provided implementation prompts against the existing React/TypeScript/Supabase app. Role identifiers remain `customer`, `manager`, `super_admin`. Existing profiles start active; saved booking quotes, payment/refund amounts, approved historical refund requests and historical table quantities are not rewritten.

## Customer guide

1. Start a booking at My reservations → Plan an event. Pick a current set menu and 100–1,000 guests; choose a date at least three calendar days ahead in Manila.
2. Choose Bulacan or Pampanga, then an associated city/municipality and barangay. The selectable snapshot uses the existing PSGC directory source, retrieved October 15, 2026. Names/codes and parent relationships are independently validated in the database. Angeles appears in the source's geographic Pampanga grouping; PSA treats it as a separate highly urbanized city. No location fee was added.
3. Choose your primary account number or a saved alternate. Other contact number accepts a different reachable mobile. The optional save checkbox adds it to the contact list; it never replaces the profile's primary number.
4. Read Terms and Conditions and Privacy Notice, accessible from the form/footer. The acceptance checkbox starts unchecked for a new booking. The server stores policy version `2026-10-15-v1` and acceptance time; client timestamps are ignored. Older unaccepted drafts must revisit the occasion step before finalizing.
5. Select the menu's exact 3/4/5/6 dishes, a drink and dessert, then a setup within the normal wizard. No extra Customize page was introduced.
6. Birthday setup starts with Stage Backdrop, Elegant Chair and Entrance checked. Each costs ₱5,000; unchecking one reduces setup by ₱5,000, and selecting none gives ₱0. Optional age accepts 1–120; theme/colors are optional. Wedding has six checked inclusions and a ₱30,000 full bundle. Its partial pricing stays blocked until owner-approved component prices are configured. Simple Buffet retains its existing catalog price and has optional theme/colors.
7. Choose existing event features and published quantity-based add-ons. No illustrative archived add-ons were republished and no new catalog fees were invented. The currently active catalog may have no quantity-based add-ons; the screen states this. Choose table shape and guest chairs; number of tables is no longer a customer input or new pricing component. Existing historical quantities remain stored. The guest Elegant Chair upgrade is distinct from the setup inclusion and remains ₱10 per guest.
8. Review event contact, theme/colors/age, setup inclusions, optional extras, seating, consent and authoritative saved quote. The live estimate is informative; SQL recalculates saved/finalized totals. Payment choices are 50% down payment, 100% full payment or an existing outstanding balance.
9. Request reschedule from an approved future booking. The calendar opens in the original future event's month/year, marks the original date, and starts without a replacement selection. Past/preparation dates, the original date and dates at capacity are disabled. A past original event opens the current month but requires support review under the preserved future-booking rule. A pending request leaves the saved date intact and blocks duplicates; approved changes are atomic and enforce capacity again.
10. Refunds require approved cancellation and a request no later than the event's saved date/time minus five full calendar days in Manila. The server preview shows paid amount, previous refunds, remaining policy fee, requested refund and exact cutoff. Four days before is late. ₱10,000 paid yields ₱9,000; ₱20,000 yields ₱18,000. Prior refunds subtract from the original 90% entitlement instead of applying another 10% to each remaining amount. Staff review and provider confirmation are required; denied/late/existing requests have a support explanation.

## Manager guide

The operational overview adds active/pending/upcoming/confirmed events, payment-status counts and pending cancellation/refund/reschedule counts. Event Calendar groups actual scheduled events by saved date/month. Packages/menus and setup/extra reference pages are read-only for prices; Menu library retains the existing editable dishes/categories/drinks/desserts scope. Payment monitoring and reports retain server-confirmed ledger exports. Reservation details show readable booking preferences and extras. Refund review displays the frozen gross/fee/net amounts for new requests, while old requests are labeled historical. Provider status polling continues through the existing Process refund/Check provider status control. Failed/ambiguous provider operations require staff reconciliation; the app does not mark them completed or promise automatic manual payment.

Managers cannot access user administration, roles, global maintenance/settings, backup generation, security monitoring or system reports, even through direct URLs/RPC calls. Their existing operational review/read access remains available during maintenance.

## Super-admin guide

The control panel has distinct user/account metrics, reservation summary, content management, roles/permissions reference, security audit monitoring, system reports, maintenance and backups. User management supports search, role/status filters, eligible customer/manager role changes, account activation/suspension and audit records. Application suspension denies protected SQL/Edge actions even if the Auth token remains valid; profile changes are monitored through Realtime and periodic refresh. The UI does not assign super-admin roles. Self demotion/suspension is blocked, and the last active super admin must remain active.

Website Maintenance supports a persisted message, last-change date and confirmed enable/disable controls. Public/customer pages show branded responsive maintenance with a spinner. Super admins retain secured sign-in/control access; no localStorage bypass exists. New customer bookings/checkout and normal customer RPC actions stop at the server. Verified provider callbacks and the internal notification worker remain available, as do active staff operational review and reconciliation. Existing payment records are preserved.

System Settings presents the versioned refund policy and the six-item Wedding configuration. **Pending owner question:** supply approved PHP prices for Stage Backdrop, Elegant Chair, Entrance, Presidential Table, Buffet Setup and Diamond Dance Floor, totaling exactly ₱30,000. The production seed is JSON `null`, not an invented equal split. An authorized super admin can enter the actual approved figures and explicitly attest owner approval; SQL validates keys, nonnegative integer centavos and exact total, then audits the change.

## Genuine backup scope and safe recovery

Backup generation runs on the server after verified Auth identity and current active `super_admin` role checks. It returns an actual JSON artifact containing the 35 allowlisted public application tables, counts, schema version, matching repository SQL installer/relationships/policies/functions and a checksum. The browser verifies the checksum before download. Generation metadata is audited; the history does not imply that a browser saved the file or that off-site storage succeeded. Files are not uploaded to the public gallery bucket. Oversized data and schema-version mismatch fail explicitly.

This is an application archive, **not a full managed PostgreSQL/Auth/Storage backup**. It excludes Auth login accounts/credentials, actual Storage file contents, server secrets and provider-managed internal schema. Its included installer requires a compatible fresh Supabase project and contains baseline catalog seed rows that need operator review when mapping/importing the exported records. Restoring profile/customer records also requires corresponding recovered Auth IDs or an explicitly reviewed identity mapping. Existing generated archives are not retained for re-download by the app. There is no Restore button or automated production overwrite.

Safe recovery procedure:

1. Verify the downloaded file's SHA-256 against its generation record, inspect format/schema version privately, and preserve it off-site with restricted access.
2. Obtain a separately verified operator database/Auth backup and a separate Storage file copy. Preserve server configuration and migration/source revision privately.
3. Create an isolated staging Supabase project with compatible platform/PostgreSQL versions. Follow [Supabase's supported backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), consulted October 15, 2026. Review Auth/Storage customizations and restore scope rather than assuming they are included.
4. If using the application JSON archive, review its included fresh-schema SQL and seed conflicts before import. Recover required Auth identities or approve a mapping first. Import public records in foreign-key order under restricted operator access; preserve amounts, states, relationships and audit records. Do not run `setup.sql` against an existing production schema.
5. Verify row counts, PK/FK constraints, ownership/RLS, role access, booking/pricing and payment reconciliation in staging. Keep outbound payment/email integration disabled during restoration tests.
6. Production restoration remains a separate operator action requiring explicit confirmation, reauthentication, a rollback backup and a reviewed downtime plan. No restoration was performed as part of feature verification.

## Migration and deployment

For an existing project, apply these **in order**, after backup/review:

```powershell
npx.cmd --yes supabase@2.120.0 db query --linked --project-ref YOUR_PROJECT_REF --file supabase/updates/0017_access_maintenance_reschedule.sql
npx.cmd --yes supabase@2.120.0 db query --linked --project-ref YOUR_PROJECT_REF --file supabase/updates/0018_booking_policy_coverage.sql
```

Do not rerun them or `setup.sql` against an installed schema. Future coverage updates need their own incremental migration. Regenerate installer/archive schema with `npm.cmd run db:bundle`; frontend and database policy versions must match.

Redeploy `create-paymongo-checkout`, `process-refund`, `export-application-data` and `public-assistant`. Their existing server configuration is reused; no new browser secret is required. The functions rely on hosted Supabase URL/anon/service-role settings and existing provider credentials, with `APP_URL` matching the Vercel origin. Publish the frontend and verify the same migrations are present before archive generation. Backup schema-version mismatch is intentionally rejected.

## Changed implementation files

- Booking UI/services: `src/pages/ReservationWizard.tsx`, `src/components/BookingFields.tsx`, `BookingDetails.tsx`, `RefundRequest.tsx`, `RescheduleForm.tsx`, `src/lib/booking.ts`, `booking-constants.ts`, `calendar.ts`, `refunds.ts`, `format.ts`, `src/data/coverage.json`, `src/booking.css`.
- Customer/staff/admin: `Customer.tsx`, `Admin.tsx`, `SystemAdmin.tsx`, `AdministrationControls.tsx`, `ManagerOperations.tsx`, `SystemSettings.tsx`, `UserAdministration.tsx`, `Legal.tsx`, `Public.tsx` under `src/pages/`.
- Authorization/navigation: `src/features/auth.tsx`, `src/lib/permissions.ts`, `src/layouts/Layouts.tsx`, `src/app/router.tsx`, `src/main.tsx`, `src/types.ts`.
- Backend: migrations/updates `0017_access_maintenance_reschedule.sql` and `0018_booking_policy_coverage.sql`; bundled `supabase/setup.sql`; `scripts/bundle-sql.mjs`; generated `_shared/backup-schema.ts`; suspension-aware checkout/refund functions, versioned archive endpoint and `_shared/assistant.ts`.
- Tests: `tests/database.test.ts`, `tests/booking.test.ts`.

## Verification and remaining limits

Automated verification passes 74 tests, including actual PostgreSQL migration execution; country/parent-code restrictions; saved contact/privacy consent; all birthday subsets; pending/approved uneven Wedding pricing fixtures; suspended account/staff checks; reschedule ownership, availability, pending preservation and approval; exact five-day/UTC boundaries; cumulative refund fee; provider confirmation idempotence while maintenance is enabled; backup allowlist permissions. Wedding figures used by tests are isolated fixtures, never deployed seeds. Lint, frontend TypeScript checks, server function type checks and production build passed.

Both incremental migrations were applied to the hosted project in order, and the four listed Edge Functions were redeployed. Browser acceptance against the hosted database passed for new contact/consent, setup pricing, partial-Wedding blocking, server quote persistence, original-month rescheduling and manager approval, direct-route role protection, suspension/reactivation, maintenance controls/public spinner/secured bypass, and a real 35-table schema-bearing archive download with matching checksum. Only the authorized test accounts and a temporary unpaid booking were used; the booking/alternate contact/test notifications were removed and account/maintenance settings restored. Immutable audit evidence remains. A before/after hash comparison across six existing reservation/financial tables confirmed their existing records were preserved.

No live paid payment/refund, actual delivery of email, automated backup schedule or restore drill is claimed. The October 14 DOCX/PDF remain their original documentation snapshot; this handoff describes the October 15 feature revision.

Terms/Privacy are readable implemented drafts, not legally approved/certified documents. Owner/legal review must confirm policy wording, the responsible privacy contact and retention schedule. Source guidance: [National Privacy Commission, RA 10173](https://privacy.gov.ph/Data-Privacy-Act/), [PSA Bulacan classifications](https://psa.gov.ph/classification/psgc/citimuni/0301400000), [PSA provincial summary](https://psa.gov.ph/classification/psgc/summary) and the [PSGC directory source](https://psgc.gitlab.io/api/provinces/), consulted October 15, 2026.
