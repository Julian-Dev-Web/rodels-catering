import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth'
import { supabase } from '../lib/supabase'
import { menuPhoto, validCatalogImageUrl, type FoodKind } from '../lib/menu-photos'
import type { CatalogItem } from '../types'
import { ErrorState } from './ui'
import { FoodPhoto } from './FoodPhoto'

export function CatalogPhotoEditor({ table, item, close }: { table: FoodKind; item: CatalogItem; close: () => void }) {
  const { profile } = useAuth(), qc = useQueryClient()
  const [url,setUrl] = useState(item.image_url || ''), [credit,setCredit] = useState(item.image_credit || ''), [source,setSource] = useState(item.image_source_url || ''), [file,setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [preview,setPreview] = useState('')
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const mutation = useMutation({ mutationFn: async () => {
    if (url && !validCatalogImageUrl(url.trim())) throw new Error('Use a public HTTPS image URL or an /images/ path.')
    if (source && (!validCatalogImageUrl(source.trim()) || !source.startsWith('https://'))) throw new Error('Use a public HTTPS source link.')
    if (file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10485760 || !file.size)) throw new Error('Choose a JPG, PNG or WebP photo up to 10 MB.')
    let path: string | null = null
    try {
      let image = url.trim() || null
      if (file) {
        path = 'menu/' + crypto.randomUUID() + '.' + file.type.split('/')[1]
        const uploaded = await supabase.storage.from('gallery').upload(path,file)
        if (uploaded.error) throw uploaded.error
        image = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl
      }
      const result = await supabase.from(table).update({ image_url: image, image_credit: image ? credit.trim() || (file ? 'Photo supplied by Rodel’s Catering Services' : '') : '', image_source_url: image && source.trim() ? source.trim() : null }).eq('id',item.id)
      if(result.error) throw result.error
    } catch(error) {
      if(path) await supabase.storage.from('gallery').remove([path])
      throw error
    }
  }, onSuccess: () => { void qc.invalidateQueries();close() } })
  return <form className="catalog-photo-editor" onSubmit={event=>{event.preventDefault();mutation.mutate()}}>
    <p>Choose a photo you have permission to publish. This changes only the menu item’s photo; it does not publish an event-gallery entry.</p>
    {preview ? <img className="catalog-upload-preview" src={preview} alt={'Selected photo for '+item.name}/> : <FoodPhoto item={{ ...item, image_url:url }} kind={table}/>}
    {profile?.role==='super_admin'&&<label>Upload your photo<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={mutation.isPending} onChange={event=>{const selected=event.target.files?.[0]||null;setFile(selected);setPreview(selected&&['image/jpeg','image/png','image/webp'].includes(selected.type)?URL.createObjectURL(selected):'')}} /><small>Up to 10 MB. A selected file replaces the URL below.</small></label>}
    <label>Public photo URL<input type="text" maxLength={2000} value={url} onChange={event=>setUrl(event.target.value)} disabled={mutation.isPending||!!file} placeholder="https://…" /></label>
    <label>Photo credit<input maxLength={500} value={credit} onChange={event=>setCredit(event.target.value)} disabled={mutation.isPending} placeholder="Photographer / owner" /></label>
    <label>Source link · optional<input type="url" maxLength={2000} value={source} onChange={event=>setSource(event.target.value)} disabled={mutation.isPending} /></label>
    {menuPhoto(item.name,table)&&<button type="button" className="text-button" disabled={mutation.isPending} onClick={()=>{setUrl('');setCredit('');setSource('');setFile(null);setPreview('');if(input.current)input.current.value=''}}>Use representative photo instead</button>}
    {mutation.error&&<ErrorState error={mutation.error}/>}
    <div className="actions"><button className="button secondary" type="button" disabled={mutation.isPending} onClick={close}>Cancel</button><button className="button" disabled={mutation.isPending}>{mutation.isPending?'Saving photo…':'Save photo'}</button></div>
  </form>
}
