# Copy-ready prompt for another AI: RodelConnect PPT and revision presentation

Create a formal academic defense PowerPoint for **RodelConnect: A Digital Reservation
System for Catering Services with Integrated Chatbot**, subject **Web Commercialization
and E-Commerce (ELEC5)**, submission date **October 14, 2026**, for Rodel's Catering Services.
Authors in the confirmed alphabetical surname order: **Japle Ligaya; Wesley Manabat;
Julian Quiel Santos**. Preserve these exact names.

Use the supplied final technical-documentation DOCX/PDF, `docs/evidence-audit.md`,
`docs/gaps-and-questions.md`, `docs/revision-action-matrix.md` and actual diagram
PNGs as the authoritative source material. If the final documents are unavailable,
ask for them; do not invent missing implementation details. The earlier Chapters
1–2 Word file is background only. The required ELEC5 PDF is a section template;
its example rubric features are not evidence that this project implements them.

Deliver an editable PPTX, slide outline, speaker notes for every slide, and a
separate revision/action appendix. Aim for 15–18 concise main slides plus 3–4
appendix slides, using readable text and real diagrams rather than dense paragraphs.
Speaker notes should explain the reservation/payment process clearly for a student
presenter, including the limits of the current verification. Do not claim user
testing statistics, panel approval, consultations or survey results without source evidence.

Suggested slide order:

1. Exact title, authors, subject and date.
2. Business context, objectives and historical problem background.
3. Users and roles: customer, manager, super_admin; anonymous browsing is not a fourth database role.
4. Verified scope and explicit limitations.
5. Architecture diagram: React/TypeScript/Vite SPA on Vercel; Supabase Auth,
   PostgREST/RPC, PostgreSQL/RLS, Storage/Realtime and Deno Edge Functions.
6. Actual technology stack and implementation-based justification.
7. Reservation workflow: account → event/menu/setup → server quote → finalize → review/payment.
8. Scheduling/pricing controls: three-day lead time, 07:00–22:00, one active
   customer/date, three held slots, centavo arithmetic and exact package selections.
9. PayMongo sequence: authenticated checkout request → canonical amount → hosted
   test checkout → signed webhook → independent provider lookup → transactional SQL.
10. Cancellation/rescheduling/refund sequence, with business review and frozen eligible amount.
11. ERD overview and selected relationships from the actual 34 public tables.
12. Support, in-app notifications, Supabase Auth mail and optional Resend integration.
13. Actual security controls and Philippine legal/privacy/invoice review gaps.
14. GitHub/Vercel deployment, manual Supabase deployment and actual test evidence.
15. Reconstructed revision/action matrix, presented with the disclosure below.
16. Remaining work, including chatbot, completed provider payment/refund tests,
   actual email delivery, business catalog approval and operational/legal review.
17. Conclusion tied to verified objectives; no production-readiness certification.
18. Selected references; full source list in the technical documentation.

Mandatory accuracy rules:

- Retain the official title, but explicitly state that **chatbot integration is
  planned and is not present in the audited current React build**. No chatbot
  provider/model, widget, endpoint, FAQ table or conversation-log table is verified.
- Current roles are exactly `customer`, `manager`, `super_admin`. Do not invent
  delivery riders, vendors, separate guest accounts/roles or role tables.
- PayMongo test key/webhook configuration and hosted checkout creation were
  verified. Do not describe successful paid-webhook settlement, live payments or
  completed provider refunds as verified. A success redirect never confirms payment.
- Password recovery API and the live reset redirect were verified; actual inbox
  delivery and complete browser reset acceptance remain unverified.
- Resend transactional email code is optional; production secrets, scheduling
  and delivery were not confirmed. No SMS OTP/notification provider is implemented.
- Logistics/shipping API is not applicable to the current catering-event scope.
  PSGC location selectors assist event-address entry and do not provide courier tracking.
- Database schema, PK/FK and cardinalities must match the current migration-based ERDs.
- Tests are recorded as 35 automated local checks plus specifically identified
  hosted API observations, not 35 participants or a fabricated acceptance percentage.
- Frontend Git integration builds/deploys to Vercel. npm tests, SQL migrations,
  secrets and Edge Function deployment are not proven to be an automated CI pipeline.
- Do not claim a formal privacy portal, rights-request endpoint, HttpOnly session
  cookies, Sentry monitoring, completed backup drills, legal certification, DTI/BIR
  registration, sequential compliant invoices or tax automation without evidence.
- Never include passwords, secret/API key values, tokens, customer PII, test-account
  credentials, provider checkout URLs or transaction identifiers in the slides/notes.
- Use actual supplied screenshots only; do not fabricate an interface screenshot.

**Revision/proceedings disclosure:** No actual first-defense comment list or meeting
minutes was provided. Use the supplied matrix as an evidence-based reconstruction,
and label it **“Reconstructed Revision and Action Matrix — For Team Confirmation.”**
Do not invent panel quotations, panel names, attendance, a defense date, signatures,
decisions, approvals or claims that a panel requested a change. These are proposed
or reconstructed presentation materials, not official meeting proceedings.

For each matrix item use:

**Issue / requested revision (reconstructed) | Actual action taken | Status |
Where to find it (chapter + route/code/figure) | Team confirmation needed.**

Group rows as (a) implemented changes, (b) partially verified integrations, and
(c) remaining work. Use the actual R01–R13 rows from the supplied matrix, preserving
their verification limits. The team may replace reconstructed issue wording with
a recalled actual panel comment only after confirming it internally.

Add a short process-demo script that uses generic placeholders and the current
routes: registration/login; customer reservation wizard; manager review; PayMongo
test checkout; verification of payment state; cancellation/refund review; support;
super-admin catalog/users/maintenance/audits. Do not expose live records during
the demonstration. Mark any unverified demo stage as pending rather than fabricating it.
