# UI and public assistant verification — October 14, 2026

This is an addendum to the earlier technical-documentation snapshot, not evidence of historical defense comments or live financial transactions.

| Change | Evidence | Verified status |
| --- | --- | --- |
| Password visibility | `src/components/Form.tsx`; real browser registration and login checks | Show/hide buttons work without submitting the form |
| Strong-password guidance | `src/components/PasswordChecklist.tsx`, `src/lib/account.ts`, `tests/account.test.ts` | Live checklist, matching confirmation, and validation for 8 characters, uppercase, lowercase, number and special character; existing-password login has no new complexity gate |
| Preparation lead time | `supabase/functions/_shared/booking-date.ts`, `ReservationWizard.tsx`, `Customer.tsx`; actual PostgreSQL RPC tests | Today, tomorrow and day two are rejected; day three is accepted. Manila calendar days, not a rolling 72-hour rule |
| Notification readability | `src/styles.css`, `src/components/ui.tsx`, `src/layouts/Layouts.tsx` | Dark wine text on white button, readable notice body, visible unread marker; an existing test notice was marked read and restored after verification |
| Landing-page assistant | `PublicAssistant.tsx`, `supabase/functions/public-assistant/index.ts` | Function deployed; browser quick questions return the live public catalog and aggregate available dates |
| OpenAI natural-language interpretation | Responses API integration in `public-assistant`; server-side key configured | Implementation and Deno checks pass. Live provider returned HTTP 429 `credit_balance_exhausted` / `insufficient_quota`. Successful AI interpretation remains unverified until API credits are available |
| Mobile interaction | Isolated Chrome at 390 × 844 | No horizontal overflow on registration or chat; assistant focuses the question input and Escape returns focus to its toggle |

Validation: 42 tests passed, frontend type check/build passed, lint passed, and all six Edge Functions passed Deno checks. Private test credentials, local secrets, browser profiles and QA screenshots remain ignored by Git.

Public chat has bounded requests, provider output and per-instance request/concurrency limits. It uses an anon database client, never changes reservations, and does not access private customer/financial tables. In-memory rate limits are not a durable global quota. Quick answers are labeled separately from AI responses.

Manual actions: replenish the OpenAI API credit balance and replace the key exposed in chat, then update the ignored server environment and Supabase secret. See [CHATBOT_SETUP.md](../CHATBOT_SETUP.md). OpenAI identifies this error as depleted prepaid credits and instructs adding credits: [official error guide](https://developers.openai.com/api/docs/guides/error-codes).
