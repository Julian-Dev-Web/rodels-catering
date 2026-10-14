# RodelConnect evidence audit

Submission date: October 14, 2026. Repository baseline: `a5f38b2` on `main`.
This audit precedes the paper and figures. Status refers to the inspected source
and recorded checks, not a certification of production readiness. Real keys,
passwords, customer records and provider transaction identifiers are excluded.

| Feature / claim | Code path or migration | Evidence | Status |
| --- | --- | --- | --- |
| React/TypeScript client SPA | `package.json`, `src/main.tsx`, `src/app/router.tsx` | React 19 dependency, Vite build, BrowserRouter and lazy portal pages | Implemented |
| Three authenticated roles | `src/lib/permissions.ts`, `0002_enums.sql`, `0009_rls.sql` | Exact role strings: customer, manager, super_admin; UI guards and database policies | Implemented |
| Structured registration and mobile contact | `src/pages/Auth.tsx`, `src/lib/account.ts`, `0013_profile_names.sql` | First/optional middle/last names; normalized PH mobile; password confirmation; Auth trigger defaults to customer | Implemented |
| Password recovery | `src/features/auth.tsx`, `src/pages/Auth.tsx`, `src/app/router.tsx` | Recovery-event routing, expired-link state, updateUser and local sign-out; hosted API recovery/reset and redirect verified in prior setup | Partial: inbox delivery and browser reset acceptance not verified |
| Catalog and public pages | `src/pages/Public.tsx`, `src/features/catalog.ts`, `0012_seed.sql` | Active packages, gallery, business/about and policies; seed catalog is illustrative | Implemented; business catalog approval pending |
| Reservation wizard | `src/pages/ReservationWizard.tsx`, `src/features/reservations.ts`, `0010_functions_triggers.sql` | Event, menu, setup/extras/seating and final review; server save/finalize RPCs; hosted customer API save/finalize verified | Implemented; complete browser acceptance pending |
| Scheduling limits | `0005_reservations.sql`, `0010_functions_triggers.sql` | One active customer/date; max three capacity-holding reservations/date; advisory lock; three-day lead time; 07:00–22:00; strict cancellation cutoff; monthly reschedule limit | Implemented and locally SQL-tested; concurrent hosted stress test pending |
| Server-authoritative pricing | `private.calculate_price`, `save_reservation`, `finalize_reservation` in `0010_functions_triggers.sql` | Integer centavos, package minimum/exact dish count, selected extras, extra chairs and saved quote | Implemented and locally SQL-tested |
| PayMongo checkout | `supabase/functions/create-paymongo-checkout/index.ts`, `begin_checkout` | Authenticated customer; canonical partial/full/balance amounts; GCash/card; one pending checkout and provider claim; deployed test checkout created | Partial: test creation verified; completed payment not verified |
| Payment confirmation | `paymongo-webhook/index.ts`, `_shared/signature.ts`, `confirm_provider_payment` | Raw-body SHA-256 HMAC, mode/timestamp check, independent provider lookup, amount/session match, idempotent transactions | Implemented; unsigned hosted event rejected; successful paid delivery pending |
| Refund workflow | `process-refund/index.ts`, `request_refund`, `claim_refund`, `finish_refund` | Approved cancellation, frozen eligibility, per-payment allocations, one-time claim and provider-status reconciliation | Implemented and locally SQL-tested; provider refund completion pending |
| In-app notifications | `src/layouts/Layouts.tsx`, `0007_feedback_support_notifications.sql`, `private.notify`, `0009_rls.sql` | Recipient-private notifications, read state, Realtime publication and polling fallback | Implemented; real subscription acceptance pending |
| Auth email | `src/pages/Auth.tsx`, hosted Auth APIs | Supabase verification/recovery calls; no app SMTP credentials included | Partial: actual delivery/custom SMTP not verified |
| Transactional email | `send-transactional-email/index.ts`, `scripts/dispatch-emails.mjs`, `email_deliveries` | Optional Resend API, worker secret, stored recipients and deduplication | Partial: function deployed; Resend secrets/schedule/delivery not verified |
| SMS notifications / phone OTP | Source and dependency search | Mobile is contact data; no SMS SDK/provider/OTP flow | Cannot verify; no implementation found |
| Geographic selectors | `src/services/psgc.ts`, `ReservationWizard.tsx` | Public PSGC API, cached selectors and manual-address fallback; not a shipping service | Implemented |
| Support and feedback | `src/pages/Support.tsx`, `Customer.tsx`, `0010_functions_triggers.sql` | Private threaded support; staff replies/resolution; feedback only for owned completed reservation | Implemented and locally SQL-tested |
| Admin/manager operations | `src/pages/Admin.tsx`, `0011_dashboard_views.sql` | Catalog scopes, workflow reviews, reports, CSV, roles, gallery, maintenance and audit browsing | Implemented; complete authenticated UI acceptance pending |
| Storage | `Settings.tsx`, `Admin.tsx`, `0009_rls.sql` | Public avatars/gallery buckets; own-folder avatar writes; super-admin gallery writes; MIME/size limits | Implemented; deployed HTTP upload acceptance pending |
| Database authorization | `0009_rls.sql`, `0010_functions_triggers.sql`, `0013_profile_names.sql` | RLS, column grants, private schema, controlled SECURITY DEFINER functions, explicit execute grants, audits | Implemented and locally SQL-tested |
| Hosting and version control | `vercel.json`, Git history, README/QA setup record | GitHub main pushes; actual Vercel URL and updated entry bundle checked; CLI deployed five functions | Implemented |
| Automated CI tests | Repo workflow/config search | npm scripts and 35 recorded local tests; no .github/workflows pipeline or test step in Vercel build | Planned: enforced automated test gate |
| Managed operations | `SECURITY_NOTES.md`, platform configuration | Recovery/reconciliation guidance; vendor logging/backups available; no Sentry/cron/recovery drill evidence | Partial: procedures present; operational execution unverified |
| Integrated chatbot | Whole `src/`, functions and dependency search | No chatbot widget, endpoint, model/provider, FAQ/chat tables or chatbot SDK in current build | Planned; title retained as supplied |
| Logistics/shipping API | Whole integration search | Event address/date coordination only; no courier/rate/tracking integration | Cannot verify; not applicable to current event-service scope |
| Legal compliance / BIR invoice | `src/pages/Public.tsx`, `Customer.tsx`, `format.ts` | Reservation/refund disclosures and payment records; no dedicated privacy portal, consent ledger, registered invoice or tax-engine evidence | Partial: disclosures implemented; legal/accounting review required |
| Required template | `C:/Users/AMD/Downloads/elec5 technical documentation (1).pdf` | Twelve-page teaching template; seven chapters and Appendices A–C; rubric is a criterion, not proof of achieved features | Verified source |
| Earlier background | `C:/Users/AMD/Downloads/Rodel_Catering_Chapters_1_2.docx` | Earlier future-tense manual-workflow background; chatbot/FAQ tables and generic tiers need correction against current source | Verified background only |

Interpretation of status: implemented means code exists; partial identifies an
integration or operational verification gap; planned identifies a future feature;
cannot verify means no supporting implementation/evidence was found. Prior setup
checks are reported as observations from this session, not fabricated test-user
statistics. Business problem statements from the earlier chapters are identified
as project background rather than measured current operational outcomes.

## October 15, 2026 implementation addendum

The earlier audit above reflects its original documentation snapshot. Current changes are detailed in `docs/system-admin-gallery-update.md`. This release passed 59 automated tests, frontend/Edge type checks, lint and production build. Private browser checks verified role separation, gallery filtering/photo viewing, mobile layouts, a real export download/checksum and visible generation history.

| Feature / claim | Code path or migration | Evidence | Status |
|---|---|---|---|
| Distinct super-admin overview | `src/pages/SystemAdmin.tsx`, `src/app/router.tsx`, `0016_system_admin_gallery.sql` | Dedicated system metrics RPC requires `super_admin`; manager retains business operations | Implemented |
| Application-data archive | `supabase/functions/export-application-data/index.ts`, `public.export_application_snapshot()` | Verified Auth identity/role, service-only SQL, fixed 34-table snapshot, checksum and generation audit; credentials and Storage files excluded | Implemented; full PostgreSQL disaster recovery remains an operator procedure |
| Event gallery and showcases | `EventShowcase.tsx`, `GalleryManagement.tsx`, `0016_system_admin_gallery.sql` | Occasion filters, photo viewer, featured public content, multi-photo uploads and editor; super-admin write RLS | Implemented |
| Business Facebook photo | `public/images/facebook-showcase.jpg`, `docs/system-admin-gallery-update.md` | Original public 960 × 466 image viewed without login; caption limited to visible setup | Implemented; larger Facebook collection inaccessible without sign-in |
| Four food-card illustrations | `MenuIllustration.tsx`, `Public.tsx` | Original SVG visuals for 3/4/5/6 dishes; actual uploaded menu photos can override illustrations | Implemented |
