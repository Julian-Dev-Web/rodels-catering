import { useQuery } from '@tanstack/react-query'
import { configured, records } from '../lib/supabase'
import type { Catalog, CatalogItem, CatalogTable } from '../types'
import { sampleCatalog } from '../data/catalog'
import { useAuth } from './auth'
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
export function useCatalog({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['catalog', includeArchived ? 'history' : 'active', profile?.id || 'public'],
    queryFn: async () => {
      if (!configured) return sampleCatalog
      const entries = await Promise.all(
        catalogTables.map(async (t) => [
          t,
          await records<CatalogItem>(t, 'name', true, includeArchived ? {} : { active: true }),
        ]),
      )
      return Object.fromEntries(entries) as Catalog
    },
    staleTime: 60000,
  })
}
