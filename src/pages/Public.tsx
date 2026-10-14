import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Flower2,
  Heart,
  Leaf,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { useCatalog } from '../features/catalog'
import { configured, records } from '../lib/supabase'
import { money } from '../lib/format'
import type { CatalogItem } from '../types'
import { Empty, ErrorState, Loading } from '../components/ui'
const photos = ['/images/celebration.jpg', '/images/table.jpg', '/images/food.jpg']
export function PackageCards() {
  const query = useCatalog()
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  return (
    <>
      {!configured && (
        <p className="demo-note">
          Business menu preview. Connect Supabase to view the live catalog and make reservations.
        </p>
      )}
      <div className="package-grid">
        {query.data.menu_sets.map((p, i) => (
          <article className={'package-card ' + (i === 1 ? 'featured' : '')} key={p.id}>
            <div
              className="package-photo"
              style={{ backgroundImage: `url(${p.image_url || photos[i % 3]})` }}
            >
              <span>{['THE EVERYDAY SPECIAL', 'A LITTLE EXTRA MAGIC', 'GO ALL OUT'][i % 3]}</span>
              {i === 1 && <span className="popular">SIGNATURE PICK</span>}
            </div>
            <div className="package-content">
              <span className="eyebrow">
                {p.dish_count} DISHES · {p.min_guests}{p.max_guests ? '–' + p.max_guests : '+'} GUESTS
              </span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <ul>
                {p.pricing_version === 2 && <li><Check size={15} />Rice included</li>}
                <li>
                  <Check size={15} />
                  Your choice of {p.dish_count} dishes
                </li>
                <li>
                  <Check size={15} />
                  One refreshing drink & dessert
                </li>
                <li>
                  <Check size={15} />
                  {p.pricing_version === 2 ? 'Basic tables, Monoblock chairs & simple buffet setup' : 'Personalize your setup & extras'}
                </li>
              </ul>
              {!!p.suggested_dishes?.length && <details className="package-suggested"><summary>Suggested menu</summary><ul>{p.suggested_dishes.map((choices, index) => <li key={index}>{choices.join(' or ')}</li>)}</ul><small>Or pick your own {p.dish_count} dishes.</small></details>}
              <div className="package-bottom">
                <div>
                  <strong>{money(p.price || 0)}</strong>
                  <small>{p.pricing_version === 2 ? 'per guest · basic setup included' : 'per guest · setup priced separately'}</small>
                </div>
                <Link
                  className="round-link"
                  to={'/customer/reservations/new?package=' + p.id}
                  aria-label={'Reserve ' + p.name}
                >
                  <ArrowUpRight size={20} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
export function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span /> GOOD FOOD, GREAT COMPANY
            </div>
            <h1>
              For the moments
              <br />
              you’ll <em>remember.</em>
            </h1>
            <p>
              From intimate gatherings to life’s grand celebrations, we bring heartfelt flavors and
              thoughtful details to your table.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/packages">
                Find your perfect package <ArrowUpRight size={17} />
              </Link>
              <a className="text-button" href="#experience">
                Get to know Rodel’s <ArrowDown size={15} />
              </a>
            </div>
            <div className="hero-note">
              <Heart size={18} />
              <span>Prepared with care. Shared with love.</span>
            </div>
          </div>
          <div className="hero-image">
            <img src={photos[0]} alt="A warmly lit venue prepared for a celebration" />
            <div className="hero-image-shade" />
            <div className="image-caption">
              <span>THE TABLE IS SET.</span>
              <strong>All that’s missing is you.</strong>
            </div>
            <div className="hero-seal">
              <Flower2 size={29} />
              <span>
                THOUGHTFULLY
                <br />
                CELEBRATED
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="occasion-strip">
        <div className="container">
          <span>Weddings</span>
          <i>✧</i>
          <span>Birthdays</span>
          <i>✧</i>
          <span>Family gatherings</span>
          <i>✧</i>
          <span>Corporate events</span>
          <i>✧</i>
          <span>Every milestone</span>
        </div>
      </div>
      <section className="section container" id="experience">
        <div className="intro-grid">
          <div>
            <span className="eyebrow">A WARM WELCOME TO RODEL’S</span>
            <h2>
              More than a meal.
              <br />
              <em>A shared memory.</em>
            </h2>
          </div>
          <p>
            There’s something special about bringing people together around good food. We make room
            for those moments, with a menu you’ll love and a celebration that feels like you.
          </p>
        </div>
        <div className="values-grid">
          {[
            {
              Icon: UtensilsCrossed,
              title: 'Flavors that feel like home',
              text: 'Familiar Filipino favorites, generously prepared and served with care.',
            },
            {
              Icon: Flower2,
              title: 'Details with a personal touch',
              text: 'Choose your menu, event setup, and the finishing touches that make it yours.',
            },
            {
              Icon: Heart,
              title: 'A little less to worry about',
              text: 'Plan, reserve, and keep track of your celebration in one welcoming place.',
            },
          ].map(({ Icon, title, text }) => (
            <div className="value-card" key={title}>
              <span className="value-icon">
                <Icon size={24} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="packages-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SOMETHING FOR EVERY CELEBRATION</span>
              <h2>A delicious place to start.</h2>
            </div>
            <Link className="text-button" to="/packages">
              Explore all packages <ArrowRight size={18} />
            </Link>
          </div>
          <PackageCards />
        </div>
      </section>
      <section className="section container story-grid">
        <div className="story-photo">
          <img src={photos[1]} alt="Thoughtfully arranged banquet table" loading="lazy" />
          <span>
            GOOD COMPANY.
            <br />
            BEAUTIFUL DETAILS.
          </span>
        </div>
        <div>
          <span className="eyebrow">YOUR CELEBRATION, YOUR WAY</span>
          <h2>
            Dream it.
            <br />
            Make it <em>yours.</em>
          </h2>
          <p>
            A garden party, an elegant reception, or a joyful gathering at home. Pick the flavors,
            the setting, and the little extras. We’ll help bring it all together.
          </p>
          <div className="story-points">
            <span>
              <Leaf size={18} />
              Personalized menus
            </span>
            <span>
              <Sparkles size={18} />
              Thoughtful event setups
            </span>
          </div>
          <Link className="button secondary" to="/gallery">
            A little inspiration <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="cta-section">
        <div className="container">
          <Flower2 size={35} />
          <span className="eyebrow">LET’S MAKE SOMETHING MEMORABLE</span>
          <h2>
            Your next chapter
            <br />
            deserves a <em>celebration.</em>
          </h2>
          <Link className="button cream" to="/customer/available-dates">
            Let’s plan your event <ArrowUpRight size={18} />
          </Link>
          <p>Good food is just the beginning.</p>
        </div>
      </section>
    </>
  )
}
export function Packages() {
  return (
    <section className="section container">
      <div className="public-page-heading">
        <span className="eyebrow">A FEAST FOR YOUR OCCASION</span>
        <h1>
          Made to bring
          <br />
          <em>everyone together.</em>
        </h1>
        <p>
          Choose your set menu, then pick your own dishes. Rice, one drink, one dessert, basic
          tables, Monoblock chairs and simple buffet setup are included. Seating and event upgrades
          are added before confirmation.
        </p>
      </div>
      <PackageCards />
      <div className="info-banner">
        <Flower2 />
        <div>
          <strong>Every celebration is a little different.</strong>
          <p>
            Sign in to explore available dates and put together your event. You’ll see your full
            server-calculated quote before you finalize.
          </p>
        </div>
        <Link to="/login" className="text-button">
          Get started <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}
export function Gallery() {
  const query = useQuery({
    queryKey: ['gallery'],
    enabled: configured,
    queryFn: () => records<CatalogItem>('gallery_images', 'created_at', false, { active: true }),
  })
  return (
    <section className="section container">
      <div className="public-page-heading">
        <span className="eyebrow">A LITTLE INSPIRATION</span>
        <h1>
          Beautiful moments,
          <br />
          <em>shared together.</em>
        </h1>
        <p>Find inspiration for the celebration you have in mind.</p>
      </div>
      {configured ? (
        query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : query.data?.length ? (
          <div className="gallery-grid">
            {query.data.map((p) => (
              <figure key={p.id}>
                <img src={p.image_url} alt={p.name} loading="lazy" />
                <figcaption>{p.name}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <Empty title="Our gallery is being prepared">
            Check back soon for celebrations from Rodel’s.
          </Empty>
        )
      ) : (
        <>
          <p className="demo-note">A selection from Rodel’s original event gallery.</p>
          <div className="gallery-grid">
            {photos.map((p, i) => (
              <figure key={p}>
                <img
                  src={p}
                  alt={['Floral celebration venue', 'Wedding setup', 'Corporate event'][i]}
                />
                <figcaption>
                  {['A warm welcome', 'Details to remember', 'Gather around the table'][i]}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
export function About() {
  return (
    <section className="section container story-grid">
      <div>
        <span className="eyebrow">THE HEART OF EVERY CELEBRATION</span>
        <h1>
          A family story.
          <br />
          <em>A shared table.</em>
        </h1>
        <p>
          Founded in San Ildefonso, Bulacan by Lilian & Rodel Gonzales, Rodel’s grew from a small
          karinderya into a catering service known across Bulacan and nearby provinces.
        </p>
        <p>
          With over 20 years of experience, we bring good food, thoughtful service, and a personal
          touch to the occasions that matter.
        </p>
        <h3>Let’s talk about your event.</h3>
        <div className="contact-details">
          <a href="tel:+639277813253">0927 781 3253</a>
          <a href="mailto:rodelscateringinfo@gmail.com">rodelscateringinfo@gmail.com</a>
          <span>San Ildefonso, Bulacan, Philippines</span>
          <a
            href="https://www.facebook.com/profile.php?id=100069001067978"
            target="_blank"
            rel="noreferrer"
          >
            Visit our Facebook page ↗
          </a>
        </div>
        <p className="muted">
          Monday–Saturday · 7 AM–10 PM
          <br />
          Sunday · 8 AM–9 PM
        </p>
        <Link className="button" to="/customer/support">
          Contact our team <ArrowRight size={17} />
        </Link>
      </div>
      <img className="about-image" src={photos[1]} alt="An original Rodel’s celebration setup" />
    </section>
  )
}
export function Policies() {
  const settings = useQuery({
    queryKey: ['public-policy'],
    enabled: configured,
    queryFn: () => records<{ key: string; value: unknown }>('app_settings', 'key', true),
  })
  if (configured && settings.isPending) return <Loading />
  if (settings.error)
    return <ErrorState error={settings.error} retry={() => void settings.refetch()} />
  const partial = configured
    ? Number(settings.data?.find((s) => s.key === 'refund_partial_rate')?.value) * 100
    : 30
  const full = configured
    ? Number(settings.data?.find((s) => s.key === 'refund_full_rate')?.value) * 100
    : 70
  return (
    <section className="section container prose">
      <span className="eyebrow">BEFORE WE SET THE TABLE</span>
      <h1>Reservation & refund policies</h1>
      <h2>Booking your celebration</h2>
      <p>
        One active reservation per customer per event date. A maximum of three approved events can
        be accommodated per date. Your date is confirmed when the server shows an approved
        reservation; payment alone may require capacity review. Reserve at least three calendar days
        ahead.
      </p>
      <h2>Pricing & payments</h2>
      <p>
        Menu price is the price per guest multiplied by your guest count (100–1,000 guests).
        Basic tables, Monoblock chairs and simple buffet setup are included. Elegant chairs add
        ₱10 per guest. Birthday/wedding setups and chosen extras have separate event fees. The server-calculated confirmation is
        authoritative. You may pay a 50% down payment, pay in full, or settle an existing balance
        through PayMongo.
      </p>
      <h2>Changes & rescheduling</h2>
      <p>
        Unpaid, unapproved reservations can be edited before checkout. Approved or paid reservations
        require our team’s review. Approved bookings may request up to three successful reschedules
        per calendar month. New dates must be at least three days ahead. Changes are subject to
        availability. Open payment sessions must be reconciled before changes.
      </p>
      <h2>Cancellation</h2>
      <p>
        Request cancellation strictly more than 72 hours before the event date begins in
        Asia/Manila. A manager will review your request. Cancellation is not automatic.
      </p>
      <h2>Refunds</h2>
      <p>
        After a valid approved cancellation, a reservation with only a 50% down payment is eligible
        for {partial}% of the amount actually paid. A fully paid reservation is eligible for {full}%
        of the total amount paid. The eligible amount is stored when you request a refund and is
        subject to review and provider processing.
      </p>
      <h2>Before the day</h2>
      <p>
        Tell our team about dietary restrictions and allergies before finalizing. Allow the setup
        team venue access one to two hours before the agreed event time. Clients are responsible for
        damage to catering equipment and venue fixtures. Leftover food belongs to the client;
        arrange safe storage after the event.
      </p>
      <p>
        No-shows without prior notice forfeit the reservation and are not eligible for refunds.
        Extreme weather, government restrictions and other force majeure disruptions should be
        discussed with management through support.
      </p>
      <h2>Support & privacy</h2>
      <p>
        Use your account’s support inbox for questions about payments, cancellations and refunds.
        Your reservation records are available to you and authorized catering staff. Payment
        information is handled by PayMongo. Do not include passwords or card details in support
        messages.
      </p>
    </section>
  )
}
