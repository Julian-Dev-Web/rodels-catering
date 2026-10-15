import type { CatalogItem } from '../types'
export const eventTypes = [
  { value: 'birthday', label: 'Birthdays' },
  { value: 'wedding', label: 'Weddings' },
  { value: 'school', label: 'School events' },
  { value: 'corporate', label: 'Corporate events' },
  { value: 'gathering', label: 'Gatherings' },
  { value: 'event_setup', label: 'Event setups' },
]
export interface GalleryImage extends CatalogItem {
  image_url: string
  event_type: string
  featured: boolean
  source_url?: string | null
}
export function galleryPlacement(
  images: GalleryImage[],
  placement: 'featured' | 'gallery' | 'all',
) {
  return images.filter(
    (photo) =>
      photo.active &&
      (placement === 'all' ||
        (placement === 'featured' ? photo.featured : !photo.featured)),
  )
}
export const eventLabel = (value: string) =>
  eventTypes.find((type) => type.value === value)?.label || 'Event setups'
export function galleryValues(values: Record<string, unknown>) {
  const name = String(values.name || '').trim(),
    description = String(values.description || '').trim()
  const event_type = String(values.event_type || 'event_setup'),
    source = String(values.source_url || '').trim()
  if (name.length < 2 || name.length > 150)
    throw new Error('Enter a caption between 2 and 150 characters.')
  if (
    description.length > 1500 ||
    !eventTypes.some((type) => type.value === event_type)
  )
    throw new Error('Check the event details.')
  if (source && (source.length > 2000 || !/^https?:\/\//i.test(source)))
    throw new Error('Use an http or https source link.')
  if (source) {
    try {
      new URL(source)
    } catch {
      throw new Error('Enter a valid source link.')
    }
  }
  return {
    name,
    description,
    event_type,
    featured: values.featured === true || values.featured === 'true',
    source_url: source || null,
  }
}
