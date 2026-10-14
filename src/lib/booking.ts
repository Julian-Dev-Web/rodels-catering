import directory from '../data/coverage.json'
import type { Catalog } from '../types'
import { birthdayKeys, weddingKeys } from './booking-constants'
export {
  POLICY_VERSION,
  setupItems,
  birthdayKeys,
  weddingKeys,
} from './booking-constants'
export interface EventPreferences {
  occasion_type: 'birthday' | 'wedding' | 'other'
  theme: string
  colors: string
  celebrant_age: number | null
  setup_inclusions: string[]
}
export const defaultPreferences: EventPreferences = {
  occasion_type: 'other',
  theme: '',
  colors: '',
  celebrant_age: null,
  setup_inclusions: [],
}
export const coveragePlaces = (parent: string | null) =>
  directory.filter((place) => place.parent_code === parent)
export {
  normalizeMobile,
  validMobile,
} from '../../supabase/functions/_shared/phone'
export function validateWeddingPrices(prices: Record<string, number>) {
  return (
    Object.keys(prices).length === 6 &&
    weddingKeys.every(
      (key) => Number.isInteger(prices[key]) && prices[key] >= 0,
    ) &&
    Object.values(prices).reduce((s, v) => s + v, 0) === 3000000
  )
}
export function setupSubtotal(
  kind: string | null | undefined,
  selected: string[],
  base: number,
  weddingPrices: Record<string, number> | null,
) {
  const keys =
    kind === 'birthday' ? birthdayKeys : kind === 'wedding' ? weddingKeys : []
  if (
    selected.some((key) => !keys.includes(key)) ||
    new Set(selected).size !== selected.length
  )
    throw new Error('Invalid setup inclusions')
  if (kind === 'birthday') return selected.length * 500000
  if (kind === 'wedding') {
    if (selected.length === 6) return 3000000
    if (!weddingPrices || !validateWeddingPrices(weddingPrices)) return null
    return selected.reduce((sum, key) => sum + weddingPrices[key], 0)
  }
  return base
}
export function estimateBooking(
  catalog: Catalog,
  values: {
    guests: number
    menu_set_id: string
    setup_id: string
    chair_type_id: string
    elegant_chair_quantity?: number
    feature_ids: string[]
    addon_quantities: Record<string, number>
    event_preferences: EventPreferences
  },
  prices: Record<string, number> | null,
) {
  const menu = catalog.menu_sets.find((item) => item.id === values.menu_set_id),
    setup = catalog.event_setups.find((item) => item.id === values.setup_id)
  if (!menu) return null
  const selectedChair=catalog.chair_types.find(item=>item.id===values.chair_type_id),chairCount=values.elegant_chair_quantity??values.guests
  if((selectedChair?.price||0)>0&&(!Number.isInteger(chairCount)||chairCount<1||chairCount>values.guests))return null
  const setupFee = setupSubtotal(
    setup?.setup_kind,
    setup ? values.event_preferences.setup_inclusions : [],
    setup?.price || 0,
    prices,
  )
  if (setupFee === null) return null
  const quote = {
    menu: (menu.price || 0) * values.guests,
    setup: setupFee,
    features: catalog.event_features
      .filter((item) => values.feature_ids.includes(item.id))
      .reduce((sum, item) => sum + (item.price || 0), 0),
    add_ons: catalog.add_ons.reduce(
      (sum, item) =>
        sum + (item.price || 0) * (values.addon_quantities[item.id] || 0),
      0,
    ),
    chair_upgrade:
      (catalog.chair_types.find((item) => item.id === values.chair_type_id)
        ?.price || 0) * (values.elegant_chair_quantity ?? values.guests),
    total: 0,
  }
  quote.total =
    quote.menu +
    quote.setup +
    quote.features +
    quote.add_ons +
    quote.chair_upgrade
  return quote
}
