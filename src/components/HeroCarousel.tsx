import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flower2, Pause, Play } from 'lucide-react'
import { configured, records } from '../lib/supabase'
import type { GalleryImage } from '../lib/gallery'
const approved = [
  {
    image_url: '/images/facebook-showcase.jpg',
    name: 'Rodel’s outdoor evening setup with banquet tables and lighting',
  },
  {
    image_url: '/images/celebration.jpg',
    name: 'Floral birthday celebration setup',
  },
  { image_url: '/images/table.jpg', name: 'Green and ivory event setup' },
  { image_url: '/images/food.jpg', name: 'School recognition ceremony setup' },
]
export function HeroCarousel() {
  const gallery = useQuery({
    queryKey: ['gallery'],
    enabled: configured,
    queryFn: () =>
      records<GalleryImage>('gallery_images', 'created_at', false, {
        active: true,
      }),
  })
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [hidden, setHidden] = useState(document.hidden),
    [reduced, setReduced] = useState(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    [broken, setBroken] = useState<string[]>([])
  const photos = [...approved, ...(gallery.data || [])]
    .filter(
      (p, i, all) =>
        !broken.includes(p.image_url) &&
        all.findIndex((q) => q.image_url === p.image_url) === i,
    )
    .slice(0, 5)
  const current = photos[index % Math.max(photos.length, 1)]
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'),
      motion = () => setReduced(media.matches),
      visibility = () => setHidden(document.hidden)
    media.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      media.removeEventListener('change', motion)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  useEffect(() => {
    if (paused || hover || hidden || reduced || photos.length < 2) return
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % photos.length),
      5000,
    )
    return () => clearInterval(timer)
  }, [paused, hover, hidden, reduced, photos.length])
  return (
    <div
      className="hero-image"
      role="region"
      aria-roledescription="carousel"
      aria-label="Catering event photographs"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(false)
      }}
    >
      {current ? (
        <img
          key={current.image_url}
          src={current.image_url}
          alt={current.name}
          onError={() => setBroken((items) => [...items, current.image_url])}
        />
      ) : (
        <div className="hero-photo-unavailable">
          Event photos are currently unavailable.
        </div>
      )}
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
      <div className="hero-carousel-controls">
        {photos.map((photo, i) => (
          <button
            type="button"
            key={photo.image_url}
            aria-label={'Show photo ' + (i + 1) + ': ' + photo.name}
            aria-pressed={index % photos.length === i}
            onClick={() => setIndex(i)}
            className={index % photos.length === i ? 'selected' : ''}
          >
            <span className="sr-only">Photo {i + 1}</span>
          </button>
        ))}
        {!reduced && (
          <button
            type="button"
            className="carousel-pause"
            aria-label={
              paused ? 'Resume photo rotation' : 'Pause photo rotation'
            }
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        )}
      </div>
    </div>
  )
}
