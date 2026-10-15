import manifest from '../data/menu-photo-manifest.json'
export type FoodKind = 'dishes' | 'drinks' | 'desserts'
export interface MenuPhoto {
  name: string
  kind: FoodKind
  path: string
  author: string
  license: string
  licenseUrl: string
  sourceUrl: string
  sourceTitle: string
  note: string
}
export const menuPhotos = manifest as MenuPhoto[]
export const normalizeFoodName = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export function menuPhoto(name: string, kind: FoodKind) {
  return menuPhotos.find(photo => photo.kind === kind && normalizeFoodName(photo.name) === normalizeFoodName(name))
}
export function isFoodKind(value: string): value is FoodKind {
  return ['dishes', 'drinks', 'desserts'].includes(value)
}
export function validCatalogImageUrl(value: string) {
  if (/^\/images\/[a-z0-9_./-]+$/i.test(value) && !value.includes('..')) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !/\s/.test(value) } catch { return false }
}
