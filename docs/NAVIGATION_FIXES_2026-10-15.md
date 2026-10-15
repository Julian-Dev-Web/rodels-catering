# Calendar navigation and booking form retention — October 15, 2026

The Manager event-calendar heading is now a button. Click the displayed month/year, choose a month and enter a year, then use **Go to month**. Cancel preserves the current view; Previous/Next still work after jumping. The chooser is keyboard-accessible and fits a mobile viewport.

The booking form now retains unfinished values when opening Terms/Privacy, returning with browser Back, or reloading the same tab. This includes event details, selected package, address hierarchy, contact number, notes and consent. Supabase emits authentication events when a tab regains focus; the previous handler removed private queries on every event, allowing the auth guard to unmount the form. Query clearing now happens on actual identity changes/sign-out rather than a same-user refresh. Role, suspension and maintenance checks remain active.

Unfinished values are kept in browser session storage, separated by account and reservation. No reservation is created by this temporary storage. Saving a new booking transfers its draft to the saved reservation; finalization and sign-out clear drafts. Existing-booking drafts are restored only when the server's saved revision still matches, so a changed record is not overwritten by an older local draft. A new policy version requires fresh acceptance while preserving the other fields. If browser storage is disabled, the form stays usable but reload recovery cannot be guaranteed. The Privacy Notice describes this temporary browser storage.

Verification: 93 automated tests; lint, TypeScript and production build; real-browser month/year jump, Previous/Next and Cancel, mobile dialog/layout, same-user token refresh without form remount, actual Terms/Privacy new tabs, same-tab policy navigation/browser Back, reload retention and sign-out clearing. Browser tests use existing designated test accounts and unsaved fixture input; no hosted booking, payment, account status or maintenance setting is modified.

Implementation commit `3b0ed21` was pushed to GitHub main. Vercel's tested entry bundle `/assets/index-BNF6MV9P.js` was verified live. Production browser checks passed calendar jump/arrows/Cancel, mobile chooser, both policy links/new tabs/browser Back, and full unsaved-form restoration after reload. Temporary QA browser drafts were cleared. No user SQL or environment action is needed.

No SQL migration, Edge deployment or new environment variable is required. The previous 0019 handoff remains at [CONSOLIDATED_UPDATES_2026-10-15.md](CONSOLIDATED_UPDATES_2026-10-15.md).
