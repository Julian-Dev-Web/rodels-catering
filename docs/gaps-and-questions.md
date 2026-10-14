# RodelConnect gaps and questions

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
