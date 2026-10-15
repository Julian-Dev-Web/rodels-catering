# Rodel’s Catering — hosted setup

**Frontend: Vercel. Database, Auth, Storage and Edge Functions: Supabase.com.** Once deployed, your friend opens the website URL in a browser. Their laptop does not need Node, Docker, XAMPP, source files or a database installation.

For this project's registration/name update, password recovery, requested test accounts and PayMongo test-mode setup, follow [HOSTED_AUTH_PAYMENTS.md](HOSTED_AUTH_PAYMENTS.md). The existing hosted database needs `supabase/updates/0013_profile_names.sql`; never rerun the full fresh-project installer to apply this update.

This developer workspace is connected to the hosted Supabase project `azjzapendjsfouysueiw` through the ignored `.env` file. The frontend is reachable at `https://rodels-catering.vercel.app`. The owner-confirmed catalog has four 3/4/5/6-dish menus at ₱320/₱350/₱380/₱420 per guest, 100–1,000 guests, included basic seating/setup and an Elegant Chair upgrade of ₱10 per selected guest chair. Remaining guest seats use included Monoblock chairs; fixed event setup inclusions stay separate. Supabase handles authentication, booking/payment state and server functions; the public chatbot uses Groq. PayMongo checkout has been exercised in test mode; actual paid-webhook confirmation, provider refunds and live merchant operation require separate acceptance.

The consolidated October 15 update adds operating hours/date exceptions, selected-chair quantities, immutable human references, optional rejection reasons/history, structured staff details, complete filtered CSV/PDF/print reports, strict contact validation and an accessible hero carousel. See [the current handoff](docs/CONSOLIDATED_UPDATES_2026-10-15.md) and [continuation checkpoint](docs/CONSOLIDATED_IMPLEMENTATION_PROGRESS.md). The application archive covers 38 public tables, matching schema and reference sequence state; Auth credentials and actual Storage files require separate recovery. Existing projects already on 0018 apply only incremental 0019, never the fresh installer. Prior 0017/0018 behavior and verification remain in [the historical feature handoff](docs/FEATURE_UPDATES_2026-10-15.md).

Latest menu-photo update: [representative photography and photo administration](docs/MENU_PHOTOS_2026-10-15.md). Existing projects already on 0020 apply only incremental `0021_catalog_food_images.sql`; the archive function must use the matching generated schema. The deployed project is on 0021. Do not rerun installed migrations or the fresh installer.

## 1. Set up the database on Supabase.com

Latest gallery/chat update: [placement and guest-only assistant limits](docs/GALLERY_ASSISTANT_UPDATE_2026-10-15.md). It builds on 0019 with incremental 0020: ten guest questions/day, no signed-in question-count cap, and a floating customer assistant. Already-installed migrations must not be rerun.

Use a fresh Supabase project with an empty `public` schema. If your existing project already contains tables/data, keep them and review an incremental migration before applying this setup.

1. Open your project on Supabase.com → **SQL Editor** → new query.
2. Copy the entire contents of [`supabase/setup.sql`](supabase/setup.sql), then Run once.
3. Confirm the tables were created under `public`.

`setup.sql` contains all 20 migrations in one transaction: tables, enums, business rules, RLS, Storage policies, analytics, structured profile names, the owner-confirmed catalog, system/gallery updates and the current booking/access/reporting and guest-assistant policies. Its initial check rejects existing public tables; it contains no DROP TABLE/TRUNCATE cleanup. An error rolls back setup rather than leaving a partially installed app. If the preflight stops, do not delete existing data to bypass it.

The original files in `supabase/migrations/` remain the source of truth. After changing one, regenerate the SQL Editor file with:

```powershell
npm.cmd run db:bundle
```

Run the combined setup once, not on every deployment. Later schema changes need separate incremental migrations. This SQL Editor installation does not register CLI migration history; do not run `supabase db push` on the same project without first reviewing/baselining that history.

## 2. Connect the React app

Developer setup (Node 24 LTS, or 22.12+):

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Edit `.env` using your hosted project's URL and **public anon/publishable key**:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Do not use a service-role key, database password or PayMongo secret in the frontend. `.env` is ignored by Git. For developer preview:

```powershell
npm.cmd run dev
```

React can run on localhost during development while its database is on Supabase.com. No local Supabase stack or Docker is required for this hosting workflow.

## 3. Host the frontend on Vercel

Upload/push the source to your Git repository and import it into Vercel. Use:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Set both environment variables before deploying. Rebuild/redeploy after changing them. `vercel.json` supplies nested-route SPA rewrites and security headers. `node_modules`, caches and generated build/test output do not belong in the repository; Vercel installs/builds from source.

See [Vercel’s Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Configure hosted Auth

In Supabase **Authentication → URL Configuration**, set Site URL to the final Vercel origin and allow the exact URLs:

```text
https://YOUR_FRONTEND_DOMAIN/reset-password
https://YOUR_FRONTEND_DOMAIN/customer/reservations
```

Add the equivalent localhost URLs only if you will use developer preview. Enable email confirmation, require a minimum eight-character password, and configure production email delivery in Supabase Auth. Test registration, verification, sign-in/out, session restore and password recovery.

Register and verify the owner account. Bootstrap the first super admin from the restricted Supabase SQL Editor:

```sql
begin;
update public.profiles set role = 'super_admin'
where id = (select id from auth.users where email = 'OWNER_EMAIL_HERE' and email_confirmed_at is not null);
insert into public.audit_logs(action, entity_id, details)
select 'role.operator_bootstrap', id::text, '{"role":"super_admin"}'::jsonb
from auth.users where email = 'OWNER_EMAIL_HERE' and email_confirmed_at is not null;
commit;
```

Refresh/sign in as that owner. Use `/super-admin/users` to assign customer/manager roles. There are no seeded passwords or privileged demo accounts.

## 5. Deploy server functions to Supabase

SQL installs database rules; Edge Functions are deployed separately for PayMongo, role assignment and optional transactional emails. The CLI is downloaded on demand instead of included as a permanent project dependency. `--use-api` bundles functions on the server without Docker.

```powershell
npx.cmd --yes supabase@2.120.0 login
npx.cmd --yes supabase@2.120.0 functions deploy --project-ref YOUR_PROJECT_REF --use-api
```

This reads the function settings in `supabase/config.toml`. Gateway `verify_jwt=false` is intentional: user endpoints verify sessions with `auth.getUser()`, and the webhook verifies PayMongo's signature. Do not remove those checks. [Supabase deployment instructions](https://supabase.com/docs/guides/functions/deploy) and [CLI deployment flags](https://supabase.com/docs/reference/cli/supabase-functions-deploy).

Configure server secrets in your hosted project's Edge Functions settings, or copy `supabase/functions/.env.example` to `supabase/functions/.env`, fill it privately, and run:

```powershell
npx.cmd --yes supabase@2.120.0 secrets set --project-ref YOUR_PROJECT_REF --env-file supabase/functions/.env
```

| Secret | Purpose |
| --- | --- |
| `APP_URL` | Exact final frontend origin, without a trailing slash |
| `PAYMONGO_SECRET_KEY` | Provider secret key |
| `PAYMONGO_WEBHOOK_SECRET` | Registered webhook signing secret |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_WORKER_SECRET` | Optional transactional email provider and worker |

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the functions. Never put server/provider secrets in Vercel's `VITE_` variables or Git.

Register this PayMongo webhook for `checkout_session.payment.paid`:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/paymongo-webhook
```

Use matching test/live secrets. Payment redirects never confirm payment; a signed webhook plus a provider lookup does. Test down payment, full payment, balance settlement and refunds with the provider's test environment. The server freezes ambiguous provider attempts to prevent duplicate money movement; reconciliation is documented in [SECURITY_NOTES.md](SECURITY_NOTES.md).

Optional non-auth email: schedule `node scripts/dispatch-emails.mjs` on a restricted server/worker with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `EMAIL_WORKER_SECRET`. In-app notifications work without it. Supabase Auth handles verification/recovery emails separately. The landing-page assistant defaults to GroqCloud with a server-side key; see [CHATBOT_SETUP.md](CHATBOT_SETUP.md) for setup and limitations.

## Developer checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Optional server type check: `npm.cmd run typecheck:edge` downloads Deno on demand. Tests use embedded PostgreSQL to check the actual SQL rules/RLS; no Docker or real customer/provider records are needed. Browser download tools, reports, local-stack config and machine-specific scan helpers were removed for the hosting handoff. Keep the remaining tests and security docs for future maintenance.

See [QA_CHECKLIST.md](QA_CHECKLIST.md) for hosted acceptance, [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for legacy decisions, and [supabase/SCHEMA.md](supabase/SCHEMA.md) for database contracts. The hosted connection, account setup and provider acceptance still require your project's configuration.

The owner-confirmed menu source is `src/data/rodels-menu.ts`. Run `npm.cmd run db:catalog` after approved changes to that source to regenerate its migration and SQL bundles. Existing installations use the generated 0014/0015 files under `supabase/updates/`, not the fresh installer. Review [catalog and pricing changes](docs/catalog-pricing-update.md) before reapplying the catalog replacement; it archives choices not present in that source. Saved reservation totals and financial history remain unchanged.

## Current setup-pricing update

See [Simple Buffet extras and automatic Wedding pricing](docs/SETUP_EXTRAS_2026-10-15.md). The owner confirmed PHP5,000 per component/extra. Hosted schema 0022 configures all six Wedding prices and allows five optional Simple Buffet upgrades, excluding the Elegant Chair setup inclusion. Existing projects on 0021 apply only the reviewed incremental 0022 update and deploy the matching archive schema. The connected hosted project already has it; do not rerun migrations there.
