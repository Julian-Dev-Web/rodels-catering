# Hosted Auth, test accounts and PayMongo setup

October 16 domain/email update: the main website is [www.rodelscatering.online](https://www.rodelscatering.online). An authorized test email was accepted by the provider and appeared as an in-app manager notification; actual inbox receipt awaits user confirmation. See [the current setup status](docs/REMINDER_EMAIL_SETUP.md). Earlier URLs/status statements below are historical where superseded.

Frontend: `https://rodels-catering.vercel.app`.
Supabase project: `azjzapendjsfouysueiw`.

## Current verification record

The existing-project name schema is available. The requested three test accounts
were created and their password logins and authenticated profile roles verified.
All five Edge Functions were deployed and the three PayMongo server settings
uploaded. A read-only provider check confirmed the test key, enabled webhook,
payment event and matching signing secret. A clearly labeled integration-test
reservation was saved/finalized using the customer session, and its canonical
50% checkout was created by the deployed function. The reservation remained unpaid
and did not hold capacity; an unsigned webhook request was rejected with HTTP 401.

The new guest account's recovery token, password replacement, new-password login
and rejection of the old password were verified through Supabase APIs, without
sending email. The hosted recovery redirect was verified after URL configuration.
Passwords and test-result details are stored only in ignored `.private/` files.
Actual inbox delivery, authenticated browser workflows, successful paid webhook
reconciliation and provider refunds remain pending; checkout creation alone does
not verify completed payment.

## 1. Apply the existing-project update

In Supabase SQL Editor, run the entire file `supabase/updates/0013_profile_names.sql`.
It adds structured name fields, copies explicitly supplied signup metadata,
normalizes Philippine mobile numbers, and keeps profile role assignment restricted.
Existing full names remain intact; no name splitting is guessed. Do not rerun
`supabase/setup.sql` on the already-installed project.

## 2. Enable email recovery and confirmations

In Supabase Authentication > URL Configuration:

- Site URL: `https://rodels-catering.vercel.app`
- Redirect URLs:
  - `https://rodels-catering.vercel.app/customer/reservations`
  - `https://rodels-catering.vercel.app/reset-password`
  - `http://localhost:5173/customer/reservations` (developer preview)
  - `http://localhost:5173/reset-password` (developer preview)

The app uses email/password login. Mobile is a contact number, not an SMS OTP login.
Registration accepts first name, optional middle name, last name and mobile,
and checks password confirmation. Recovery links route to the reset page;
expired links offer a new request. A successful reset signs out the local session.

Use a real inbox for recovery testing. Supabase's default SMTP only sends to
project-team addresses and has restricted delivery/rates. Configure custom SMTP
in Authentication > Email/SMTP for other recipients. A successful reset-request
response deliberately does not prove the account exists or that email arrived.
Check Auth logs and the inbox, complete the reset and verify the new password.

## 3. Create the explicitly requested test accounts

These are test identities with no usable inbox:

| Email | Database role |
| --- | --- |
| `superadmin@test.com` | `super_admin` |
| `manger@test.com` | `manager` |
| `guest@test.com` | `customer` |

The manager spelling is exactly as supplied. Anonymous visitors can browse without
an account; authenticated reservations belong to customers.

For local operator provisioning, copy `.env.operator.example` to `.env.operator`
and paste the Supabase legacy `service_role` key there. Keep it local; it grants
admin access and must never be placed in Vercel frontend variables. Then run:

```powershell
node scripts/provision-test-accounts.mjs
```

The script requires the name migration first, creates only the requested test
accounts with unique random passwords and confirmed test emails, assigns roles
through service-only access, records audits, and verifies password login and
profile access. It never sends email or resets existing passwords. Passwords are
saved in the ignored `.private/test-account-credentials.json`, not printed or
committed. Existing users are retained. Keep the operator key out of source control.
The operator command has succeeded in this workspace. Use the private credentials
file for the current passwords, including the guest password changed during the
recovery API test. These credentials are not committed.

## 4. Set up Supabase CLI

From the project folder in your own terminal:

```powershell
npx.cmd --yes supabase@2.120.0 login
```

Complete the browser login/verification shown by the CLI. The hosted deployment
uses API bundling, so Docker is not required:

```powershell
npx.cmd --yes supabase@2.120.0 functions deploy --project-ref azjzapendjsfouysueiw --use-api
```

SQL and Edge Functions are separate deployments. Do not run `db push` until the
manually installed SQL migration history has been reviewed and baselined.

## 5. Set up PayMongo test mode

Create/sign into an account at `https://dashboard.paymongo.com`. Complete the
account/merchant requirements shown there, switch to test mode, and find the
Secret Test API key in Developers/API Keys. This app uses hosted Checkout Sessions
with GCash and card; availability depends on the merchant account's enabled methods.

In the local ignored `supabase/functions/.env`, set:

```dotenv
APP_URL=https://rodels-catering.vercel.app
PAYMONGO_SECRET_KEY=YOUR_SECRET_TEST_KEY
PAYMONGO_WEBHOOK_SECRET=YOUR_ENDPOINT_SIGNING_SECRET
```

In PayMongo Developers > Webhooks, create a test endpoint:

```text
https://azjzapendjsfouysueiw.supabase.co/functions/v1/paymongo-webhook
```

Subscribe to `checkout_session.payment.paid` and copy that endpoint's signing secret
to the local file. Then upload the server secrets:

```powershell
npx.cmd --yes supabase@2.120.0 secrets set --project-ref azjzapendjsfouysueiw --env-file supabase/functions/.env
```

Only nonempty configured secrets should be uploaded; optional Resend values are
unnecessary for PayMongo or Supabase Auth email.

Finalize a customer reservation and try 50% down payment, full payment and balance
in the provider test environment. Confirmation requires a valid signed webhook,
an independent provider lookup and a successful database reconciliation. Returning
from checkout alone does not confirm payment. Test refunds only against these test
payments after cancellation/refund approval. Inspect Edge Function logs and PayMongo
webhook deliveries when a test payment remains pending. Paid webhook confirmation
and provider refund tests remain pending. Credentials and deployment are now
configured, and test checkout creation has succeeded.

## Consulted vendor documentation

- [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase default SMTP limitations](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
- [PayMongo Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [PayMongo webhook setup and verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
