import { useQuery } from '@tanstack/react-query'
import { configured, records } from '../lib/supabase'
import type { Catalog, CatalogItem, CatalogTable } from '../types'
import { sampleCatalog } from '../data/catalog'
export const catalogTables: CatalogTable[] = [
  'menu_sets',
  'menu_categories',
  'dishes',
  'drinks',
  'desserts',
  'add_ons',
  'event_setups',
  'event_features',
  'chair_types',
  'table_types',
]
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      if (!configured) return sampleCatalog
      const entries = await Promise.all(
        catalogTables.map(async (t) => [
          t,
          await records<CatalogItem>(t, 'name', true, { active: true }),
        ]),
      )
      return Object.fromEntries(entries) as Catalog
    },
    staleTime: 60000,
  })
}
