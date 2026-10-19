# Customer account discounts

Managers manage a customer's percentage under **Manager > Customer Management > Edit account discount**. Enter a percentage and a reason, then save. Suggested values are 5%, 10%, 15% and 20%; the validated range is 0–100% in hundredths of a percent. Zero or **Remove discount** removes the account benefit. Assignment, change and removal are recorded in the existing audit trail. Super admins can use the same authorized manager route; ordinary customers cannot assign discounts or update protected profile columns.

## Quote and payment behavior

- New reservations automatically use the account rate. The existing `reservation_discounts` table stores the booking's applied discount; there is no parallel discount ledger.
- Draft saves and finalization calculate amounts on the server. Browser calculations are previews. Customer-supplied prices and discount fields do not control the authoritative amount.
- Account changes do not immediately alter all existing bookings. Before an eligible unpaid checkout, the server refreshes the account discount against the saved item subtotal and saved tax treatment. If the quote differs from the one displayed, the checkout endpoint returns `quote_updated` without creating a payment/provider session. The customer reviews the updated quotation and clicks the payment choice again.
- A second locked check prevents a concurrent account change between quote review and checkout reservation. An already pending checkout retains its agreed amount until reconciled. Any verified payment, refund or closed booking prevents account repricing. Later account changes do not discount or automatically refund paid amounts; balance payments use the original agreed total.
- Staff-selected promotions explicitly replace the account discount for that booking. They never combine automatically. Removing a promotion restores the current account rate on an eligible unpaid booking. To remove the account benefit, edit Customer Management.
- Existing tax configuration remains unchanged. Discounts reduce the eligible subtotal before inclusive VAT is extracted or exclusive VAT is added; non-VAT quotes show no VAT. Centavo rounding and upward rounding of the 50% down payment reuse the existing engine. Business/accounting confirmation of the configured tax status remains separate.
- Customer and staff quotations, downloadable booking/payment records and reports use saved financial snapshots, including original subtotal, discount percentage/amount, VAT breakdown, final total and deposit. These records are not certified BIR invoices.

## Schema and deployment

Migration `0029_customer_account_discounts.sql` adds protected assignment fields to `profiles` and a discount source to `reservation_discounts`. Existing promotions default to `promotion`; no existing reservation totals, payments or financial snapshots are updated by the migration. It extends the existing tax/discount functions, checkout safeguards and archive version. There are still 46 public application tables.

The fresh installer, incremental SQL Editor update and embedded archive installer were regenerated. The connected project receives only incremental 0029 and the matching `create-paymongo-checkout` and `export-application-data` functions. Do not rerun the fresh installer or an already installed update.

## Validation

All 132 tests across 11 files passed, including 83 database tests using the actual SQL installer. New cases cover staff authorization/audit, rejected customer forgery, automatic 5/10/15/20% quotes, inclusive/exclusive/non-VAT treatment, promotion precedence/removal, changed-quote review, pending-checkout locks, partial and balance payment verification, mismatched amount rejection, idempotency and completed paid-price preservation. Display/reporting tests check percentage, rounded amounts and the deposit. TypeScript, lint, the production build and all eight Edge Function type checks passed.

These are isolated payment-verification regressions. They do not assert an actual paid PayMongo transaction or refund. Hosted acceptance and record-preservation checks are recorded below after rollout.

Hosted schema 0029 and its matching checkout/archive functions are installed. An isolated temporary customer received an automatic 10% quote; a subsequent account-rate change caused the real checkout endpoint to return a persisted 20% quotation for review, with zero payment rows/provider sessions created. A customer attempt to assign their own rate was rejected, and manager changes appeared in the audit trail. A private six-table comparison confirmed all original booking/financial records unchanged, including saved financial snapshots, totals, payments and refunds.

Implementation commit `296fbcc` was pushed to GitHub main, and the matching `/assets/index-BfAd-sOm.js` Vercel bundle was verified on the custom domain. Authenticated production browser checks passed manager assignment/update/removal and the customer quotation's applied percentage; the customer detail layout fit a mobile viewport. The archive matched schema 0029 with 46 public tables. The temporary QA customer and unpaid draft were removed, retaining audit history. No provider payment session, charge, refund or customer email was created for this acceptance.
