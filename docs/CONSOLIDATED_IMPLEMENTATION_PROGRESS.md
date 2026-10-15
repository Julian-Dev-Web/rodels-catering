# Consolidated implementation checkpoint — October 15, 2026

Latest follow-up: [calendar navigation and booking form retention](NAVIGATION_FIXES_2026-10-15.md), implementation commit `3b0ed21`. The clickable month/year chooser and Terms/Privacy/Back/reload draft fixes are published and production-browser verified. The current suite has 93 passing tests. The consolidated release notes below retain their original verification record.

Request source: user attachment `13502722-6b68-4b84-9d66-c067031a83e4/Pasted text.txt`. Continue in the existing repository; do not rebuild or reset working modules. Prior shipped release is `2b9c374`, with verification report `d739c26`; migrations 0017/0018 already installed on hosted Supabase. Do not rerun existing updates or the fresh installer.

## Requested scope and initial audit (historical)

| Area | Current evidence | Required follow-up |
|---|---|---|
| Hero / redundant CTA | `Public.tsx`: static approved Facebook image; separate redundant sign-in panel | Five-second carousel with accessibility/pause/fallback; remove only specified panel |
| Decisions | `Admin.tsx`: guarded SQL transitions with confirmations; no optional rejection reason | Persist optional editable suggested reasons and expose real history/notifications |
| Reports | `Admin.tsx`, `ui.tsx`: complete paginated API reads; table pages fixed at 10; raw exports | Unified filtered dataset, sorting/page sizes, readable CSV, multipage PDF/print and factual financial interpretation |
| Detail/reference | `BookingDetails.tsx`, `reservation_summary`: resolved selections but no public immutable reference | Unique backend-generated/backfilled reference; structured contact/location/payments/actual history |
| Hours | Existing DDL limits event start 07:00–22:00; no approved weekday/holiday schedule | Secure configurable hours/exceptions; no invented actual hours/duration; current-step/backend/approval/reschedule enforcement |
| Mobile numbers | `account.ts`, `booking.ts`, migration 0013/0018 use different regexes; booking strips invalid input | Shared strict three-format validator, safe input handling, normalized alternate deduplication, backend validation |
| Setup extras | Active catalog and price snapshots already exist; optional archived items must stay archived | Check compatibility across Buffet/Birthday/Wedding and add-on quantities without new products/prices |
| Elegant Chair count | Fixed setup component and separate ₱10/guest seating upgrade have different meanings | Guest-capped count, persisted snapshot; owner-approved included count/rate configuration; no invented multiplication |
| Demo staff | Existing designated accounts passed normal hosted login in previous QA | Reproduce reported failure, refresh/header diagnostics and reload tests; keep Auth/RLS intact; repeatable private provisioning guide |

## Pending business questions

Owner confirmed Monday–Saturday 7 AM–10 PM; Sunday 8 AM–9 PM. Owner clarified Elegant Chair quantity means guest seating: ₱10 each for selected chairs, max guest count; remaining Monoblock chairs included. Keep fixed setup components separate and unchanged. These confirmations supersede the attachment's ambiguity about setup chair allowances. No holiday closures or event duration were supplied; expose controlled exceptions and retain the existing three-event daily limit, without inventing hourly overlap/duration rules. Previous Wedding six-item price breakdown remains pending.

## Continuation rules

- Preserve existing quotes, payments/refunds, primary contacts and historical out-of-region addresses. The human reference is the only planned legacy reservation backfill.
- Secrets and demo passwords stay in ignored operator/private files; never copy them to docs, frontend or Git.
- The unrelated file `Catering React Supabase` with a trailing special character is user-owned; leave it untouched.
- User approved test-account live QA with a temporary unpaid booking, guest suspension/reactivation and brief maintenance, followed by exact cleanup/restoration. No real financial transaction or restore is authorized by that QA approval.
- Record actual completed work/test results below as implementation progresses; unfinished rows above are not passing evidence.

## Current progress

Migration `0019_consolidated_booking_operations.sql` and its generated update/installer/archive schema are complete. The update was applied to the hosted project; original booking/financial-row preservation passed against the fresh pre-update baseline. Do not rerun 0019 or the fresh installer there. The archive and public-assistant Edge Functions were redeployed. Implementation commit `92c4586` was pushed to GitHub main. The matching Vercel entry bundle `/assets/index-By64xx2X.js` was verified live.

Current source changes: hero rotation/pause/fallback and redundant panel removal; shared strict phone validator and safe paste handling; quantity-based mixed guest seating; operating-hours controls and date/time selection/revalidation; immutable RC/PM/TX references with legacy backfill; optional rejection reasons, customer-visible actual history and structured staff details; complete filtered CSV/PDF/print reports with pagination/sorting, actual financial interpretation and embedded licensed Noto fonts; explicit session headers/refresh for protected Edge calls; restricted demo operator script and guide.

Latest verification: 87 automated tests passed across seven files; frontend TypeScript/production build and lint passed. The build retains a size advisory for the main bundle; report libraries load lazily. Narrow four-page and full thirteen-column three-page PDF fixtures passed repeated-header/page-number/Unicode/bounds checks and visual inspection.

Local frontend + hosted backend browser acceptance passed 19 checks, including carousel/reduced motion, preserved menu CTAs, Sunday times, contact/consent, mixed chair quantity pricing, blocked partial Wedding configuration, structured staff details, editable rejection Cancel, filtered CSV/PDF downloads, page size/sort, reschedule request/approval, normal Manager/Super Admin login/reload, authorization/suspension/maintenance, and actual archive download/checksum. The temporary unpaid booking was cleaned; test contact/account/maintenance state was restored. Audit records remain. No real money movement or restore was tested.

Read-only hosted operator audit found both designated staff accounts confirmed, active and correctly mapped; no identity repair or password reset was performed. “Auth required” did not recur in normal fresh login/reload or protected archive download. Particular stale user sessions remain unverified; no authentication bypass was introduced.

Final Edge checks passed for all seven functions; original hosted booking/financial-row preservation passed again after cleanup. The staged-file scan found no private files or secret patterns. Production browser acceptance then passed ten read-only checks at `https://rodels-catering.vercel.app`: new hero/menu CTAs; anonymous staff denial; normal Manager/Super Admin login and reload; reports/page-size control; operating-hours page; Manager denial of super-admin routes; and an actual protected schema-bearing archive/checksum download. No production configuration or booking was changed during this final pass.

The requested consolidated implementation and publication are complete. See [the handoff](CONSOLIDATED_UPDATES_2026-10-15.md) for code locations, deployed migration, commands and the outstanding owner/provider/legal/recovery actions. Keep all QA credentials, archives and screenshots private. The unrelated user file is the only unstaged workspace item.

Continuation: avoid rerunning `.private/complete-consolidated-migration.mjs` or `.private/refine-consolidated-source.mjs`; they appended/transformed the initial draft and are not idempotent. Any additional database fix now needs a new migration because 0019 is deployed. When live QA runs, remove temporary `reservation_decisions` before deleting its temporary booking. Snapshot export covers 38 public tables and reference sequence state. Preserve original quote/financial fields. The unrelated user file remains untouched.
