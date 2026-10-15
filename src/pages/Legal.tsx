import { Link } from 'react-router-dom'
import { POLICY_VERSION } from '../lib/booking-constants'
export function Terms() {
  return (
    <section className="section container prose">
      <span className="eyebrow">
        POLICY VERSION {POLICY_VERSION} · OWNER/LEGAL REVIEW DRAFT
      </span>
      <h1>Terms and Conditions</h1>
      <p>
        These booking terms describe the current RodelConnect workflow for
        Rodel’s Catering Services. They are prepared from the business
        instructions for owner and legal review; they do not certify legal
        compliance.
      </p>
      <h2>Service and bookings</h2>
      <p>
        Event coverage is Bulacan and Pampanga. Choose a current set menu for
        100–1,000 guests and reserve at least three calendar days ahead.
        Capacity is three approved events per date. A draft or pending request
        does not confirm capacity; check your approved reservation status.
        Operating start hours are Monday–Saturday 7 AM–10 PM and Sunday 8 AM–9
        PM, Manila, subject to approved closed dates or special-hour exceptions.
      </p>
      <h2>Menus and event details</h2>
      <p>
        Menu rates are per guest and include rice, one drink, one dessert, basic
        tables, Monoblock chairs and simple buffet setup. Birthday setup
        includes three optional ₱5,000 components, totalling ₱15,000 when all
        are selected. Wedding setup adds ₱30,000 for all six inclusions; partial
        pricing requires the owner-approved breakdown. Guest elegant-chair
        upgrades, optional features and add-ons are separately itemized. Choose
        1 up to your guest count for Elegant guest chairs at ₱10 each; remaining
        guest seats use included Monoblock chairs. This quantity is separate
        from the fixed event-setup inclusions, whose prices are unchanged.
        Theme/color preferences and celebrant age are optional requests; discuss
        suitability with the team before the event.
      </p>
      <h2>Payments and outstanding balances</h2>
      <p>
        You can pay a 50% down payment or 100% of the booking total. The
        outstanding balance is total minus confirmed payments and may be paid
        through the balance checkout. Payment amounts come from the server.
        PayMongo handles hosted checkout; returning to the website is not
        payment confirmation. Only verified provider processing updates the
        payment record. The site’s records are payment confirmations and do not
        establish BIR-compliant tax invoices.
      </p>
      <h2>Cancellations and rescheduling</h2>
      <p>
        Cancellation requests must be made more than 72 hours before the event
        date begins in Manila and require staff review. An approved future
        booking may request a different available date at least three days
        ahead, with up to three approved reschedules per calendar month. The
        original date stays in place while review is pending. Open checkouts
        must be reconciled before changes.
      </p>
      <h2>Refund deadline and fee</h2>
      <p>
        A refund requires an approved cancellation and must be requested on or
        before the scheduled event start minus five full calendar days, using
        Asia/Manila. A request four days before the start is late. The backend
        uses the saved event date/time, not your device clock.
      </p>
      <p>
        For paid money refundable under this policy, the fee is 10% of the
        amount paid, and the refund is 90%. ₱10,000 paid gives ₱9,000; ₱20,000
        paid gives ₱18,000. This fee is not based on the unpaid reservation
        total. Prior refunds are deducted from the original 90% entitlement so
        the fee is not applied again to each remaining amount. Reviewed
        historical requests retain their stored amount.
      </p>
      <p>
        Requests are reviewed by staff. Approval does not mean the provider has
        completed a refund. Pending/failed or ambiguous provider operations
        require reconciliation; completion is recorded only after provider
        confirmation. Late, denied or unsupported requests should be raised
        through support. This draft does not promise an exception or a
        processing turnaround time.
      </p>
      <h2>Privacy and contact</h2>
      <p>
        Read the <Link to="/privacy">Privacy Notice</Link> before submitting.
        Acceptance is recorded with the policy version and a server timestamp.
        For corrections, booking questions or policy review, use your support
        inbox or the{' '}
        <Link to="/about">published business contact channels</Link>.
      </p>
    </section>
  )
}
export function Privacy() {
  return (
    <section className="section container prose">
      <span className="eyebrow">
        POLICY VERSION {POLICY_VERSION} · OWNER/LEGAL REVIEW DRAFT
      </span>
      <h1>Privacy Notice</h1>
      <p>
        Rodel’s Catering Services uses RodelConnect to manage catering inquiries
        and bookings. This notice explains the implemented processing and is a
        draft for owner/legal review under the Philippine Data Privacy Act of
        2012 (RA 10173); no legal certification is asserted.
      </p>
      <h2>Information collected and purpose</h2>
      <p>
        We collect account email and identity details through Supabase Auth;
        first/middle/last name, primary and saved alternate mobile numbers,
        optional avatar; event name/date/time, venue address and geographic
        selections, guest count, menu/setup/add-on choices, optional celebrant
        age/theme/colors and event contact; booking consent version/time;
        provider payment/refund references and amounts; support messages,
        feedback, notifications and administrative audit records. These support
        identity verification, service coordination, payment reconciliation,
        customer assistance and accountability.
      </p>
      <h2>Access and service providers</h2>
      <p>
        Customers access their own permitted records. Managers handle
        operational booking, payment and support records. Super admins
        administer account access, system configuration, gallery, audit and
        application archives. Supabase provides database, authentication,
        storage and server functions; Vercel hosts the website. PayMongo
        processes hosted payments and refund operations. Card/payment
        credentials are entered through the provider flow rather than stored as
        card numbers in our booking tables.
      </p>
      <p>
        The chatbot currently sends entered questions and short conversation
        context to Groq for intent interpretation, then answers using public
        catalog/date facts. It has no access to private reservation records.
        Avoid entering passwords, card details, private booking information or
        unnecessary personal data in the chatbot or support messages. Published
        gallery/avatar images can be publicly accessible; uploaded event photos
        should have appropriate permission for publication.
      </p>
      <h2>Retention and safeguards</h2>
      <p>
        Your current browser tab temporarily keeps unfinished booking details
        so that policy links, returning to the form or reloading do not erase
        your work. Drafts are separated by account and booking, removed when
        finalized or signed out, and use browser session storage rather than
        creating a reservation before you choose to save.
      </p>
      <p>
        Records are retained while needed for booking/service support, payment
        reconciliation and applicable record-keeping duties. A specific
        retention schedule and deletion process still require the owner’s
        review; automatic retention/deletion is not implemented. Access controls
        and row-level security limit application records by role. Authorized
        backup downloads contain personal information and require secure
        operator storage. These measures do not guarantee that a service cannot
        experience an incident.
      </p>
      <h2>Your rights and requests</h2>
      <p>
        You may request information about processing, access or correction of
        your data, or raise an objection or request erasure/blocking where
        applicable. Requests are assessed against identity verification and
        applicable retention obligations. To make a request or raise a privacy
        concern, contact the business through the{' '}
        <Link to="/about">published contact page</Link> or your support inbox.
        The owner must confirm the responsible privacy contact and retention
        procedure before commercial rollout.
      </p>
      <p>
        The acknowledgment used when booking records that you read the current{' '}
        <Link to="/terms">Terms</Link> and this notice. It does not replace the
        business’s duty to review its legal basis and obligations. See the{' '}
        <a
          href="https://privacy.gov.ph/data-privacy-act/"
          target="_blank"
          rel="noreferrer"
        >
          National Privacy Commission’s Data Privacy Act guidance
        </a>{' '}
        for the law.
      </p>
    </section>
  )
}
