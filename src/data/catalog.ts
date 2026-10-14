import type { Catalog, CatalogItem } from '../types'
const item = (id: string, name: string, price = 0): CatalogItem => ({
  id,
  name,
  price,
  active: true,
})
export const sampleCatalog: Catalog = {
  menu_sets: [
    {
      ...item('10000000-0000-0000-0000-000000000001', 'Classic Gathering', 35000),
      dish_count: 3,
      min_guests: 30,
      description: 'Comforting favorites for intimate celebrations.',
    },
    {
      ...item('10000000-0000-0000-0000-000000000002', 'Signature Celebration', 55000),
      dish_count: 5,
      min_guests: 50,
      description: 'A generous spread for your most meaningful moments.',
    },
    {
      ...item('10000000-0000-0000-0000-000000000003', 'Grand Occasion', 75000),
      dish_count: 7,
      min_guests: 80,
      description: 'An abundant feast, beautifully presented.',
    },
  ],
  menu_categories: [],
  dishes: [],
  drinks: [],
  desserts: [],
  add_ons: [],
  event_setups: [],
  event_features: [],
  chair_types: [],
  table_types: [],
}
