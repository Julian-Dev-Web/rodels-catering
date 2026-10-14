export const appendices = [
 {title:'APPENDIX A — USER MANUAL / GUIDE', sections:[
  ['A.1 Access, registration and recovery',[
   'Open https://rodels-catering.vercel.app in a current browser. Public visitors can browse Home, Packages, Gallery, About and Policies. A visitor does not need a guest account merely to browse. Use Register to create a customer account; privileged staff access is assigned through an authorized operator/super-admin workflow, never selected in the registration form.',
   'Enter first name, optional middle name, last name, Philippine mobile contact, email, password and matching confirmation. The form normalizes mobile contact and validates required fields. Follow any email-confirmation instructions returned by Supabase, then sign in using email and password. Registration supplies a customer profile; a phone field does not imply SMS verification.',
   'For recovery, select Forgot password on the login page, enter the account email and submit. Open the newest valid recovery email link; the app routes recovery sessions to /reset-password. Enter and confirm the replacement password. If the link is expired or invalid, request a new one. The implementation and recovery API/redirect have been verified, but the intended mailbox delivery and complete browser journey still need acceptance testing. [1], [8], [25]',
   'Figures A.1 and A.2 are actual unauthenticated production-host screenshots captured for this document. Form fields are blank. No invented dashboard, customer identity, transaction or payment-success screenshot is included.',
  ],{figure:'ui-register.png',caption:'Figure A.1. Actual registration interface on the deployed site.',explain:'Captured from /register on October 14, 2026. First name, optional middle name, last name, mobile contact and password confirmation are visible.'},
    {figure:'ui-login.png',caption:'Figure A.2. Actual login interface on the deployed site.',explain:'Captured from /login on October 14, 2026. The recovery link leads to the implemented password-reset request page.'}],
  ['A.2 Customer reservation and service tasks',[
   '1. After customer sign-in, use Available Dates and Packages to choose an eligible date and package. Available date capacity describes approved/completed bookings; saving a draft does not hold a slot. Dates must be at least three Manila calendar days ahead, and the package minimum guest count applies.',
   '2. Open Reservations → New reservation. Enter event name, date, permitted time, guest count, mobile contact and the full venue address. Select province/city/barangay through the geographic lookup where available, or use the manual fallback. Select the package, its exact dish count, a drink and dessert; then select the event setup, optional extras, tables and enough chairs.',
   '3. Save to obtain a server-calculated draft quote. Review all selections and finalize only when the event details are complete. Finalization creates a for_approval record and balance. An unpaid eligible draft may be edited; paid/approved records and bookings with unreconciled checkout attempts cannot be freely rewritten.',
   '4. Open the reservation detail and select the offered down-payment, full-payment or balance intent. Follow the external PayMongo checkout URL. Card/GCash availability is subject to the provider account and mode. After returning, inspect the recorded status; a return page alone does not confirm payment. A signed, server-verified provider event is required. Use test mode for acceptance; real settlement/refund has not been certified here.',
   '5. Request cancellation with a reason while the booking is eligible and more than 72 hours before the Manila-local beginning of the event date. Staff reviews the request. An approved cancellation may support a refund request according to the frozen policy calculation; staff approval is separate from provider completion. Do not assume every payment is fully refundable.',
   '6. For an approved future booking, request a new date at least three days ahead with a reason. Staff reviews capacity and the limit of three successful reschedules per booking per Manila calendar month. After a fully paid event is marked completed, submit feedback. Use Support to create a ticket or reply until it is closed; use Settings for profile/avatar/password changes. [1]',
  ]],
  ['A.3 Manager operations',[
   'Sign in with an authorized manager identity and use /manager/dashboard. Review /manager/reservations and the detail/action controls before approval or rejection. Valid approvals must concern finalized future bookings with capacity; rejection is restricted to eligible unpaid records. Mark completed only when an approved event is due/past and the total is paid. Server errors explain ineligible transitions rather than allowing arbitrary status edits.',
   'Use /manager/menu for categories, dishes, drinks and desserts; the manager does not obtain the super-admin price/catalog scope. Review cancellations, reschedules and refunds in their corresponding manager pages. Refund approval only authorizes processing; the process-refund function and provider success determine completion. If a provider claim is ambiguous, escalate for reconciliation rather than repeatedly initiating a money movement.',
   'Use Payments, Feedback and Support for permitted operational records. Reply to a support ticket or resolve it when appropriate. Reports and dashboard metrics summarize recorded data; no fabricated sales history is part of the seed. Authenticated staff screenshots and end-to-end role acceptance are pending, so this guide is based on the current routes and source behavior. [1]',
  ]],
  ['A.4 Super-admin operations',[
   'Sign in with an operator-established super_admin identity and use /super-admin/dashboard. Manage packages, priced extras/seating, gallery records and uploads, users, maintenance and audit logs through the dedicated routes. The super-admin can enter manager routes for operational reviews. Changes to catalog prices must be reviewed against the business offering; stored finalized/pricing and payment rules remain server controlled.',
   'In Users, assign only the allowed customer/manager roles to eligible other users. The role function rejects self-assignment, assignment of super_admin and modification of an existing super-admin. Use the operator-managed workflow for first/admin identity changes. Maintenance affects public/customer access; review its consequences before enabling it. Audit records can be read but are not a normal editable log. [1]',
  ]],
  ['A.5 Operator setup and acceptance checklist',[
   'For a new project, install the locked dependencies, configure the public frontend project URL/key and run the complete generated setup bundle only against an empty public schema. For an existing installation, review/apply incremental SQL instead. Never expose a service-role or provider secret through a VITE_ variable. Configure Auth site/redirect URLs to the correct frontend origin and recovery path.',
   'Deploy the five Edge Functions and server environment separately. Configure PayMongo test credentials and the enabled checkout_session.payment.paid webhook using the deployed paymongo-webhook endpoint. Verify provider mode, APP_URL, caller verification and signature handling. Optional transactional email also needs Resend/from-address/worker credentials and a scheduled caller; code deployment alone does not establish delivery.',
   'Run local lint/type/build/tests, then verify real inbox recovery, role browser isolation, customer finalization, test payment webhook completion/replay, provider refund completion, image upload access, notification delivery and concurrent date approvals. Review catalog/refund terms, privacy notices, credential rotation, invoice needs and backup restoration before broad customer operation. This is remaining operator work, not a list claimed completed. [1]',
  ]],
 ]},
 {title:'APPENDIX B — API DOCUMENTATION', sections:[
  ['B.1 API conventions and boundaries',[
   'The browser uses Supabase SDK methods for Auth, policy-controlled Data API operations, Storage and Realtime. Edge handlers reside at https://<project-ref>.supabase.co/functions/v1/<function-name>; SQL RPCs use /rest/v1/rpc/<function-name>. Angle-bracket segments are placeholders. The API key identifies the project/client; authenticated requests additionally carry the user access token. No actual key, token, password or record identifier is printed here.',
   'The browser-invoked JSON Edge functions accept POST and handle OPTIONS preflight. They require matching configured Origin for browser requests and verify the caller where applicable; the webhook is provider-facing and accepts POST only. Internal email requests use the dedicated worker credential rather than an arbitrary logged-in customer. Errors must be handled as failures; neither HTTP redirect nor client-supplied totals authorizes financial state.',
  ],{table:'edge',caption:'Table B.1. Implemented Edge Function contracts and authentication.'}],
  ['B.2 SQL RPC endpoints',[
   'Table B.2 lists the callable public functions discovered from the executed migration catalog. A granted authenticated role alone is not sufficient for most transitions: routines additionally enforce customer/staff/super-admin requirements, ownership, dates, status and maintenance. Service-only functions must be invoked by the authorized server workflow. Functions in the private schema are implementation helpers/triggers and are not browser endpoints.',
  ],{table:'rpc',caption:'Table B.2. Public SQL RPC signatures, authorization and purpose.'}],
  ['B.3 Auth, Data API, Storage and Realtime usage',[
   'Auth calls include signUp, signInWithPassword, resetPasswordForEmail with the configured recovery redirect, updateUser for password replacement, getUser for server verification and signOut. The SDK manages these calls; the app does not implement a separate custom password database. The profile bootstrap trigger links auth.users to profiles. Admin identity operations belong to the operator workflow, not public signup.',
   'Data API reads target real tables and the security-invoker reservation_summary view under the caller’s grants/RLS. Catalog/profile/mark-read writes are permitted only as documented in Table 5.1; financial and workflow state writes use RPC/server functions. available_dates exposes capacity rather than customer names. dashboard_metrics requires staff access.',
   'Storage operations use the avatars and gallery buckets. Avatar writes require the caller’s folder and customer-access policy; gallery management requires super_admin. Allowed types are JPEG/PNG/WebP, with 2 MB avatar and 10 MB gallery limits. Objects in both buckets have public image access; private documents do not belong there. Notifications are the published Realtime table, with polling fallback in the portal; support thread refresh is polling, not a fabricated chatbot channel. [1], [10], [11]',
  ]],
 ]},
 {title:'APPENDIX C — REFERENCES',sections:[
  ['',[
   'References use numbered citations in the text. Vendor/statutory sources were consulted for technical/legal descriptions; the repository remains the primary implementation evidence. Online sources were accessed on October 14, 2026. Dates marked n.d. reflect documentation pages without a definite publication date. The two local course/background files were supplied by the project team.',
  ],{references:true}],
 ]},
 {title:'APPENDIX D — PROPOSED REVISION AND ACTION MATRIX FOR PPT',sections:[
  ['D.1 Status and use of the reconstruction',[
   'This matrix reconstructs source-supported improvements; no original first-defense comments, official minutes, panel names or meeting date were supplied. It is not a verbatim panel record. The team must confirm recalled requests before attributing any row to the panel. Completed means the stated code/documentation action exists, not production acceptance. Partial identifies unresolved tests or operational requirements. The separate PPT prompt preserves these limits without inventing proceedings. [1]',
  ],{table:'revision',caption:'Table D.1. Reconstructed revisions, actions, status and evidence locations.'}],
 ]},
]

export const stackRows = [
 ['Presentation','React / React DOM 19.3.0; TypeScript 5.9.3','Component-based interfaces and typed models/forms; verified in lockfile and TS source. [1], [4], [5]'],
 ['Build and browser routing','Vite 7.3.7; React Router 7.18.4','Builds the static SPA and defines public/role routes. Vercel rewrites nested requests to the entry page. [1], [6]'],
 ['Queries and forms','TanStack Query 5.104.2; React Hook Form 7.90.0; Zod 4.6.7','Cached server reads and controlled/validated input; server SQL remains authoritative. [1]'],
 ['Database and Data API','Supabase managed PostgreSQL; SDK 2.117.3','Relational constraints, JSONB, protected RPCs and RLS for owned/staff records. Hosted engine version not queried. [1], [7], [9]'],
 ['Identity','Supabase Auth','Email/password sessions, recovery and server getUser verification; profile-linked app roles. Actual inbox delivery remains pending. [1], [8]'],
 ['Image storage / notices','Supabase Storage and Realtime','Bucket/owner-folder policies for images; notification publication and polling fallback. [1], [10], [11]'],
 ['Server-side integration','Supabase Deno Edge Functions','Five deployed handlers isolate provider/worker secrets and verify callers or signatures. [1], [12]'],
 ['Payments','PayMongo Hosted Checkout / REST / signed webhook','GCash/card requested by checkout code; server-derived amount and independently verified provider state. Test checkout verified; settlement/refund acceptance pending. [1], [14], [15]'],
 ['Email','Supabase Auth email; optional Resend REST worker','Auth handles account mail; Resend code derives notices from stored data. Resend configuration/scheduling/delivery unverified. No SMS provider. [1], [13], [16]'],
 ['Address lookup','PSGC public API','Province/city/barangay selection with manual fallback; not delivery tracking or a courier integration. [1], [19]'],
 ['Charts / exports','Recharts 3.10.1; application CSV formatting','Visualizes staff metrics and exports existing records, with formula-leading CSV characters neutralized. [1]'],
 ['Source and frontend hosting','GitHub; Vercel','Observed main repository and Git-connected static frontend hosting. No GitHub Actions test workflow found. [1], [17]'],
 ['Verification','Vitest 5.0.4; PGlite 0.3.16','35 local checks include input rules and actual SQL logic with platform scaffolding; not a production-load or user-acceptance study. [1]'],
 ['Chatbot','No provider/model/library verified','Earlier background/title anticipates it; no current widget, endpoint, conversation tables or model connection. Planned only. [1], [3]'],
]

export const legalRows = [
 ['Personal-data protection','Owned-record RLS, restricted roles, validation and server secrets','Privacy notice, lawful bases/rights handling, retention/deletion and provider accountability need review. RA 10173; no certification. [1], [20]'],
 ['Online service / consumer terms','Catalog, policies, quotes and cancellation/refund request flows','Business disclosures, registrations, lawful policy terms and redress must be reviewed for RA 11967 applicability. [1], [21]'],
 ['Tax and documents','Payment/refund ledger and report exports; provider receipt request','No verified BIR invoice module/registration/tax engine. Accounting review of required invoicing is pending. [1], [22]'],
 ['Operational assurance','Deployed platform controls and source-level audit/verification','Credential rotation, real inbox/payment/refund acceptance, backup restoration and monitoring configuration remain unverified. [1], [23]'],
]

export const edgeRows = [
 ['create-paymongo-checkout','POST; verified user JWT + customer role','reservation_id: UUID; intent: partial | full | balance','Returns checkout url and local payment_id. Canonical SQL amount; provider claim/session saved server-side.'],
 ['paymongo-webhook','POST; Paymongo-Signature HMAC, timestamp and provider mode','Provider event JSON; checkout_session.payment.paid','Fetches provider session, confirms matching paid PHP record via service-only RPC. 200 processed/ignored; 401 invalid signature; retryable failures remain errors.'],
 ['process-refund','POST; verified user JWT + manager/super_admin','refund_id: UUID','Returns completed or pending status (with reconciliation message). Allocations are managed internally; completion requires full eligible provider success.'],
 ['admin-set-role','POST; verified user JWT; super_admin enforced by SQL','target_id: UUID; target_role: customer | manager','Returns success. No self/super-admin assignment or change of existing super-admin.'],
 ['send-transactional-email','POST; internal worker bearer credential','notification_id: UUID','Derives authorized recipient/body from stored notice; Resend idempotency and email_deliveries deduplication. Delivery configuration not verified.'],
]

export const rpcDescriptions = {
 current_app_role:['anon/authenticated','Current profile role or null'],
 is_staff:['anon/authenticated','Whether current role is manager/super_admin'],
 maintenance_enabled:['anon/authenticated','Read maintenance state'],
 customer_access:['anon/authenticated','Evaluate signed-in access and maintenance'],
 can_read_reservation:['anon/authenticated','Evaluate parent read permission'],
 available_dates:['anon/authenticated','Bounded date-range capacity, subject to maintenance'],
 refund_eligibility:['anon/authenticated','Calculate eligible configured refund; no financial state write'],
 save_reservation:['authenticated; customer','Save owned eligible draft and authoritative price'],
 finalize_reservation:['authenticated; customer','Validate owned draft, freeze quote and submit'],
 request_cancellation:['authenticated; customer','Create eligible owned cancellation request'],
 review_cancellation:['authenticated; staff','Approve/reject pending cancellation and update booking'],
 request_refund:['authenticated; customer','Create owned approved-cancellation refund request'],
 review_refund:['authenticated; staff','Approve/reject pending frozen refund amount'],
 request_reschedule:['authenticated; customer','Request eligible approved-owned booking date change'],
 review_reschedule:['authenticated; staff','Review request, enforce capacity and record change'],
 manager_reservation_status:['authenticated; staff','Apply restricted approval/rejection/completion transitions'],
 admin_set_role:['authenticated; super_admin','Assign allowed customer/manager role under protections'],
 update_setting:['authenticated; super_admin','Validate maintenance boolean or refund rate'],
 submit_feedback:['authenticated; customer','Submit rating/message for owned completed booking'],
 create_ticket:['authenticated; customer','Create support ticket and first message'],
 reply_ticket:['authenticated; owner/staff','Append reply to permitted open support thread'],
 resolve_ticket:['authenticated; staff','Close support ticket'],
 dashboard_metrics:['authenticated; staff','Return aggregate recorded dashboard metrics'],
 begin_checkout:['service_role only','Reserve canonical payment intent after server user verification'],
 confirm_provider_payment:['service_role only','Deduplicate and record independently verified provider payment'],
 claim_refund:['service_role only','Allocate approved eligible amount across original payments'],
 claim_refund_operation:['service_role only','Claim provider allocation once; reject ambiguous retry'],
 finish_refund:['service_role only','Complete local refund only after full eligible provider success'],
 pending_notification_emails:['service_role only','List notices without a recorded email delivery'],
}
