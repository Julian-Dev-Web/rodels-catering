# Database contract

All IDs are UUIDs except app_settings.key and webhook_events.id. Monetary fields are integer Philippine centavos; created/updated/action timestamps are timestamptz. Event date and time are separate Manila-local values. All migrations must be applied in order; no manual table setup is required.

Owner-confirmed catalog update: migrations 0014–0015 define four 3–6 dish menus at PHP 320/350/380/420 per guest for 100–1,000 guests. `menu_sets` adds `max_guests`, `pricing_version`, `inclusions` and `suggested_dishes`. Version 2 includes basic seating/setup and charges elegant-chair upgrades for every guest; version 1 preserves the original excess-chair calculation. `event_setups.description` records inclusions and `event_features.required_setup_id` restricts upgrades such as the wedding glass floor. History-read policies allow authenticated owners to resolve archived choices in their bookings. See [the pricing addendum](../docs/catalog-pricing-update.md).

For a fresh hosted project, run the generated `supabase/setup.sql` once in the Supabase SQL Editor. It wraps all migrations and sample catalog seed in one transaction with an empty-public-schema check. Regenerate it with `npm run db:bundle` after editing migrations. Existing databases need reviewed incremental changes, not another run of this initial setup.

Existing projects installed through migration 0012 apply `supabase/updates/0013_profile_names.sql` separately. Profiles then store `first_name`, optional `middle_name`, `last_name`, combined `full_name`, and normalized `phone`. Existing combined names remain unchanged until explicit structured names are supplied; no split is guessed. The Auth trigger ignores requested roles and always starts new users as customers. Name/contact changes remain owner-only and audited.

| Domain         | Tables and purpose                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity       | profiles: one-to-one auth.users, name/phone/avatar and database role                                                                                                                                                                                                                                                                                                                     |
| Catalog        | menu_sets: per-head price, required dish count, minimum guests; menu_categories/dishes; drinks/desserts; add_ons/event_features; event_setups; chair_types/table_types                                                                                                                                                                                                                   |
| Booking        | reservations: owner, event name/date/time, historical address names/codes/contact/notes, package, status, total/paid/refunded, pricing snapshot and finalized_at; reservation_items; reservation_event_setups; reservation_event_features; reservation_tables_chairs (one row per chair type, table quantities stored once); reservation_add_ons                                         |
| Scheduling     | reschedule_requests: requested date/reason/review status; reservation_reschedules: successful old/new date history and approval timestamp                                                                                                                                                                                                                                                |
| Money          | payments: checkout intent/amount/state, provider claim/session/payment references; balances: current payable remainder; transactions: immutable client-visible receipts/refunds; cancellations: reason/previous status/review; refunds: frozen eligible amount/review/processing status; refund_operations: protected allocation per original payment; webhook_events: deduplication IDs |
| Service        | feedback: one rating/message per completed reservation; support_tickets/support_messages: owner, status and threaded authors; notifications: recipient/content/link/read_at; email_deliveries: provider dispatch deduplication                                                                                                                                                           |
| Administration | gallery_images: caption/public URL/active; app_settings: maintenance and refund rates; audit_logs: actor/action/entity/details                                                                                                                                                                                                                                                           |

Indexes cover customer/date uniqueness, reservation date/status, customer/creation time, status/creation time, payment reservation/time, pending checkout uniqueness, pending request uniqueness, monthly reschedule history, notifications, support status/thread, and audits.

## Access map

| Resource                   | Public                          | Customer                           | Manager                                       | Super admin                             |
| -------------------------- | ------------------------------- | ---------------------------------- | --------------------------------------------- | --------------------------------------- |
| Active catalog/gallery     | Read outside maintenance        | Read                               | Read all; menu items CRUD                     | Full catalog/gallery CRUD               |
| Profile                    | None                            | Own read; name/phone/avatar update | Operational read; own editable fields         | Read; protected role assignment         |
| Reservations/children      | Aggregate dates only            | Own read; state-limited RPC writes | Operational read and reviewed RPC transitions | Manager permissions                     |
| Financial records          | None                            | Own read and request RPCs          | Read/review/provider processing               | Manager permissions                     |
| Feedback/support           | None                            | Own read/create/reply              | Operational read/reply/resolve                | Manager permissions                     |
| Notifications              | None                            | Own read/read_at update            | Own read/read_at update                       | Own read/read_at update                 |
| Settings                   | Public maintenance/refund rates | Same                               | Same                                          | Protected writes                        |
| Audit                      | None                            | None                               | None                                          | Read                                    |
| Provider/email bookkeeping | None                            | None                               | None                                          | None through browser; service role only |

## Reservation transitions

| Action                      | Required state                                                            | Result / authority                                                                          |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Save draft/change           | draft/pending/for_approval; paid=0; no checkout                           | draft, authoritative quote; owner RPC                                                       |
| Finalize                    | complete unpaid draft; no checkout                                        | for_approval; owner RPC validates selection/lead time                                       |
| Approve                     | pending/for_approval + finalized future event; no checkout                | approved if capacity; staff RPC                                                             |
| Verified payment            | payable finalized reservation, exact pending checkout amount              | partial/full payment state; auto-approve if capacity, otherwise retain review state         |
| Reject                      | pending/for_approval, unpaid, no checkout                                 | rejected; staff RPC                                                                         |
| Request cancellation        | draft/pending/for_approval/approved; strict >72 hours, no checkout        | pending_cancellation; owner RPC preserves prior state and approved slot                     |
| Approve/reject cancellation | pending cancellation request                                              | cancelled and release balance/capacity, or restore prior status; staff RPC                  |
| Request refund              | approved cancellation + eligible paid amount                              | pending_refund with frozen eligible amount; owner RPC                                       |
| Review refund               | pending refund                                                            | refund_approved or cancelled/rejected request; staff RPC                                    |
| Finish refund               | approved request with complete successful provider allocations            | refunded/partially_refunded payment state; service-only RPC                                 |
| Complete event              | approved, fully paid, event date today/past, no checkout                  | completed; staff RPC                                                                        |
| Reschedule                  | approved future event, new date ≥3 days ahead, no checkout, <3 this month | request then atomic date change after staff approval; capacity/duplicate checks on new date |

Customers cannot send arbitrary statuses. Cancellation/refund/reschedule decisions are irreversible via the same request after review. New support conversations can be started after resolution. A rejected refund remains a historical record and requires support/operator investigation rather than unlimited repeated requests.

## User RPCs

- `save_reservation(data jsonb) → uuid`: accepts occasion, address, menu IDs, dish_ids/feature_ids arrays, chairs `{id,quantity}[]`, table type/quantity, and add_ons `{id,quantity}[]`. Ignores browser totals/statuses/owner. Existing ID must be an editable owned reservation.
- `finalize_reservation(rid) → jsonb`: validates and stores the current canonical price breakdown.
- `available_dates(start_date,end_date)`: at most 366 days, returns remaining confirmed slots without identities.
- `request_cancellation`, `request_refund`, `request_reschedule`: ownership/state/time-checked requests.
- `review_cancellation`, `review_refund`, `review_reschedule`, `manager_reservation_status`: staff-only state machine.
- `refund_eligibility(total,paid)`: one policy calculation; 30% of an exact 50% down payment or 70% of fully paid amount by initial settings. Rejects unknown partial amounts.
- `create_ticket`, `reply_ticket`, `resolve_ticket`, `submit_feedback`: validated service operations and audits.
- `admin_set_role`, `update_setting`: super-admin controls.
- `dashboard_metrics`: staff-only monthly comparisons, receipts/bookings/customers, top packages, weekly/monthly counts and setup counts.

`reservation_summary` is a security-invoker join view; all underlying table RLS applies. Never replace it with a default definer view.

## Service-only RPCs

`begin_checkout`, `confirm_provider_payment`, `claim_refund`, `claim_refund_operation`, `finish_refund`, `pending_notification_emails` have no browser execute grant. Only trusted functions/workers with platform secrets call them. Their service caller is responsible for verified provider state or authenticated user identity. Important state and money operations execute in one database transaction; network calls occur outside that transaction behind a persisted claim, with explicit reconciliation on ambiguous failure.
