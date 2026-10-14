export const title = 'RodelConnect: A Digital Reservation System for Catering Services with Integrated Chatbot'
export const authors = ['Japle Ligaya','Wesley Manabat','Julian Quiel Santos']
export const references = [
 ['Project team','RodelConnect current repository, 13 migrations, source pages, deployment configuration and recorded QA, baseline a5f38b2','2026','https://github.com/Julian-Dev-Web/rodels-catering'],
 ['Course template supplied by the user','elec5 technical documentation (1).pdf, 12 pages','n.d.','Local supplied source; inspected from Downloads'],
 ['Project team','Rodel_Catering_Chapters_1_2.docx, earlier project background','n.d.','Local supplied source; inspected from Downloads'],
 ['React','Quick Start','n.d.','https://react.dev/learn'],
 ['Microsoft','The TypeScript Handbook','n.d.','https://www.typescriptlang.org/docs/handbook/intro.html'],
 ['Vite','Getting Started','n.d.','https://vite.dev/guide/'],
 ['Supabase','Database overview','n.d.','https://supabase.com/docs/guides/database/overview'],
 ['Supabase','Password-based Auth','n.d.','https://supabase.com/docs/guides/auth/passwords'],
 ['Supabase','Row Level Security','n.d.','https://supabase.com/docs/guides/database/postgres/row-level-security'],
 ['Supabase','Storage','n.d.','https://supabase.com/docs/guides/storage'],
 ['Supabase','Postgres Changes','n.d.','https://supabase.com/docs/guides/realtime/postgres-changes'],
 ['Supabase','Edge Functions','n.d.','https://supabase.com/docs/guides/functions'],
 ['Supabase','Send emails with custom SMTP','n.d.','https://supabase.com/docs/guides/auth/auth-smtp'],
 ['PayMongo','Hosted Checkout','n.d.','https://docs.paymongo.com/docs/payment-channels-hosted-checkout'],
 ['PayMongo','Setup & Management: webhooks','n.d.','https://docs.paymongo.com/docs/developer-tools-webhook-setup-management'],
 ['Resend','Send Email API reference','n.d.','https://resend.com/docs/api-reference/emails/send-email'],
 ['Vercel','Deploying Git Repositories with Vercel','n.d.','https://vercel.com/docs/git'],
 ['PostgreSQL Global Development Group','PostgreSQL 18 documentation: constraints','n.d.','https://www.postgresql.org/docs/current/ddl-constraints.html'],
 ['PSGC API project','Philippine Standard Geographic Code API','n.d.','https://psgc.gitlab.io/api/'],
 ['National Privacy Commission','Republic Act No. 10173: Data Privacy Act of 2012','2012','https://privacy.gov.ph/data-privacy-act/'],
 ['Republic of the Philippines','Republic Act No. 11967: Internet Transactions Act of 2023','2023','https://lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html'],
 ['Bureau of Internal Revenue','Revenue Memorandum Circular No. 77-2024: clarification of invoicing requirements under RR 7-2024, as amended','2024','https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf'],
 ['Supabase','Database Backups','n.d.','https://supabase.com/docs/guides/platform/backups'],
 ['OWASP Foundation','HTML5 Security Cheat Sheet','n.d.','https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html'],
 ['Supabase','Redirect URLs','n.d.','https://supabase.com/docs/guides/auth/redirect-urls'],
 ['Supabase','API keys','n.d.','https://supabase.com/docs/guides/getting-started/api-keys'],
]
export const chapters = [
 { title:'CHAPTER 1 — PROJECT OVERVIEW', sections:[
  ['1.1 Business Objectives',[
   'RodelConnect is the current web reservation application for Rodel\'s Catering Services. It centralizes package selection, event details, scheduling, quotes, workflow requests and service communication in a React interface backed by Supabase. The business context presented in the existing About page identifies San Ildefonso, Bulacan as the operating location. This paper documents the inspected implementation rather than a fictional proposed PHP system. [1]',
   'The objectives are accessible browser booking, consistent date/selection/pricing rules, organized staff review and linked payment records. These are supported design objectives; sales improvement, processing-time reductions and adoption outcomes have not been measured. No survey or operational performance dataset was supplied.',
   'The official title retains “with Integrated Chatbot” as provided. The current build has no chatbot widget, provider/model, endpoint or conversation schema. Chatbot assistance anticipated in the earlier background remains planned scope, not a completed feature. [1], [3]',
  ]],
  ['1.2 Target Audience',[
   'Customers include individuals, families, organizations and businesses arranging catered occasions such as birthdays, weddings and corporate gatherings. Public visitors may browse packages, the gallery and policies without an account. Authenticated reservation users have the database role customer; “guest” is not a separate stored role. Customers create and track their own bookings, open eligible payment sessions, submit requests and communicate through private support threads. [1]',
   'Managers review reservations and workflow requests, maintain categories/dishes/drinks/desserts, and read payments/reports, feedback and support. super_admin additionally manages packages/priced extras, gallery, permitted role assignments, maintenance and audit logs, and may enter manager routes. Staff cannot use customer booking routes. First super-admin creation requires an operator workflow; registration cannot select a privileged role.',
  ]],
  ['1.3 Problem Statement',[
   'The earlier Chapters 1–2 document described manual and fragmented reservation coordination, difficulty checking availability, and inconsistent tracking of payments and request changes. These statements are treated as the historical motivation supplied by the project team. They are not asserted as newly measured conditions, and no invented customer count, consultation date, defense comment or test statistic is added. [3]',
   'The technical problem addressed by the current implementation is maintaining a consistent reservation state when customers and staff perform different actions. A browser quote must not override authoritative prices; concurrent approvals must not exceed date capacity; a payment return link must not create a paid record; and one customer must not obtain another customer\'s booking or support data. Current SQL constraints, protected functions, Row Level Security and server-side provider verification address these concerns. [1]',
  ]],
  ['1.4 Project Scope',[
   'Implemented customer functions include structured registration, email/password sign-in, recovery-page handling, profile/avatar editing, package and available-date browsing, a multi-step reservation wizard, saved quotes, finalization, reservation detail, down-payment/full/balance checkout, cancellation and reschedule requests, refund requests, payment/transaction views, completed-reservation feedback and support. Manager and super-admin screens implement the operational scopes described in Section 1.2. [1]',
   'The reservation rules require an event at least three Manila calendar days ahead, an event time between 07:00 and 22:00, package minimum guests, the exact package dish count, an active drink/dessert/setup, a complete event address, sufficient active chairs and at least one table. A unique index prevents a second active reservation for the same customer and date. Capacity is held by approved/completed bookings and retained during pending cancellation, with a maximum of three per date.',
   'Verification covered 35 local checks plus hosted login, reservation APIs, test checkout, unsigned webhook rejection and recovery. Paid/refund completion, inbox delivery, full browser/concurrency, Storage and Realtime acceptance remain pending. Chatbot, SMS/OTP, courier, privacy portal, compliant invoices, tax automation, restore verification and CI gates remain incomplete. Business seeds need review; legacy import is unverified. [1]',
  ]],
 ]},
 { title:'CHAPTER 2 — SYSTEM ARCHITECTURE', sections:[
  ['2.1 Architectural Pattern',[
   'The current application uses a client–managed-service–serverless architecture. Vercel serves a static Vite build of a browser React single-page application. Supabase provides Auth, a PostgreSQL Data API, Storage, Realtime and Deno Edge Functions. Browser users perform policy-controlled data reads and permitted catalog/profile writes, while business transitions use SQL RPCs and provider-sensitive operations use Edge Functions. This is a layered architecture, but its application logic is deliberately shared between SQL functions and serverless handlers rather than a standalone PHP application server. [1], [7], [12]',
   'The frontend is not implemented as server-side rendering, and the repository does not contain a current PHP/MySQL runtime or a microservice fleet. The legacy PHP application remains historical background. The development laptop may run Vite locally against the hosted Supabase project; another user needs only the deployed browser URL, not XAMPP or a local database.',
  ]],
  ['2.2 System Layers',[
   'Presentation layer. React pages and shared layouts provide public content, authentication and three role workspaces. React Router defines routes; React Hook Form and Zod validate forms; TanStack Query handles cached queries and refreshes; Recharts visualizes derived staff metrics. src/features/auth.tsx supplies session/profile state and RoleGuard, but browser guards are only the user-experience layer of authorization. [1], [4]–[6]',
   'Application layer. SQL routines enforce ownership, prices, reservation state transitions, capacity, cancellation/rescheduling rules and refund eligibility. Edge Functions verify callers with auth.getUser(), retain provider secrets on the server and handle PayMongo REST requests and webhook verification. The optional email worker derives its recipient and content from an existing notification rather than accepting arbitrary browser email requests.',
   'Data layer. PostgreSQL stores 34 public domain tables and their constraints; all have RLS enabled in the inspected migration execution. auth.users is a platform-managed identity source, linked one-to-one at most to profiles. Storage contains avatar/gallery objects, while Realtime publishes notification changes. Monetary values are bigint centavos; event dates/times follow Manila-local rules and timestamps are timestamptz. [1], [9]–[11]',
  ]],
  ['2.3 Data Flow',[
   '1. The customer browses active packages and queries available_dates over a bounded date range. Registration sends first name, optional middle name, last name and mobile contact to Supabase Auth metadata. The Auth trigger creates a profile with customer role regardless of submitted role metadata. Login obtains a session and loads the profile before selecting the role workspace.',
   '2. The reservation wizard collects event/address/contact details, package/menu selections, setup, features, add-ons and seating. save_reservation locks an existing eligible booking or creates an owned draft, replaces selected child rows and recalculates the quote in SQL. Supplied browser totals are not authoritative. Editing is blocked after payment, approval or while an open checkout requires reconciliation.',
   '3. finalize_reservation validates complete active selections and the event address, stores the server quote, moves the booking to for_approval, records the current balance and writes notices/audit data. Staff may review a valid future booking. Capacity checks occur when a transition actually holds capacity, not merely when a customer saves a draft.',
   '4. An authenticated customer requests a payment intent through create-paymongo-checkout. begin_checkout locks the reservation and determines 50% down payment, full initial payment or the outstanding balance. A conditional provider claim prevents duplicate session creation. The Edge Function creates a PayMongo Checkout Session and stores its identifier and validated HTTPS checkout URL. The customer enters payment information on the provider page, not in this application. [1], [14]',
   '5. A return URL only reloads the reservation. Payment confirmation requires the checkout_session.payment.paid webhook, valid raw-body HMAC/timestamp/mode, an independent provider session lookup and a matching amount/session in confirm_provider_payment. That transaction deduplicates events, records the payment, updates balances and inserts a ledger transaction. If future-date capacity remains available, the reservation can be approved; otherwise the payment is retained and staff must coordinate capacity with the customer. [1], [15]',
   '6. A customer cancellation request is reviewed by staff. An approved cancellation releases held capacity and zeroes the current payable balance. Eligible paid bookings may request a refund; the amount is frozen using the configured policy. Approved refunds are allocated across original payments, claimed once and checked against provider results. finish_refund completes local state only after the full eligible amount is confirmed successful. Rescheduling similarly requires staff review, date capacity and the monthly successful-reschedule limit.',
  ]],
  ['2.4 Architecture Diagram',[
   'Figure 2.1 distinguishes the browser, Supabase APIs/database and server-side provider boundary. The optional Resend connection is drawn as optional code, and the PSGC lookup/operator deployment are identified in the diagram note. Figures 2.2 and 2.3 separate reservation entry from payment verification so that no return redirect is mistaken for proof of payment.',
  ],{figure:'architecture.png',inline:true,caption:'Figure 2.1. Current React, Supabase and serverless architecture.',explain:'Derived from the current router, Supabase client, Edge Functions and deployment configuration. Provider credentials stay in server configuration.'},
    {figure:'reservation-workflow.png',caption:'Figure 2.2. Reservation workflow and server validation.',explain:'Draft entry, saved pricing and finalization are separate operations. A saved draft does not itself reserve one of the three approved slots.'},
    {figure:'payment-data-flow.png',caption:'Figure 2.3. Verified payment data-flow design.',explain:'The diagram shows implemented confirmation logic; successful paid provider delivery remains an acceptance item. The dashed return path cannot confirm payment.'}],
 ]},
 { title:'CHAPTER 3 — TECHNOLOGY STACK', sections:[
  ['',[
   'Table 3.1 lists technologies found in the current source and lockfile. The reasons are implementation-based technical justifications, not invented historical team decisions. Exact JavaScript package versions are taken from the inspected lockfile; package.json ranges alone do not establish the installed version. Supabase is managed PostgreSQL, but the hosted PostgreSQL engine version was not queried for this document. [1]',
  ],{table:'stack',caption:'Table 3.1. Verified technology stack and technical justification.'}],
 ]},
 { title:'CHAPTER 4 — KEY API INTEGRATIONS', sections:[
  ['4.1 Payment Gateway',[
   'PayMongo is the implemented payment provider. create-paymongo-checkout calls the Checkout Sessions REST endpoint and requests GCash and card payment methods; actual availability depends on the merchant account. The configured integration uses PHP currency and test-mode credentials in the recorded setup. A hosted test checkout was successfully created through the customer session. No real payment amount, provider reference, checkout token or customer transaction is reproduced in this paper. [1], [14]',
   'The webhook subscribes to checkout_session.payment.paid. The handler verifies Paymongo-Signature using raw-body SHA-256 HMAC, the matching test/live signature field and a five-minute timestamp window. It independently retrieves provider state and only submits a matching paid PHP payment to the restricted SQL confirmation function. A deployed unsigned request returned HTTP 401. Successful paid delivery and duplicate-delivery acceptance remain pending despite local SQL/signature tests passing. [1], [15]',
   'Refund requests originate from an approved cancellation and a valid paid amount. Seeded policy defaults are 30% of an exact 50% down payment or 70% of a fully paid amount; super-admin settings may change these values, and stored eligibility remains fixed for an existing request. The deployed refund handler supports allocation, provider submission/status lookup and completion checks. Provider refund completion has not been verified. These technical defaults need business approval and legal review before customer use.',
  ]],
  ['4.2 Logistics & Shipping',[
   'A courier shipping integration is not applicable to the inspected event-service reservation scope. The application coordinates an event date/time, venue address, guest count, setup and seating selections. It does not create shipping labels, courier tracking numbers, delivery-rate quotations, rider assignments or a separate logistics inventory. Event coordination must not be described as a J&T, LBC, Lalamove or other provider integration without code evidence. [1]',
  ]],
  ['4.3 Notifications (SMS/Email)',[
   'In-app notifications are implemented as recipient-linked database rows. SQL routines notify customers and staff after relevant transitions. PortalLayout subscribes to the notifications Realtime publication and also refetches every 60 seconds. Read/unread state is restricted to the recipient. Real hosted subscription/delivery acceptance remains pending. [1], [11]',
   'Supabase Auth handles verification and password-recovery requests. Backend recovery, password replacement and the live redirect were tested without sending email to the test identities. Inbox delivery was not verified. Supabase default SMTP restricts delivery to project-team recipients; custom SMTP is needed for general users and production mail. Mobile contact collection does not implement SMS or phone OTP. [8], [13], [25]',
   'Optional transactional email code uses Resend through send-transactional-email and an internal dispatch script. It derives addresses from persisted users/notifications, uses a worker secret and an idempotency key, and records deliveries. The function is deployed, but configured Resend credentials, a scheduled worker and received messages are not verified. Optional email must therefore be presented as partially configured code rather than a working general notification service. [1], [16]',
  ]],
  ['4.4 Integrated Chatbot — Planned Feature',[
   'The current source has no chatbot widget, endpoint, provider/model, knowledge base or conversation schema. Support is human staff/customer messaging. The official title is retained, but chatbot integration is planned and must not be presented as completed functionality or added to the current ERD/screenshots. [1]',
   'Future chatbot work requires a provider decision, server-held credentials, approved knowledge sources, privacy/retention controls, human fallback and evaluation. No brand/model is assumed.',
  ]],
  ['4.5 Geographic Address Lookup',[
   'The wizard uses the public PSGC API for province/city/barangay lookup through src/services/psgc.ts, with validated cached results, request timeout and manual fallback. This does not establish courier tracking or official venue validation. [1], [19]',
  ]],
 ]},
]
