# UI and public assistant verification — October 14–15, 2026

This is an addendum to the earlier technical-documentation snapshot, not evidence of historical defense comments or live financial transactions.

| Change | Evidence | Verified status |
| --- | --- | --- |
| Password visibility | `src/components/Form.tsx`; real browser registration and login checks | Show/hide buttons work without submitting the form |
| Strong-password guidance | `src/components/PasswordChecklist.tsx`, `src/lib/account.ts`, `tests/account.test.ts` | Live checklist, matching confirmation, and validation for 8 characters, uppercase, lowercase, number and special character; existing-password login has no new complexity gate |
| Preparation lead time | `supabase/functions/_shared/booking-date.ts`, `ReservationWizard.tsx`, `Customer.tsx`; actual PostgreSQL RPC tests | Today, tomorrow and day two are rejected; day three is accepted. Manila calendar days, not a rolling 72-hour rule |
| Notification readability | `src/styles.css`, `src/components/ui.tsx`, `src/layouts/Layouts.tsx` | Dark wine text on white button, readable notice body, visible unread marker; an existing test notice was marked read and restored after verification |
| Landing-page assistant | `PublicAssistant.tsx`, `supabase/functions/public-assistant/index.ts` | Function deployed; browser quick questions return the live public catalog and aggregate available dates |
| Natural-language interpretation | `assistant-provider.ts` supports GroqCloud (default) and explicitly selected OpenAI | Groq key configured on the server; deployed HTTP 200 responses identify engine `groq`. Taglish package-price/guest-count questions return current catalog estimates, “bukas” is blocked with the correct preparation minimum, a valid specific date and a combined prices/dates question return live slots, and an unrelated request receives a catering-scope response. The minimum date correctly advanced across Manila midnight. No automatic paid-provider fallback is allowed |
| Mobile interaction | Isolated Chrome at 390 × 844 | No horizontal overflow on registration or chat; assistant focuses the question input and Escape returns focus to its toggle |

Validation: 45 tests passed, frontend type check/build passed, lint passed, and all six Edge Functions passed Deno checks. Tests also verify Groq default selection, no automatic paid-provider fallback, bounded structured extraction and incomplete/provider-error handling. The Vercel site was verified in a real mobile-sized browser for password visibility, checklist, accessibility labels and live catalog/calendar quick answers. Private test credentials, local secrets, browser profiles and QA screenshots remain ignored by Git.

Public chat has bounded requests, provider output and per-instance request/concurrency limits. It uses an anon database client, never changes reservations, and does not access private customer/financial tables. In-memory rate limits are not a durable global quota. Quick answers are labeled separately from AI responses.

Manual actions: rotate the Groq key exposed in chat and revoke the unused exposed OpenAI key through their provider dashboards. Save replacement keys privately and update the Supabase secret. Groq plan/organization limits remain provider-controlled; the presence of a working key does not verify billing settings or guarantee unlimited traffic. See [CHATBOT_SETUP.md](../CHATBOT_SETUP.md). Groq documents a limited [Free plan](https://console.groq.com/docs/rate-limits); Grok from xAI is a different service with [paid API usage](https://x.ai/api).
