# Manager discounts — single Customer Management interface

This update supersedes the Manager Promotions navigation described in the V2 completion report. Customer Management is the only Manager page for discount actions; its existing implementation and database rules are retained.

- `src/lib/permissions.ts`: removed the Manager Promotions/Discounts & Promos sidebar item.
- `src/app/router.tsx`: `/manager/discounts` now redirects to `/manager/customers` with history replacement, preserving old bookmarks without opening another discount page.
- `src/pages/PanelOperations.tsx`: Manager booking details link to Customer Management instead of mounting a second promotion form. The existing Super Admin oversight and promotion controls remain available to that role.

No migration is required. No discount assignments, historical promotions, reservations, payment records or audit entries are deleted by this change. Existing Assign/Edit/Remove dialogs, ongoing/one-time offers, optional Manila expiration, committed success notices, automatic server pricing, payment-based redemption and audit rules remain operational. Previously assigned promotion snapshots retain their existing precedence and amounts.

Validation: production build, ESLint and all **158 existing tests across 13 files** passed. Real browser acceptance against the hosted backend verified the legacy-route redirect, absent sidebar item, existing row dialogs, ongoing assignment and automatic quote, editing to a one-time offer with expiration, removal confirmation and regular repricing, audit entries, and replacement of the booking-level Manager form with a Customer Management link. Only an isolated temporary customer and unpaid draft were used; no checkout, charge or email was initiated.

Production release verification and the final preservation/cleanup check are recorded below after deployment.
