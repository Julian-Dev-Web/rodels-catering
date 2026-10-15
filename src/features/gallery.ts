import { useQuery } from '@tanstack/react-query'
import { configured, records } from '../lib/supabase'
import type { GalleryImage } from '../lib/gallery'

export function usePublicGallery() {
  return useQuery({
    queryKey: ['gallery'],
    enabled: configured,
    queryFn: () =>
      records<GalleryImage>('gallery_images', 'created_at', false, {
        active: true,
      }),
    // Also refresh an already-open visitor tab after content is changed elsewhere.
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })
}
