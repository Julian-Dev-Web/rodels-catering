import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Expand } from 'lucide-react'
import { configured } from '../lib/supabase'
import {
  eventLabel,
  eventTypes,
  galleryPlacement,
  type GalleryImage,
} from '../lib/gallery'
import { usePublicGallery } from '../features/gallery'
import { Empty, ErrorState, Loading, Modal } from './ui'

const preview: GalleryImage[] = [
  {
    id: 'birthday',
    name: 'Floral birthday celebration setup',
    image_url: '/images/celebration.jpg',
    event_type: 'birthday',
    featured: true,
    active: true,
  },
  {
    id: 'setup',
    name: 'Green and ivory event setup',
    image_url: '/images/table.jpg',
    event_type: 'event_setup',
    featured: true,
    active: true,
  },
  {
    id: 'school',
    name: 'School recognition ceremony setup',
    image_url: '/images/food.jpg',
    event_type: 'school',
    featured: true,
    active: true,
  },
  {
    id: 'outdoor',
    name: 'Outdoor evening celebration',
    image_url: '/images/facebook-showcase.jpg',
    event_type: 'gathering',
    featured: true,
    active: true,
  },
]
export function EventShowcase({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = useState('all'),
    [selected, setSelected] = useState<string | null>(null)
  const query = usePublicGallery()
  const photos = configured ? query.data || [] : preview
  const displayed = galleryPlacement(photos, compact ? 'gallery' : 'all')
    .filter((photo) => category === 'all' || photo.event_type === category)
    .slice(0, compact ? 3 : undefined)
  const current = displayed.findIndex((photo) => photo.id === selected),
    photo = displayed[current]
  if (configured && query.isPending) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
  if (compact && !displayed.length) return null
  return (
    <>
      {compact && (
        <div className="section-heading">
          <div>
            <span className="eyebrow">FROM RODEL’S EVENT GALLERY</span>
            <h2>Details that bring people together.</h2>
          </div>
          <Link className="text-button" to="/gallery">
            See all celebrations <ArrowRight size={17} />
          </Link>
        </div>
      )}
      {!compact && (
        <div className="gallery-filters" aria-label="Filter event photos">
          <button
            className={
              'gallery-filter ' + (category === 'all' ? 'selected' : '')
            }
            aria-pressed={category === 'all'}
            onClick={() => {
              setCategory('all')
              setSelected(null)
            }}
          >
            All celebrations <span>{photos.length}</span>
          </button>
          {eventTypes
            .filter((type) => photos.some((p) => p.event_type === type.value))
            .map((type) => (
              <button
                className={
                  'gallery-filter ' +
                  (category === type.value ? 'selected' : '')
                }
                key={type.value}
                aria-pressed={category === type.value}
                onClick={() => {
                  setCategory(type.value)
                  setSelected(null)
                }}
              >
                {type.label}{' '}
                <span>
                  {photos.filter((p) => p.event_type === type.value).length}
                </span>
              </button>
            ))}
        </div>
      )}
      {displayed.length ? (
        <div className="gallery-grid showcase-grid">
          {displayed.map((item) => (
            <article className="showcase-card" key={item.id}>
              <button
                className="showcase-photo"
                aria-label={'View photo: ' + item.name}
                onClick={() => setSelected(item.id)}
              >
                <img src={item.image_url} alt={item.name} loading="lazy" />
                <span className="photo-expand">
                  <Expand size={17} /> View photo
                </span>
              </button>
              <div className="showcase-caption">
                <span className="eyebrow">{eventLabel(item.event_type)}</span>
                <h3>{item.name}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Our gallery is being prepared">
          Published event photos will appear here.
        </Empty>
      )}
      {photo && (
        <Modal title={photo.name} close={() => setSelected(null)}>
          <img
            className="lightbox-photo"
            src={photo.image_url}
            alt={photo.name}
          />
          <p>{photo.description}</p>
          {photo.source_url && /^https?:\/\//i.test(photo.source_url) && (
            <a
              className="text-button"
              href={photo.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Visit photo source ↗
            </a>
          )}
          <div className="lightbox-controls">
            <button
              className="button secondary small"
              disabled={displayed.length < 2}
              aria-label="Previous photo"
              onClick={() =>
                setSelected(
                  displayed[(current - 1 + displayed.length) % displayed.length]
                    .id,
                )
              }
            >
              <ArrowLeft size={17} />
              Previous
            </button>
            <span>
              {current + 1} / {displayed.length}
            </span>
            <button
              className="button secondary small"
              disabled={displayed.length < 2}
              aria-label="Next photo"
              onClick={() =>
                setSelected(displayed[(current + 1) % displayed.length].id)
              }
            >
              Next
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
