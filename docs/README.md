# RodelConnect ELEC5 documentation handoff

October 20: [unified discount, inventory and booking completion report](UNIFIED_DISCOUNT_INVENTORY_BOOKING_2026-10-20.md) contains current files, database changes, deployment, acceptance and remaining configuration. Historical paper snapshots below are unchanged.

October 19: [customer account discounts](ACCOUNT_DISCOUNTS_2026-10-19.md) extend the current application. The paper remains its original submission snapshot.

Current application update, October 17: [manager daily reminders](MANAGER_REMINDERS_2026-10-17.md) and [email setup status](REMINDER_EMAIL_SETUP.md). The paper below remains an October 14 snapshot; its older chatbot/email status is superseded by subsequent implementation handoffs.

Submission date: October 14, 2026. Authors: Japle Ligaya; Wesley Manabat;
Julian Quiel Santos, in the confirmed surname order. Application source baseline:
`a5f38b2` on `main`.

The final paper contains 42 PDF pages: a title page, automatic contents, lists of
figures/tables, seven required chapters and Appendices A–D. It follows the supplied
ELEC5 template, with present-tense implementation evidence and explicit remaining
work. Earlier PHP/MySQL/background claims are separated from the current application.

## Files to use

- [Editable Word paper](final/RodelConnect_ELEC5_Technical_Documentation_2026-10-14.docx)
- [Final PDF](final/RodelConnect_ELEC5_Technical_Documentation_2026-10-14.pdf)
- [Copy-ready PPT and revision-presentation prompt](PPT_AND_PROCEEDINGS_PROMPT.md)
- [Reconstructed revision/action/location matrix](revision-action-matrix.md)
- [Source evidence audit](evidence-audit.md)
- [Remaining findings and questions](gaps-and-questions.md)
- [Rendered document QA record](rendered-qa.md)
- [Presentation source pack](final/RodelConnect_ELEC5_Presentation_Source_Pack_2026-10-14.zip)

`figures/` contains 300-dpi architecture/reservation/payment/ERD diagrams and actual
public-interface screenshots. The paper inserts 10 figures, including four detailed
ERD panels to supplement the dense complete overview. `source/` contains the
schema/dependency manifests and editable document/diagram source. No secrets,
customer records, account passwords or real transaction identifiers are included.

## Preparing the PPT

Give the other AI the PPT prompt, PDF, revision matrix, evidence audit and diagram
PNGs. The ZIP groups those materials with the editable paper and remaining findings.
Request editable slides plus speaker notes and a process-demo explanation. Keep
the matrix label **Reconstructed for Team Confirmation** until the team confirms
actual first-defense requests. It is not official minutes or a panel transcript.

Supported implementation includes structured accounts, the customer/manager/
super_admin workspaces, reservation rules and quotes, support and in-app notices,
RLS/RPC authorization, PayMongo server integration and GitHub/Vercel hosting.
Test checkout creation and selected hosted Auth/API checks were recorded.
Chatbot integration is absent/planned. Completed provider payment/refund tests,
real inbox delivery, optional Resend configuration, full authenticated UI acceptance,
business policy/catalog approval and operational/legal review remain open.

## Editing and regeneration

Edit `source/document-data.mjs`, `source/document-details.mjs` and
`source/document-appendices.mjs` for the paper. Edit the source matrix for revisions.
The tooling is isolated under ignored `docs/.tools/`, separate from application
dependencies. Required generator packages are `docx`, `@napi-rs/canvas`,
`pdfjs-dist` and `@viz-js/viz`; the document uses Windows Times New Roman fonts.

Run the schema/diagram/document generators as appropriate, then update indexes
and export through a document renderer. The included isolated LibreOffice macro
updates headings, contents, figure/table lists and saves matching DOCX/PDF files.
`scripts/export-libreoffice.mjs` uses only its own ignored converter profile. The
official converter file image was checksum-verified and extracted into `.tools`;
a normal system installation was not requested. Native Word updated fields but its
PDF exporter stalled on this machine, so LibreOffice supplied the final export.

After changing content, run `scripts/render-pdf.mjs` and
`scripts/inspect-artifacts.mjs`, then inspect every regenerated page. Opening the
DOCX in a different Word/printer environment can reflow pagination; update fields
and re-export before submitting a subsequently edited version.
