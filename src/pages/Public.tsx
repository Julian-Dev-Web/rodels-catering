import { Link } from 'react-router-dom'
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
import { configured } from '../lib/supabase'
import { money } from '../lib/format'
import { ErrorState, Loading } from '../components/ui'
import { MenuIllustration } from '../components/MenuIllustration'
import { EventShowcase } from '../components/EventShowcase'
import { HeroCarousel } from '../components/HeroCarousel'
const photos = [
  '/images/celebration.jpg',
  '/images/table.jpg',
  '/images/food.jpg',
]
export function PackageCards() {
  const query = useCatalog()
  if (query.isPending) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
  return (
    <>
      {!configured && (
        <p className="demo-note">
          Business menu preview. Connect Supabase to view the live catalog and
          make reservations.
        </p>
      )}
      <div className="package-grid">
        {query.data.menu_sets.map((p, i) => (
          <article
            className={'package-card ' + (i === 1 ? 'featured' : '')}
            key={p.id}
          >
            <div
              className={
                'package-photo ' + (!p.image_url ? 'menu-artwork' : '')
              }
              style={
                p.image_url
                  ? { backgroundImage: `url(${p.image_url})` }
                  : undefined
              }
            >
              {!p.image_url && <MenuIllustration dishes={p.dish_count || 3} />}
              <span>{p.dish_count} DISHES · PICK YOUR FAVORITES</span>
              {i === 1 && <span className="popular">SIGNATURE PICK</span>}
            </div>
            <div className="package-content">
              <span className="eyebrow">
                {p.dish_count} DISHES · {p.min_guests}
                {p.max_guests ? '–' + p.max_guests : '+'} GUESTS
              </span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <ul>
                {p.pricing_version === 2 && (
                  <li>
                    <Check size={15} />
                    Rice included
                  </li>
                )}
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
                  {p.pricing_version === 2
                    ? 'Basic tables, Monoblock chairs & simple buffet setup'
                    : 'Personalize your setup & extras'}
                </li>
              </ul>
              {!!p.suggested_dishes?.length && (
                <details className="package-suggested">
                  <summary>Suggested menu</summary>
                  <ul>
                    {p.suggested_dishes.map((choices, index) => (
                      <li key={index}>{choices.join(' or ')}</li>
                    ))}
                  </ul>
                  <small>Or pick your own {p.dish_count} dishes.</small>
                </details>
              )}
              <div className="package-bottom">
                <div>
                  <strong>{money(p.price || 0)}</strong>
                  <small>
                    {p.pricing_version === 2
                      ? 'per guest · basic setup included'
                      : 'per guest · setup priced separately'}
                  </small>
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
              From intimate gatherings to life’s grand celebrations, we bring
              heartfelt flavors and thoughtful details to your table.
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
          <HeroCarousel />
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
            There’s something special about bringing people together around good
            food. We make room for those moments, with a menu you’ll love and a
            celebration that feels like you.
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
          <img
            src={photos[1]}
            alt="Thoughtfully arranged banquet table"
            loading="lazy"
          />
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
            A garden party, an elegant reception, or a joyful gathering at home.
            Pick the flavors, the setting, and the little extras. We’ll help
            bring it all together.
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
      <section className="section container">
        <EventShowcase compact />
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
          Choose your set menu, then pick your own dishes. Rice, one drink, one
          dessert, basic tables, Monoblock chairs and simple buffet setup are
          included. Seating and event upgrades are added before confirmation.
        </p>
      </div>
      <PackageCards />
    </section>
  )
}
export function Gallery() {
  return (
    <section className="section container">
      <div className="public-page-heading">
        <span className="eyebrow">RODEL’S EVENT SHOWCASE</span>
        <h1>
          Celebrations,
          <br />
          <em>beautifully set.</em>
        </h1>
        <p>
          Explore real event photos, from birthday details to school ceremonies
          and outdoor gatherings. Tap a photo for a closer look.
        </p>
      </div>
      <EventShowcase />
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
          Founded in San Ildefonso, Bulacan by Lilian & Rodel Gonzales, Rodel’s
          grew from a small karinderya into a catering service known across
          Bulacan and nearby provinces.
        </p>
        <p>
          With over 20 years of experience, we bring good food, thoughtful
          service, and a personal touch to the occasions that matter.
        </p>
        <h3>Let’s talk about your event.</h3>
        <div className="contact-details">
          <a href="tel:+639277813253">0927 781 3253</a>
          <a href="mailto:rodelscateringinfo@gmail.com">
            rodelscateringinfo@gmail.com
          </a>
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
      <img
        className="about-image"
        src={photos[1]}
        alt="An original Rodel’s celebration setup"
      />
    </section>
  )
}
export { Terms as Policies } from './Legal'
