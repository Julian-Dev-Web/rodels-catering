# Security and operations

## Trust boundaries

- React navigation/role guards are presentation controls. Authority comes from the current profiles row, explicit RLS, column grants and restricted RPCs. Registration metadata cannot set roles. Anonymous users read only active catalog/gallery and public policy settings, outside maintenance.
- All domain tables enable RLS. Financial/reservation state tables have read policies only for clients. Child reads follow reservation ownership; operational staff can inspect them. Service bookkeeping tables have no client policies. Profiles expose only full_name/phone/avatar_path update grants; role and identity columns cannot be changed with a normal update. Notifications grant only read_at updates to their recipient.
- SECURITY DEFINER functions use an empty search_path and qualified names. Default PUBLIC/anon/authenticated function execution is revoked, followed by an explicit allowlist. Internal functions live in a private schema without client usage. Customer/staff/super-admin checks are performed inside each user-facing mutation RPC. Provider mutation RPCs are executable only by service_role.
- Catalog/menu management is split: managers edit dishes/categories/drinks/desserts; super admins manage packages, setups, extras, furniture, gallery, users, settings and audit viewing. Super admins can enter the manager operations portal. Customers have no staff endpoints. Normal role assignment cannot grant or demote super_admin and cannot change the caller's role.
- Audit records are inserted in the same database transactions as business changes. Browsers cannot insert/update/delete them; service_role update/delete/truncate grants are revoked. Only a database owner can perform exceptional retention/recovery work. Actor IDs derive from auth.uid(), with null for provider/operator actions. No client actor names are accepted.

## Business invariants

One active customer/date booking is a partial unique index. Approved capacity is guarded by a before-write trigger using a date-scoped PostgreSQL transaction advisory lock. Approved cancellation requests keep their slot during review; approved cancellation releases it. Refund processing never consumes a new booking slot. Writes to a booking hold a row lock; checkout pending status prevents edits/cancellation/rescheduling. Price calculations read catalog prices in integer centavos, validate quantities and snapshot pricing at finalization. Only an unpaid, unapproved state is editable. Cancellation uses event date midnight interpreted in Asia/Manila and a strict 72-hour cutoff. Reschedule history is append-only to clients and enforces three successful changes per Manila calendar month. Three-day booking/reschedule lead time is enforced server-side.

Refund eligibility is one SQL function, using configured rates and actual paid amounts. Requests store that amount, approvals never accept a browser amount, and provider processing allocates it across original successful payments. Refund completion requires successful provider references for the entire eligible amount. Reservation/transaction history is retained after refunds.

## Payment authenticity and duplicate handling

Checkout authenticates with Supabase getUser(), verifies customer role, ownership and payable state, then obtains the amount from begin_checkout. Browser totals and redirect query parameters are ignored. The allowed return origin is server-configured. A conditional provider claim prevents concurrent session creation. Existing usable sessions are reused; an expired local retry deadline does not automatically declare a provider session dead.

The webhook validates the raw request body's HMAC-SHA256 and correct test/live signature, uses a five-minute timestamp tolerance, and compares signatures without early exit. It fetches the session with the secret provider key, verifies PHP currency, mode and paid amount, then calls confirm_provider_payment. Payment/session/event identifiers are unique. Payment, balance, transaction, reservation status, audit and notification updates commit together. If a paid date is already full, the money is recorded but approval waits for staff; the user is notified. There is no browser ability to insert a successful payment.

Refund operations are planned transactionally and claimed once per original payment. Retries with a recorded provider refund ID only fetch its state. A claim with no provider ID is ambiguous and blocked. This deliberately trades automatic retries for prevention of duplicate money movement when provider idempotency cannot be guaranteed across crashes.

### Reconcile an ambiguous provider operation

Use a restricted operator session, never a client-facing SQL form. Preserve logs and inspect the PayMongo dashboard/API by payment reference, reservation ID and refund operation notes.

1. For checkout, locate the provider session by the internal payment UUID/reference. If it exists, attach its exact ID/URL to that payments row and process its real provider state. If it does not exist, verify there is no charge/session before clearing provider_claimed_at for a safe retry. Do not blindly clear an ambiguous claim.
2. To abandon an unpaid checkout, explicitly expire it with the provider and verify it is unpayable/unpaid; only then set its local status to failed. Local expires_at alone is insufficient. A successful payment must go through the verified confirmation RPC, not a direct manual paid update.
3. For a refund operation, find the provider refund from the original payment and the operation UUID in notes. Attach the exact external_refund_id, amount and provider status to the planned refund_operations row. The staff Check provider status action can resume. Clear claimed only after verifying that no provider refund was created. Provider rejection/failure requires operational investigation; never create a second refund without confirming the first cannot succeed.
4. Record operator actions in audit_logs with provider references and the investigation result; avoid storing secrets or card/account details.

## Secrets and dependencies

Actual `.env` files, caches, browser profiles and generated output are ignored. Frontend variables contain only the public URL and anon/publishable key. Supabase supplies the service key to functions; PayMongo and email secrets are set through Supabase secrets. The legacy credentials were neither migrated nor printed into the new app. Rotate compromised legacy database, email, PayMongo and AI credentials with their providers before cutover. The optional chatbot is omitted, eliminating its browser-exposed key path.

Edge user endpoints use auth.getUser() even though gateway JWT validation is disabled in config, which supports publishable keys and permits the unauthenticated signature-verified webhook. Only the webhook bypasses user sessions. The email endpoint requires a separate strong worker secret and derives recipient/content from an existing notification; it cannot be used as an arbitrary browser email relay. Provider calls use timeouts. No raw card details are accepted or stored. Dependency lockfiles are tracked; npm audit was clean after updating the test runner. Recheck advisories during deployment.

## Storage and uploads

Avatar policies restrict writes/deletes to a path whose first folder equals auth.uid(); gallery writes require super_admin. Buckets constrain file sizes and JPEG/PNG/WebP MIME types; SVG/HTML are not allowed. Both buckets are public by design, so anyone with a published avatar/gallery URL can view it. Use only non-sensitive photos. React escapes text. CSV exports quote fields and neutralize leading spreadsheet formula characters. Modals trap keyboard focus. Images copied from legacy preserve original watermarks/credits; confirm publication rights for all photos before broad distribution.

## Maintenance and recovery

Maintenance hides the public catalog and blocks customer mutation RPCs/record reads while leaving the super-admin sign-in bypass available. Staff retain operational visibility. A verified payment webhook still records money already in flight during maintenance. Do not disable provider reconciliation when closing the frontend.

Use Supabase-managed scheduled backups and, where enabled on the project's plan, point-in-time recovery. Confirm retention, test restore to an isolated project and include Storage objects in your separate recovery plan; a database-only backup does not recover the actual image objects. Use operator-only `supabase db dump` / platform exports in encrypted storage, with access restricted and a documented retention period. Restore using Supabase platform/operator tools into a clean staging project, validate auth/profile links, payment uniqueness, totals, RLS and Storage before cutover. Keep the original database and this project's migration history intact until reconciliation is signed off. No raw SQL upload/restore endpoint is included.

## Verification limits and launch gate

PGlite exercises actual PostgreSQL tables, functions, triggers, grants and RLS with mocked auth.uid()/auth.users and Storage catalogs. pgcrypto installation, Auth mail/sessions, Storage HTTP behavior, Realtime delivery, a real concurrent capacity race, deployed function behavior and provider requests still require a real Supabase stack and test PayMongo account. Deno type checking is not provider integration validation. Do not describe this build as production-accepted until the unchecked live items in QA_CHECKLIST.md pass.
