# Gallery placement and customer assistant — October 15, 2026

The owner confirmed that the guest assistant allowance is **10 questions per day**. Signed-in users have **no daily/question-count quota**. The brief proposal of a 30/hour member cap was removed before deployment; ordinary existing burst/provider throttles remain unchanged.

## Website behavior

- **Featured:** active photos appear in the five-second landing hero slideshow. All selected photos can participate; the previous five-photo cap and production fixed-photo prepend were removed. Pausing, reduced motion, controls and broken-image handling remain.
- **Gallery only:** active photos appear in the landing gallery preview, which shows the latest three. **All** active photos, including Featured entries, remain on the full `/gallery` page. Unpublished/deleted photos are excluded; an empty configured gallery does not silently restore bundled samples.
- The hero, landing preview and full gallery share one query/cache and refresh every five seconds while visible, as well as on returning focus. Super-admin upload/edit controls explain placement. Existing gallery records/flags are preserved; no real photo was reclassified or deleted during testing.
- The floating assistant now appears throughout the customer workspace and preserves its conversation during in-app customer navigation. It offers public packages, prices, booking rules and availability; authentication does not grant it access to private booking/customer/payment records.
- Guests see remaining questions and a sign-in link. Exhausted guests cannot send more questions that day. A verified active signed-in account receives unrestricted question-count access and no guest countdown/sign-in prompt. Suspension, maintenance and provider safeguards remain.

## Server and data changes

Incremental migration `0020_assistant_usage_limits.sql` adds a private counter table and a service-only atomic quota RPC. The Edge Function verifies an actual supplied user JWT before granting member access; browser-supplied roles/user IDs do not grant it. Public facts continue through the anonymous RLS client. Invalid sessions are rejected rather than treated as authenticated.

Guest day windows reset at midnight Asia/Manila. A keyed HMAC of the forwarded network identity identifies the guest allowance; raw IP addresses and questions/transcripts are not stored in the counter table. Shared networks can share the guest allowance. Existing per-instance burst limits/provider availability remain separate from the guest daily quota. Expired counters are purged as new guest questions arrive; this is not a scheduled deletion guarantee.

Guest limits survive browser reload and Edge instance restarts. Signed-in questions create no usage-counter rows. Neither anonymous nor authenticated browser roles may read/change counters or call the quota RPC directly. Quota-status requests do not consume questions. Invalid input is validated before consumption; an accepted attempt may consume a question even if a later provider/catalog operation fails.

The application archive keeps its **38 public tables** and advances its matching DDL/version to 0020. Guest counter identities/rows are excluded. Existing booking/quote/payment/refund rows were compared with a fresh pre-migration baseline and preserved. No new secret/environment variable or paid service was introduced. The Privacy Notice now describes temporary guest usage identifiers/counters.

## Verification and deployment

99 automated tests passed, including placement/empty-gallery rules, identifiers, actual isolated SQL quotas/permissions, ten guest requests followed by rejection, reset/purge behavior, 35 member requests without a quota or counter row, and suspended/nonexistent identity rejection. Lint, frontend TypeScript/build and all seven Edge Function type checks passed. Existing main-bundle size and lazy-import advisories remain.

Migration 0020 was applied once to the existing hosted database. The matching `public-assistant` and `export-application-data` functions were deployed. Do not rerun `setup.sql` or an installed migration on this project. The fresh installer now includes all 20 migrations; SQL Editor installations still need reviewed CLI-history baselining before `db push`.

Local frontend + hosted-backend acceptance passed 13 checks: guest limit/status, invalid JWT denial, uncapped signed-in access, actual Groq interpretation, configured Featured/Gallery-only placement, full-gallery inclusion, more than five slides, open-page refresh after placement changes, empty-gallery fallback behavior, exhausted-guest login/disabled questions, floating customer chat answers, in-app conversation continuity and mobile fit. QA uses public metadata, designated test accounts and intercepted fixture responses for changing/unpublishing gallery entries and exhausted-guest UI; it does not edit real gallery records or create paid transactions. Frontend publication/production acceptance is recorded below when complete.

Consulted primary guidance: [Supabase Edge rate-limiting example](https://supabase.com/docs/guides/functions/examples/rate-limiting) and [Supabase API request controls](https://supabase.com/docs/guides/api/securing-your-api). This implementation uses PostgreSQL counters instead of an additional Redis service.
