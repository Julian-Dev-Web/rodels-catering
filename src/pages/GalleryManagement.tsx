import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { records, supabase } from '../lib/supabase'
import { eventLabel, eventTypes, galleryValues } from '../lib/gallery'
import type { RecordRow } from '../types'
import { Action, Badge, DataTable, ErrorState, Loading, Modal, PageHeading } from '../components/ui'
import { Form } from '../components/Form'

export function GalleryManagement() {
  const [editing, setEditing] = useState<RecordRow | null>(null)
  const [files, setFiles] = useState<File[]>([]), [caption, setCaption] = useState(''), [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('event_setup'), [featured, setFeatured] = useState(true), [source, setSource] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['manage-gallery'], queryFn: () => records<RecordRow>('gallery_images') })
  const upload = useMutation({ mutationFn: async () => {
    const metadata = galleryValues({ name:caption, description, event_type:eventType, featured, source_url:source })
    if (!files.length || files.length > 12) throw new Error('Choose between 1 and 12 photos.')
    if (files.some((file) => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10485760 || !file.size)) throw new Error('Each photo must be a JPG, PNG or WebP up to 10 MB.')
    const paths: string[] = []
    try {
      const entries = []
      for (const [i, file] of files.entries()) {
        const path = `events/${crypto.randomUUID()}.${file.type.split('/')[1]}`
        const { error } = await supabase.storage.from('gallery').upload(path, file)
        if (error) throw error
        paths.push(path)
        entries.push({ ...metadata, name: files.length > 1 ? `${metadata.name.slice(0,135)} · Photo ${i + 1}` : metadata.name, image_url: supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl })
      }
      // One database insert: publish all selected photos together.
      const { error } = await supabase.from('gallery_images').insert(entries)
      if (error) throw error
    } catch (error) {
      if (paths.length) {
        const { error: cleanupError } = await supabase.storage.from('gallery').remove(paths)
        if (cleanupError) throw new Error('Upload failed. Some unused photos remain in Storage; an operator can remove them there.')
      }
      throw error
    }
    return files.length
  }, onSuccess: () => { void qc.invalidateQueries(); setFiles([]); setCaption(''); setDescription(''); setSource(''); if (fileInput.current) fileInput.current.value = '' } })
  return <>
    <PageHeading eyebrow="SUPER ADMIN · WEBSITE CONTENT" title="Showcase your celebrations.">Add real event photos, organize them by occasion and choose what appears on the landing page.</PageHeading>
    <section className="panel upload-panel"><h2>Add event photos</h2><p>Publish photographs you have permission to share. Use captions that describe the actual event or visible setup.</p>
      <label>Caption<input maxLength={150} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={upload.isPending} /></label>
      <div className="gallery-form-grid"><label>Occasion<select value={eventType} onChange={(e) => setEventType(e.target.value)} disabled={upload.isPending}>{eventTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Photo source link · optional<input type="url" maxLength={2000} placeholder="https://…" value={source} onChange={(e) => setSource(e.target.value)} disabled={upload.isPending} /></label></div>
      <label>Description · optional<textarea maxLength={1500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={upload.isPending} /></label>
      <label>Photos · up to 12, each up to 10 MB<input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles(Array.from(e.target.files || []))} disabled={upload.isPending} /></label>
      <label className="gallery-check"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={upload.isPending} />Feature in the 5-second landing slideshow</label>
      <p className="date-help">Featured photos appear in the slideshow. Gallery-only photos appear in the landing gallery preview (latest three). All published photos appear on the full Gallery page. Open visitor pages refresh within five seconds.</p>
      <button className="button" disabled={upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? 'Uploading photos…' : 'Publish event photos'}</button>
      {upload.error && <ErrorState error={upload.error} />}{upload.isSuccess && <p className="success-inline" role="status">{upload.data} photo(s) published.</p>}
    </section>
    {query.isPending ? <Loading /> : query.error ? <ErrorState error={query.error} /> : <DataTable rows={query.data} columns={[
      {key:'image_url',label:'Photo',render:(r) => <img className="table-thumbnail" src={String(r.image_url)} alt={String(r.name)} />},
      {key:'name',label:'Caption'}, {key:'event_type',label:'Occasion',render:(r) => eventLabel(String(r.event_type))},
      {key:'featured',label:'Showcase',render:(r) => r.featured ? 'Featured' : 'Gallery only'},
      {key:'active',label:'Visibility',render:(r) => <Badge value={r.active ? 'active' : 'archived'} />},
    ]} actions={(r) => <><button className="text-button" onClick={() => setEditing(r)}>Edit details</button><Action label={r.active ? 'Unpublish' : 'Publish'} kind="small secondary" run={async () => { const { error } = await supabase.from('gallery_images').update({active:!r.active}).eq('id',r.id); if (error) throw error }} /><Action label="Delete" kind="small secondary" confirm="Delete this gallery entry? The photo remains in Storage for operator recovery." run={async () => { const {error} = await supabase.from('gallery_images').delete().eq('id',r.id); if (error) throw error }} /></>} />}
    {editing && <Modal title="Edit event details" close={() => setEditing(null)}><Form fields={[
      {name:'name',label:'Caption',required:true,max:150}, {name:'event_type',label:'Occasion',required:true,options:eventTypes},
      {name:'description',label:'Description',type:'textarea',max:1500}, {name:'source_url',label:'Photo source link',type:'url',max:2000},
      {name:'featured',label:'Landing placement',required:true,options:[{label:'Featured — slideshow',value:'true'},{label:'Gallery only — gallery preview',value:'false'}]},
    ]} initial={{name:String(editing.name),event_type:String(editing.event_type),description:String(editing.description || ''),source_url:String(editing.source_url || ''),featured:String(editing.featured)}} submit={async (values) => { const {error} = await supabase.from('gallery_images').update(galleryValues(values)).eq('id',editing.id); if (error) throw error }} onSuccess={() => setEditing(null)} /></Modal>}
  </>
}
