# Demo staff setup and login

Use a separate classroom/staging Supabase project when possible. The designated existing demo accounts are `superadmin@test.com` and `manger@test.com` (the latter spelling is intentional). They sign in through ordinary Supabase Auth. Never make staff pages anonymous, relax RLS, assign roles from registration metadata or share server keys with the frontend.

## Repeatable operator checks

1. Apply the project's migrations in order to the intended environment. Installed projects use their missing incremental updates, never the fresh `setup.sql` installer.
2. In an ignored operator env file, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for that environment. The key remains operator-only.
3. Run a read-only designated-account audit:

   ```powershell
   node --env-file=.env.operator scripts/provision-demo-staff.mjs
   ```

4. Only when the audit identifies a needed repair, run the same command with `--apply`. It confirms only the designated demo emails through the Admin API, repairs their exact staff role/active status and audits changes. Existing passwords stay unchanged. To create a missing designated account, privately supply `DEMO_SUPER_ADMIN_PASSWORD` or `DEMO_MANAGER_PASSWORD` in the ignored operator env file first. No password is printed or committed. Other users are untouched; the last active super admin cannot be demoted by this script.
5. Sign in normally and reload the page. Manager goes to `/manager/dashboard`; super admin goes to `/super-admin/dashboard`. Test customer/anonymous direct access to staff URLs remains denied. Successful Auth login does not bypass account suspension or maintenance controls.

## Missing or stale sessions

The frontend keeps Supabase session persistence and automatic refresh. Protected Edge calls fetch the actual session, refresh when near expiry, and send its user access token explicitly. A genuinely missing session has a clear sign-in instruction. The public chatbot remains the sole public call through this helper; no privileged public bypass is added.

An email like `@test.com` is a classroom fixture, not a guaranteed deliverable inbox. If its password must be reset, use the operator-only Supabase user administration for that designated account, choose a fresh password privately, and update the ignored credential record. Do not turn off global verification or print passwords in class documentation.

The current browser acceptance verified normal login and reload for both designated staff accounts, including an authenticated super-admin application archive download. The operator audit needed no repair. “Auth required” was not reproduced in that fresh-session flow; this does not establish the cause of a particular older session's failure. See [the current checkpoint](CONSOLIDATED_IMPLEMENTATION_PROGRESS.md) for deployment verification and [the handoff](CONSOLIDATED_UPDATES_2026-10-15.md) for limitations.

Consulted vendor descriptions: [Supabase Edge authentication](https://supabase.com/docs/guides/functions/auth) and [API-key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys). Server-side identity/role checks are retained.
