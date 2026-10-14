# Consolidated implementation handoff — October 15, 2026

This records the existing application's consolidated implementation, based on the user's supplied prompt and later business confirmations. It is an engineering handoff, not defense minutes. No customer records, credentials or provider transactions are reproduced here.

## Implemented behavior

| Area | Result | Main location |
|---|---|---|
| Public landing/menu | Authentic approved photos rotate every five seconds, with hover/focus/hidden-tab/reduced-motion pause, manual controls and failed-image fallback. Only the specified redundant sign-in panel was removed; four menu CTAs remain. | `HeroCarousel.tsx`, `Public.tsx` |
| Business schedule | Monday–Saturday 7 AM–10 PM; Sunday 8 AM–9 PM. Manager and super admin can configure audited weekday hours and individual closed/open date exceptions. Booking and rescheduling validate current hours, three-day preparation and existing three-event daily capacity. | `OperatingHours.tsx`, `EventTimeSelect.tsx`, migration 0019 |
| Guest seating | Selected Elegant Chairs cost ₱10 each, from one to guest count when enabled. Remaining Monoblock seats are included. Fixed Birthday/Wedding setup inclusions remain separate; no table quantity field or fabricated decoration-chair fee. | `ReservationWizard.tsx`, `booking.ts`, `calculate_price` |
| Phone/contact | One strict validator accepts `09XXXXXXXXX`, `639XXXXXXXXX`, `+639XXXXXXXXX`; canonical storage is `+639XXXXXXXXX`. Invalid pasted edits are rejected, not cleaned into valid numbers. Alternate contacts deduplicate without changing the primary number. | `_shared/phone.ts`, `Form.tsx`, `BookingFields.tsx`, migration 0019 |
| Booking validation | Current-step validation, inline errors/focus, availability checks and authoritative SQL validation. Address, consent, active choices, guest/seating/add-on quantities and dependencies are checked. Back navigation preserves form values. | `ReservationWizard.tsx`, migrations 0018/0019 |
| Extras/snapshots | Existing active optional features/add-ons remain available with actual quantities and server-recorded unit prices. No new unapproved catalog products were activated. Legacy quotes are retained; missing historical item charges are labeled as unrecorded. | `capture_selection_snapshot`, booking details/reports |
| Staff decisions | Editable suggested rejection replies, optional custom/blank reasons, Cancel and explicit Confirm. SQL retains transition/ownership/capacity protections; supplied reasons appear in customer notifications and actual recorded history. | `DecisionAction.tsx`, `Admin.tsx`, `reservation_decisions` |
| Human references/details | Immutable backend-generated RC reservation references and PM/TX checkout/ledger references. Structured staff detail sections resolve saved selections, actual authorized contact/email, address, itemized snapshots, payments and actual activity. | `BookingDetails.tsx`, migration 0019 |
| Reports | Search/date/status filters use the complete authorized dataset. Sorting, page sizes and pagination affect display; CSV/PDF/print include all filtered matches. UTF-8/formula-safe CSV; embedded licensed Noto fonts, repeated PDF headers and page numbers. | `Reports.tsx`, `reports.ts`, `ui.tsx`, `public/fonts/` |
| Financial interpretation | Verified ledger receipts/refunds determine cash totals; pending checkout attempts are separate. Outstanding balance counts each included booking once. Saved reservation totals are explicitly expected amounts. Unknown processor methods/historical unit amounts are not invented. | `paymentReportRows`, `paymentSummary` |
| Staff authentication | Protected Edge calls use the actual user session, refresh near expiry and send its JWT explicitly. Auth identity, role, suspension and maintenance guards remain. Restricted operator audit/provision instructions replace any need for public staff registration. | `supabase.ts`, `provision-demo-staff.mjs`, `DEMO_STAFF_SETUP.md` |
| Application archive | Schema version 0019, 38 public tables, matching application DDL and reference sequence state. Auth credentials and Storage file bytes remain separate. Restore guidance requires advancing the sequence safely. | `_shared/backup-schema.ts`, `export-application-data/` |

## Database and deployment

Migration `supabase/updates/0019_consolidated_booking_operations.sql` was applied to the existing hosted project transactionally. Do not rerun it or `setup.sql` there. The generated fresh installer includes all 19 migrations. Changes after a deployed migration need a new incremental migration, not a silently edited copy of 0019.

Original booking dates/times/status/holds, saved quotes, address, financial fields and original financial rows were compared with a fresh pre-migration baseline. The hosted check passed after installation. Immutable human references were backfilled; original UUIDs remain internal keys. The old capacity trigger was disabled only inside the transactional reference-year backfill and re-enabled before commit, avoiding changes to original update timestamps.

The updated `export-application-data` and `public-assistant` Edge Functions were deployed. No new secret or environment-variable name is required. Implementation commit `92c4586` was pushed to GitHub main; Vercel serves the matching tested entry bundle. Final production browser acceptance passed ten read-only checks, including normal staff login/reload, reports, operating-hours controls, role guards and a protected archive/checksum download. See the continuation checkpoint for the deployment record.

For a different project already on 0018, review/back up first, then apply 0019 once through SQL Editor or the restricted operator CLI:

```powershell
npx.cmd --yes supabase@2.120.0 db query --linked --project-ref YOUR_PROJECT_REF --file supabase/updates/0019_consolidated_booking_operations.sql
npx.cmd --yes supabase@2.120.0 functions deploy export-application-data --project-ref YOUR_PROJECT_REF --use-api
npx.cmd --yes supabase@2.120.0 functions deploy public-assistant --project-ref YOUR_PROJECT_REF --use-api
```

The original SQL Editor install did not register CLI migration history. Do not use `db push` until that history is reviewed/baselined. Never put operator or provider secrets in frontend variables/Git. Existing `APP_URL`, PayMongo and chatbot server configuration remain separate from frontend deployment.

## Verification

- 87 automated tests passed across seven files, including the real isolated PostgreSQL schema/RLS/functions, reference immutability, role boundaries, strict contacts, Sunday/closed hours, transitions/reasons, rescheduling and quantity/snapshot pricing.
- Frontend TypeScript/production build, lint and type checks for all seven Edge Functions passed. The build retains a main-bundle size advisory; report dependencies load lazily. Original hosted booking/financial-row preservation passed again after QA cleanup.
- Browser acceptance used the current local frontend with the real hosted backend and designated test accounts. It passed carousel/reduced motion, four menu CTAs, Sunday hours, contact/consent persistence, mixed guest seating and setup rules, structured details, editable rejection Cancel, filtered CSV/PDF downloads, sorting/page size, request/approval rescheduling, normal staff login/reload, role/suspension guards, maintenance restoration and authenticated archive/checksum.
- The single temporary unpaid booking and its related records/notifications were cleaned. Test contact/account state and maintenance settings were restored. Immutable audit evidence was retained. No real paid checkout, provider refund or production restore was performed.
- Fake report fixtures rendered as a four-page narrow report and a three-page thirteen-column landscape report. Repeated headers, page numbering, Unicode and page bounds passed; pages were visually inspected without clipping. These are export tests, not screenshots of real transactions.
- A read-only operator audit found both designated staff identities already confirmed, active and correctly mapped; no password reset/account repair was needed. Normal browser acceptance did not reproduce “Auth required.” A particular user's old/stale session cannot be diagnosed from this result alone.

## Outstanding facts and actions

1. Obtain six owner-approved Wedding component prices totaling ₱30,000 before allowing partially selected Wedding bundles. The full ₱30,000 bundle remains available; partial configuration remains explicitly blocked.
2. No holiday closure list or event-duration rule was supplied. Date exceptions start empty and require staff configuration. Time choices/custom times are permitted start times, not assumed service duration or hourly concurrency.
3. Complete PayMongo paid-webhook/refund acceptance, actual Auth/Resend inbox delivery, legal/privacy approval/contact/retention, and a staging restoration drill including separate Auth/Storage recovery. These are not certified by source or browser tests.
4. Rotate credentials exposed during setup through their providers and update private/server configuration. Secret values and classroom passwords are excluded from this handoff.
5. The original October 14 DOCX/PDF remains a historical source snapshot; this update does not silently replace its schema figures or claim a new formal paper export. Use the current evidence/revision addenda for new slides.
