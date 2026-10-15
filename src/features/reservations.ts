import { useQuery } from '@tanstack/react-query'
import { records, supabase, requireConfiguration } from '../lib/supabase'
import type { Reservation, RecordRow } from '../types'
export interface SavedDraft {id:string;data:Record<string,unknown>;wizard_step:number;version:number;reservation_id:string|null;submitted_at:string|null;updated_at:string;created_at:string}
export function useSavedDraft(id?:string) {
  return useQuery({queryKey:['saved-draft',id],enabled:!!id,queryFn:async()=>{const r=await supabase.from('reservation_drafts').select('*').eq('id',id!).single();if(r.error)throw r.error;return r.data as SavedDraft}})
}
export function useSavedDrafts() {
  return useQuery({queryKey:['saved-drafts'],queryFn:()=>records<SavedDraft>('reservation_drafts')})
}
export function useReservations() {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: () => records<Reservation>('reservation_summary'),
  })
}
export function useReservation(id?: string) {
  return useQuery({
    queryKey: ['reservation', id],
    enabled: !!id,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      requireConfiguration()
      const { data: r, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      const tables = [
        'reservation_items',
        'reservation_event_setups',
        'reservation_event_features',
        'reservation_tables_chairs',
        'reservation_add_ons',
      ] as const
      const children = await Promise.all(
        tables.map(async (table) => [
          table,
          await records<RecordRow>(table, 'reservation_id', true, { reservation_id: id }),
        ]),
      )
      return {
        reservation: r as Reservation,
        children: Object.fromEntries(children) as Record<(typeof tables)[number], RecordRow[]>,
      }
    },
  })
}
