import { describe, expect, it } from 'vitest'
import { galleryPlacement, type GalleryImage } from '../src/lib/gallery'
import { assistantSubject } from '../supabase/functions/_shared/assistant-quota'

const photos: GalleryImage[] = [
  {
    id: 'featured',
    name: 'Featured event',
    image_url: '/featured.jpg',
    active: true,
    featured: true,
    event_type: 'birthday',
  },
  {
    id: 'gallery',
    name: 'Gallery event',
    image_url: '/gallery.jpg',
    active: true,
    featured: false,
    event_type: 'birthday',
  },
  {
    id: 'hidden',
    name: 'Unpublished event',
    image_url: '/hidden.jpg',
    active: false,
    featured: true,
    event_type: 'birthday',
  },
]
describe('published gallery placement', () => {
  it('keeps gallery-only entries out of the hero and featured entries out of the landing gallery preview', () => {
    expect(galleryPlacement(photos, 'featured').map((p) => p.id)).toEqual([
      'featured',
    ])
    expect(galleryPlacement(photos, 'gallery').map((p) => p.id)).toEqual([
      'gallery',
    ])
    expect(galleryPlacement(photos, 'all').map((p) => p.id)).toEqual([
      'featured',
      'gallery',
    ])
  })
  it('reflects placement, deletion and unpublish changes without reinstating fixed photos or limiting featured slots to five', () => {
    expect(
      galleryPlacement(
        photos.map((p) => ({ ...p, featured: false })),
        'featured',
      ),
    ).toEqual([])
    expect(galleryPlacement([], 'all')).toEqual([])
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...photos[0],
      id: String(i),
      image_url: '/photo-' + i + '.jpg',
    }))
    expect(galleryPlacement(many, 'featured')).toHaveLength(8)
    expect(
      galleryPlacement(
        many.map((p) => ({ ...p, active: false })),
        'featured',
      ),
    ).toEqual([])
  })
})
describe('assistant quota identifiers', () => {
  it('uses stable keyed hashes without storing a raw network or account identifier', async () => {
    const first = await assistantSubject('guest:192.0.2.1', 'fixture-key')
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).toBe(await assistantSubject('guest:192.0.2.1', 'fixture-key'))
    expect(first).not.toBe(
      await assistantSubject('member:192.0.2.1', 'fixture-key'),
    )
    expect(first).not.toBe(
      await assistantSubject('guest:192.0.2.1', 'other-fixture-key'),
    )
  })
})
