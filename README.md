# Rodel’s Catering — hosted setup

**Frontend: Vercel. Database, Auth, Storage and Edge Functions: Supabase.com.** Once deployed, your friend opens the website URL in a browser. Their laptop does not need Node, Docker, XAMPP, source files or a database installation.

This developer workspace is connected to the hosted Supabase project `azjzapendjsfouysueiw` through the ignored `.env` file. A read-only API check retrieved all three seeded packages and the maintenance setting. Authenticated browser workflows, Edge Function deployment and frontend hosting still need verification/setup. For another checkout, configure its environment using the steps below. Public pages show illustrative packages while unconfigured. Catalog seed prices must be reviewed before real bookings. Original company details, logo and photos come from the legacy app.

## 1. Set up the database on Supabase.com

Use a fresh Supabase project with an empty `public` schema. If your existing project already contains tables/data, keep them and review an incremental migration before applying this setup.

1. Open your project on Supabase.com → **SQL Editor** → new query.
2. Copy the entire contents of [`supabase/setup.sql`](supabase/setup.sql), then Run once.
3. Confirm the tables were created under `public`.

`setup.sql` contains all 12 migrations in one transaction: tables, enums, business rules, RLS, Storage policies, analytics and the sample catalog/gallery. Its initial check rejects existing public tables; it contains no DROP TABLE/TRUNCATE cleanup. An error rolls back setup rather than leaving a partially installed app. If the preflight stops, do not delete existing data to bypass it.

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

Optional non-auth email: schedule `node scripts/dispatch-emails.mjs` on a restricted server/worker with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `EMAIL_WORKER_SECRET`. In-app notifications work without it. Supabase Auth handles verification/recovery emails separately. No browser chatbot/API key is shipped.

## Developer checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Optional server type check: `npm.cmd run typecheck:edge` downloads Deno on demand. Tests use embedded PostgreSQL to check the actual SQL rules/RLS; no Docker or real customer/provider records are needed. Browser download tools, reports, local-stack config and machine-specific scan helpers were removed for the hosting handoff. Keep the remaining tests and security docs for future maintenance.

See [QA_CHECKLIST.md](QA_CHECKLIST.md) for hosted acceptance, [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for legacy decisions, and [supabase/SCHEMA.md](supabase/SCHEMA.md) for database contracts. The hosted connection, account setup and provider acceptance still require your project's configuration.
