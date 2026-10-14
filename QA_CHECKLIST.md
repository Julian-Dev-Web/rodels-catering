# QA and acceptance record

## Verified in this workspace

- [x] Source is in `C:\Users\AMD\rodels-catering-react`; all 181 inventoried legacy files were hash-verified unchanged during the original rebuild. Machine-specific scan helpers/inventory were removed during the later hosting cleanup; the PHP folder remains outside this project and untouched.
- [x] Dependencies install; lockfiles are included. Dependency audit reports zero vulnerabilities.
- [x] ESLint, frontend TypeScript, Deno Edge Function type checks, and production Vite build run successfully (rerun with the commands below after changes).
- [x] 35 automated tests: role-route permissions; Manila report date boundaries; actual PostgreSQL price/selection checks; mixed extra-chair allocation; duplicate active customer/date protection; three-slot capacity trigger; strict cancellation cutoff; monthly reschedule limit and approved date change; partial/full/balance checkout amounts; payment mismatch rejection and idempotent confirmation; payment receipt at full capacity; cancellation balance/capacity release; 30% down-payment / 70% full-payment refund calculation; stored eligible amount, refund allocation, ambiguous-operation lock and completion; metadata role escalation rejection; direct role/payment/reservation/audit write denial; cross-customer reservation/support privacy; avatar/gallery Storage policy predicates; manager/super-admin permissions; maintenance; support threading/resolution; notification recipient protection; webhook HMAC/mode/tampering/replay verification; hosted SQL bundle execution and refusal to overwrite an existing schema.
- [x] Historical browser verification: six Chromium checks passed across desktop and iPhone-size viewports during the original rebuild. Downloaded browsers, generated screenshots/reports and the browser-test tooling were removed during hosting cleanup. These checks are not rerun by the current `npm test` command.
- [x] Thirteen migration files (including catalog/gallery seed), a combined hosted SQL Editor setup, required domain tables, enums, indexes, default-deny RLS, Storage bucket/policy definitions, notification Realtime publication and RPC replacements are present. Domain migrations execute cleanly in PostgreSQL/PGlite with Auth/Storage scaffolding.
- [x] Original logo/event assets and sourced company information are included. No fake historical financial/customer records or privileged demo passwords are seeded.
- [x] Server-only checkout/webhook/role/refund/email functions are implemented; return pages never confirm payment.
- [x] README, migration notes, schema contract and security/recovery notes are included.

The automated PostgreSQL tests use real SQL grants, functions, triggers and RLS. Auth identity, Storage catalog and publication scaffolding are mocked, and pgcrypto installation is skipped because gen_random_uuid is built into the embedded runtime. Browser checks currently cover public/auth entry pages; authenticated UI integration needs the stack below. **These passes are not a claim that the deployed Supabase/PayMongo acceptance checklist is complete.**

## Hosted deployment target

The user selected Supabase.com and frontend hosting for browser access from a friend's laptop. A local container runtime is no longer a setup prerequisite. The developer `.env` now connects to hosted project `azjzapendjsfouysueiw`; read-only API requests retrieved the three seeded packages and `maintenance=false`. The user reports completing the SQL installer. This does not verify hosted Auth, Storage or Realtime workflows. Edge Functions and frontend hosting are still pending.

The registration/recovery update passed 35 automated tests, ESLint and the production build. New checks cover structured signup names, optional middle name, normalized Philippine mobile, password confirmation, expired recovery callbacks and prevention of role escalation after the profile update. The developer server previously returned the app shell with HTTP 200 for `/`, `/register`, `/login` and `/customer/reservations`. These HTTP checks do not exercise browser rendering or authentication; complete the acceptance checks below using real accounts.

The user supplied `https://rodels-catering.vercel.app` as the deployed frontend; an HTTP check returned 200 and the expected app title. Public Auth settings confirm email login/signup enabled and email confirmation required. A hosted schema check reports `profiles.first_name` absent, so `supabase/updates/0013_profile_names.sql` must be applied before structured profile editing or test-account provisioning. Password email delivery/reset, privileged test-account creation, Edge Function deployment and PayMongo provider tests remain unverified. See `HOSTED_AUTH_PAYMENTS.md` for the exact setup steps; no operator or payment secrets are committed.

## Real Supabase acceptance — pending setup

- [ ] Run `supabase/setup.sql` once on a fresh hosted project and verify pgcrypto, Auth trigger, Storage policies and Realtime publication. Existing public tables must stop the initial setup without being deleted.
- [ ] Set hosted client variables in Vercel (and `.env` for developer preview) and hosted function secrets; confirm the frontend uses the same project and exact trusted origin.
- [ ] Register two customer accounts, verify the emails, sign in/out, restore session and reset password. Registration metadata must never assign a role.
- [ ] Bootstrap a verified owner super admin via restricted SQL, assign a manager through the UI, and check every role route. Test direct PostgREST requests as anon/customer/manager/super_admin; denied client writes must stay denied.
- [ ] Complete all wizard steps with PSGC names or manual location fallback, a valid event contact, exact package dish count, drink, dessert, setup, mixed chairs, tables, features and add-ons. Compare displayed saved quote to the SQL result.
- [ ] Reload/resume/edit an unpaid booking; then verify approval/payment/pending-checkout blocks edits. Archive a selected item before finalization and verify server rejection.
- [ ] Run simultaneous approvals/payment confirmations/reschedules from separate PostgreSQL connections for one date; the fourth approved slot must fail or remain for_approval without losing a receipt. Test same customer/date races.
- [ ] Verify three-day lead time, 07:00–22:00 event times, strict cancellation cutoff, cancellation approval/rejection, successful reschedule monthly limits, and duplicate-date prevention after refund states.
- [ ] Upload avatars from two accounts; cross-folder writes/deletes must fail. Upload, edit caption, publish/archive and delete gallery entries as super admin; manager/customer writes must fail. Confirm MIME/size limits through the real Storage HTTP API.
- [ ] Confirm in-app notices arrive via Realtime, remain private, link to correct role routes and support read/unread updates. Check polling fallback.
- [ ] Customer feedback accepts only an owned completed reservation. Support messages remain in the correct private thread; manager replies/resolution notify the customer and prevent replies to a closed thread.
- [ ] Manager catalog CRUD, reservation review/completion, cancellations, reschedules, payment CSV, feedback and support workflows work in the browser.
- [ ] Super-admin packages/setup/furniture/extras, users/role assignment, gallery, maintenance/refund settings and audit browsing work. Browser role updates and super-admin elevation/demotion must fail.
- [ ] Verify monthly comparison metrics, top packages, weekly/monthly chart counts, setup counts, and report date filters in Asia/Manila.
- [ ] Enable maintenance while a customer is signed in: customer reads/writes and public catalog close, super admin can still sign in, and a legitimate in-flight payment webhook can still reconcile.

## PayMongo test acceptance — pending credentials

- [ ] Register a test webhook with the signing secret; configure PayMongo test key and APP_URL as server secrets.
- [ ] Exercise 50% down payment, full payment and balance checkout in the provider sandbox, including accepted payment methods for the merchant account.
- [ ] A success redirect or forged browser payment write does not change payment state. Wrong HMAC/mode/currency/amount/session must fail. Duplicate valid webhook delivery produces exactly one transaction.
- [ ] Test payment at full capacity: receipt is retained, approval is withheld, customer/staff are notified.
- [ ] Approve valid cancellations, request both partial/full policy refunds, change the configured rate afterward, and verify the stored amount stays fixed.
- [ ] Process refunds against original provider payments, including a refund spanning down payment and balance payment. Test pending/processing/succeeded/failed provider states and status polling without duplicate creation.
- [ ] Interrupt checkout/refund after provider creation to exercise the documented ambiguous-operation reconciliation process. Stale local retry deadlines must not authorize duplicate charges.

## Release operations — pending

- [ ] Replace illustrative package/menu/setup prices and selections with the reviewed real business catalog. Confirm photo publication rights, contacts and policy decisions, including the documented omitted overdue penalty and monthly reschedule correction.
- [ ] Configure Supabase production Auth mail, redirect allowlist and email confirmation. If non-auth email is enabled, verify Resend sender/secrets, scheduled worker authentication and idempotency.
- [ ] Rotate exposed legacy provider/database/email/AI credentials independently; confirm the new bundle has no service/provider secrets.
- [ ] Back up database and Storage; test isolated recovery. Complete staging reconciliation before any historical data import or cutover.
- [ ] Deploy frontend with Vercel SPA routing, apply migrations/functions to the intended Supabase project, and retest nested routes and exact-origin CORS.

## Reproduce local verification

```sh
npm ci
npm run lint
npm run typecheck
npm run typecheck:edge
npm test
npm run build
npm audit
```

Tests do not charge PayMongo, publish a site, send messages to real customers, or change the original PHP application. After hosting cleanup, the current automated suite retains PostgreSQL business-rule/security and unit tests; do the pending authenticated browser checks against the configured hosted service.
