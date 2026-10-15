# RodelConnect gaps and questions

Current panel revisions: [implementation, verification and business setup status](PANEL_REVISIONS_2026-10-15.md). Hosted schema 0026 includes shared equipment, persistent incomplete drafts, allergy acknowledgments, tax/discount snapshots and scheduled upcoming reminders. Actual chair stock and tax registration still need business confirmation. Reminder email needs a verified sender; see [email setup](REMINDER_EMAIL_SETUP.md). Earlier implementation counts and unresolved-item lists below are historical where superseded by this handoff.

Current 0019 evidence: [consolidated handoff](CONSOLIDATED_UPDATES_2026-10-15.md). Owner weekday hours and selected-chair rate/quantity are resolved: Monday–Saturday 7 AM–10 PM, Sunday 8 AM–9 PM; ₱10 per chosen Elegant guest chair with included Monoblock remainder. No holiday list or duration rule was supplied. Partial Wedding component prices remain pending. The application archive now covers 38 public tables plus reference sequence state. Fresh normal staff login/reload and protected archive download passed; the cause of any older stale-session error remains unverified. Original rows below are historical.

The original table below is the October 14 documentation baseline. Current implementation supersedes its absent-chatbot, illustrative-catalog, geographic fallback, privacy-consent and administration findings. See [the October 15 feature handoff](FEATURE_UPDATES_2026-10-15.md). The current chatbot uses Groq, menus use the supplied owner-confirmed rates, and 0017/0018 implement access controls, consent and current refund policy. The original DOCX/PDF have not been silently rewritten.

Current unresolved items: six owner-approved Wedding component prices totaling ₱30,000; legal review of Terms/Privacy, privacy contact and retention schedule; actual paid PayMongo webhook/refund acceptance; email inbox delivery/worker configuration; separate Auth/Storage backup and a staging recovery drill; credential rotation; an enforced CI test gate. No production restore or live paid transaction is claimed.

The required PDF and earlier Word file were located in Downloads and inspected.
The paper will follow the supplied section structure and retain the exact project
title, author spellings, subject and October 14, 2026 submission date.

| Finding | Evidence / implication | Resolution needed |
| --- | --- | --- |
| Chatbot absent from current implementation | No widget, server endpoint, provider/model or chatbot/FAQ/log schema exists | Label planned; select provider and implement/test before claiming an integrated chatbot |
| Successful provider payment not yet verified | Hosted test checkout creation and unsigned-event rejection succeeded; no paid webhook result was verified | Complete test checkout, inspect signed delivery, and reconcile reservation/payment/balance/transaction records |
| Refund provider completion unverified | SQL/Edge allocation and finalization logic exists and local tests pass | Complete test-mode provider refund and failure/retry cases |
| Reset inbox delivery unverified | Backend recovery/password replacement and hosted redirect verified | Test actual inbox; configure Auth SMTP for permitted recipients and production delivery |
| Resend notifications optional/unverified | Email function exists/deployed, but credentials, worker schedule and receipt of mail not confirmed | Configure only if needed; retain partial status |
| Business catalog/policies illustrative | 0012 seed labels catalog illustrative; rates are configurable settings | Business owner reviews real packages, prices, availability, refund/cancellation policies and contacts |
| Earlier manual-process claims not measured | Earlier chapters describe fragmented/manual booking; no survey, timing, error-rate or adoption dataset supplied | Present as historical motivation, not quantified findings |
| Author identification | Exact names and surnames Ligaya, Manabat and Santos confirmed by the user | Resolved; preserve supplied alphabetical order |
| Meaning of “proccessiding” | User requests a prompt for another AI and revision/action/location slides; no actual first-defense comment list exists | Prepare a reconstructed matrix for team confirmation and PPT prompt; never attribute invented comments to the panel |
| Public and authenticated screenshots | Real deployed /register and /login pages captured with blank fields and inserted; role dashboards may show live records | Public/auth-entry evidence completed; authenticated dashboard acceptance/screenshots remain pending |
| CI/CD test gate not enforced | main is the observed branch; no GitHub Actions workflow; Vercel build does not run npm test | Recommend a future gate; do not describe it as already automated |
| Logs/backup/restore practices unverified | Platform capabilities and recovery notes are available | Verify plan-specific backups, log retention, alerts and a restoration exercise |
| Data privacy/legal compliance not certified | No formal privacy notice, retention schedule, rights-request workflow, DPO registration evidence or legal review supplied | Philippine legal/privacy review; document implemented controls separately |
| BIR compliant invoice not established | Transactions/CSV/provider email receipt are records; no registered invoice issuance/tax engine found | Accounting review; avoid claiming BIR-compliant documents |
| Credential rotation not verified | Secrets were exposed during setup; no rotation evidence recorded | Rotate/revoke through vendor-supported processes and update private/server configuration; never put secret values in documentation |
| Dependencies and schema inventory | Exact lock versions and isolated migration catalogs generated; 34 public tables, 35 FKs and 29 public RPCs documented | Resolved for the inspected source baseline; update manifests/diagrams after future migrations |

No completion percentages, real customer data, passwords, API key values,
transaction identifiers, invented meeting dates or defense recommendations will
be inserted to fill these gaps. Items may remain explicitly open in the final paper.

October 15 menu-photo update: all 90 owner-defined dish/drink/dessert names now have representative photo mappings. Actual Rodel’s serving photos remain an owner action; several uncommon variants use explicitly identified related-food references. Replace them through Super Admin → Menu photos when permitted business photography is available. Newly created or renamed items without a matching registry name require a custom photo. Individual photo licenses/attribution remain attached in the registry, public credits route and asset attribution file. Existing provider, legal and restore gaps remain open. The earlier final DOCX/PDF is an evidence snapshot and does not automatically incorporate these later interface changes.

Resolved October 15: the user explicitly confirmed all six Wedding inclusion rates at PHP5,000 each, and the five matching Simple Buffet setup extras at PHP5,000 each (excluding Elegant Chair). Hosted incremental migration 0022 configures and enforces them. The earlier Wedding component-price gap above and in historical handoffs is superseded by `SETUP_EXTRAS_2026-10-15.md`. Normal reservation review remains in force; no per-booking component-price approval is needed. Actual serving-photo, paid-provider acceptance, legal and complete restore gaps remain open.
