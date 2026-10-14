# Reconstructed revision and action matrix — for team confirmation

This matrix is prepared from the actual source changes, earlier draft and setup
record. **It is not an authenticated list of first-defense panel comments or
meeting minutes.** No original comment list, minutes, panel names or meeting date
was supplied. Team members must confirm recalled requests before presenting any
row as an actual panel instruction. “Completed” below describes the stated code
or documentation action, not complete production acceptance.

| ID | Reconstructed issue / requested revision | Actual action taken | Current status | Where to find it / evidence |
| --- | --- | --- | --- | --- |
| R01 | Align the architecture with the current application | Documented React/Vite SPA, Supabase Auth/PostgreSQL/RLS and Deno Edge Functions; separated PHP/MySQL legacy history | Completed documentation correction | Chapter 2; `src/main.tsx`, `src/app/router.tsx`, `supabase/functions/`, Figure 2.1 |
| R02 | Collect separate names and mobile contact at registration | Added first name, optional middle name, last name, PH mobile normalization and password confirmation; added incremental migration | Implemented; local tests passed | Appendix A; `src/pages/Auth.tsx`, `src/lib/account.ts`, migration 0013; real registration screenshot |
| R03 | Make password recovery usable | Added recovery routing, expired-link guidance, clean auth-page navigation and local sign-out; verified recovery API and hosted redirect | Partial: inbox delivery/browser acceptance pending | Chapters 1/6; Appendix A; `src/features/auth.tsx`, `src/pages/Auth.tsx`; `HOSTED_AUTH_PAYMENTS.md` |
| R04 | Clarify administrator, manager and guest access | Used exact customer/manager/super_admin roles, UI route guards, RLS and protected role RPC; provisioned and verified three requested test-role accounts | Implemented/API login verified; complete role UI testing pending | Chapter 1.2; Chapter 6.1; `src/lib/permissions.ts`, `0009_rls.sql`, `admin_set_role` |
| R05 | Connect online payment processing | Deployed PayMongo checkout/webhook/refund functions; configured test keys and enabled webhook; created a real test checkout through customer API | Partial: paid delivery and provider refund completion pending | Chapter 4.1; Figure 2.3; `create-paymongo-checkout/`, `paymongo-webhook/`, `process-refund/` |
| R06 | Prevent browser redirects or forged requests from confirming payment | Verified raw-body HMAC/mode/timestamp, independent provider fetch, canonical amount/session and idempotent SQL confirmation | Implemented; unsigned hosted webhook rejected | Chapter 6.1; `_shared/signature.ts`; `confirm_provider_payment`; `tests/rules.test.ts`, `tests/database.test.ts` |
| R07 | Enforce booking eligibility and scheduling limits consistently | Moved authoritative validation, active customer/date uniqueness, three-slot capacity locking, cancellation cutoff and monthly reschedule counting into SQL | Implemented/local SQL-tested; hosted concurrent stress test pending | Chapter 2.3; migrations 0005/0010; `tests/database.test.ts` |
| R08 | Explain pricing, balances and refund rules accurately | Documented integer centavos, saved quote, 50% down payment, balance settlement, configurable seeded 30%/70% refund rates and frozen eligibility | Implemented; business policy approval/provider completion pending | Chapters 2.3/4.1/5; `calculate_price`, `begin_checkout`, `refund_eligibility`, `claim_refund` |
| R09 | Show an ERD that matches the deployed source schema | Inventoried 34 public tables and 35 foreign keys from actual migration execution; generated FK-based full/detail ERDs | Completed source-derived diagram; no invented chatbot tables | Chapter 5; `docs/source/schema-manifest.json`; `docs/figures/erd-*.png` |
| R10 | Distinguish support, notifications and chatbot | Documented implemented support threads, private in-app notifications, optional Resend code and Supabase Auth email; marked chatbot absent/planned | Support/notification code implemented; chatbot pending | Chapters 4.3–4.5; `Support.tsx`, `Layouts.tsx`, `send-transactional-email/`; evidence audit |
| R11 | Explain hosting and CI/CD without overstating automation | Recorded actual GitHub main/Vercel hosting and CLI function deployments; separated automatic frontend build from manual tests/migrations/secrets | Hosting verified; enforced CI test gate planned | Chapter 7; `vercel.json`, `package.json`, Git history; `QA_CHECKLIST.md` |
| R12 | Address privacy, security and Philippine legal/invoice requirements | Mapped actual controls and disclosures to RA 10173, RA 11967 and BIR considerations; identified privacy/retention/accounting-review gaps | Partial; no legal compliance certification or BIR-compliant invoice claim | Chapter 6; `Public.tsx`, `SECURITY_NOTES.md`; Appendix C statutory/vendor references |
| R13 | Use completed-system wording and evidence-based documentation | Replaced unsupported future architecture claims with present verified behavior; preserved future tense for explicitly planned items | Completed editorial action | All chapters; `docs/evidence-audit.md`, `docs/gaps-and-questions.md` |

## How to present this during a defense

Use the slide title **“Revision and Action Matrix — Reconstructed for Team Confirmation.”**
Introduce it as the team's evidence-based reconstruction of improvements, not a
verbatim transcript of the previous panel. For each row, show the issue, actual
change, verification limit and exact chapter/route/code location. Replace the
issue text with an actual panel comment only after the team confirms it. Do not
add fictitious attendance, signatures, dates, votes, approvals or completion percentages.
