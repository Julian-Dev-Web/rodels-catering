import { useState } from 'react'
import { CakeSlice, GlassWater, UtensilsCrossed } from 'lucide-react'
import { menuPhoto, validCatalogImageUrl, type FoodKind } from '../lib/menu-photos'
import type { CatalogItem } from '../types'

export function FoodPhoto({ item, kind }: { item: Pick<CatalogItem, 'name' | 'image_url'>; kind: FoodKind }) {
  const [broken, setBroken] = useState<string[]>([])
  const representative = menuPhoto(item.name, kind)
  const custom = item.image_url && validCatalogImageUrl(item.image_url) ? item.image_url : null
  const src = [custom, representative?.path].find(path => path && !broken.includes(path))
  const Icon = kind === 'drinks' ? GlassWater : kind === 'desserts' ? CakeSlice : UtensilsCrossed
  return <span className="food-photo" title={src === custom ? undefined : representative?.note}>
    {src ? <img src={src} alt={item.name + (src === custom ? ' — catalog photo' : ' — representative photo')} loading="lazy" decoding="async" width={500} height={340} onError={() => setBroken(current => [...current, src])} /> : <span className="food-photo-missing"><Icon size={36} aria-hidden="true" /><span>Photo being prepared</span></span>}
    {src && <small className="food-photo-badge">{src === custom ? 'Catalog photo' : 'Representative'}</small>}
  </span>
}
