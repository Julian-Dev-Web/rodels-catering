import type { Catalog, CatalogItem } from '../types'
import { rodelsMenus, rodelsFoods, rodelsDrinks, rodelsDesserts, rodelsSetups, rodelsChairs, rodelsTables } from './rodels-menu'
const item = (id: string, name: string, price = 0): CatalogItem => ({
  id,
  name,
  price,
  active: true,
})
export const sampleCatalog: Catalog = {
  menu_sets: rodelsMenus.map((menu, index) => ({ ...item('preview-menu-' + index, menu.name, menu.price), ...menu })),
  menu_categories: Object.keys(rodelsFoods).map((name, index) => item('preview-category-' + index, name)),
  dishes: Object.entries(rodelsFoods).flatMap(([, names], category) => names.map((name, index) => ({ ...item(`preview-dish-${category}-${index}`, name), category_id: 'preview-category-' + category }))),
  drinks: rodelsDrinks.map((name, index) => item('preview-drink-' + index, name)),
  desserts: rodelsDesserts.map((name, index) => item('preview-dessert-' + index, name)),
  add_ons: [],
  event_setups: rodelsSetups.map((setup, index) => ({ ...item('preview-setup-' + index, setup.name, setup.price), ...setup })),
  event_features: [item('preview-feature-glass', 'Glass dance floor upgrade', 500000), item('preview-feature-trusses', 'Trusses', 4500000)],
  chair_types: rodelsChairs.map((chair, index) => item('preview-chair-' + index, chair.name, chair.price)),
  table_types: rodelsTables.map((table, index) => item('preview-table-' + index, table.name, table.price)),
}
