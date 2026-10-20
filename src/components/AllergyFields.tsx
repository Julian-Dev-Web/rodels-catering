import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { records, rpc } from '../lib/supabase'
import type { Values } from '../pages/ReservationWizard'
import type { CatalogItem } from '../types'
import { ErrorState } from './ui'
export interface AllergyWarning {dish_id:string;dish:string;allergen_id:string;allergen:string;token:string}
export function useAllergyWarnings(declared:string[],notes:string,dishes:string[]) {
  return useQuery({queryKey:['allergy-warnings',declared,notes,dishes],queryFn:()=>rpc<AllergyWarning[]>('allergy_warnings',{declared,notes,dish_ids:dishes}),enabled:dishes.length>0&&declared.length>0})
}
export function AllergyFields({form,dishes,review=false}:{form:UseFormReturn<Values>;dishes:CatalogItem[];review?:boolean}) {
  const v=useWatch({control:form.control}) as Values
  const allergens=useQuery({queryKey:['allergens'],queryFn:()=>records<{id:string;name:string}>('allergens','name',true)})
  const warnings=useAllergyWarnings(v.allergy_allergen_ids,v.allergy_notes,v.dish_ids)
  return <section className="allergy-panel" aria-label="Food allergy cautions"><h3>Food allergies and ingredient cautions</h3>{!review&&<><p>Leave these fields blank if you have no declared allergies. Declare allergies so the catering team can review them. This does not guarantee allergen-free preparation or prevent cross-contact.</p><div className="selection-grid">{allergens.data?.map(a=><label className="selection" key={a.id}><input type="checkbox" value={a.id} {...form.register('allergy_allergen_ids')}/><span>{a.name}</span></label>)}</div><label>Other allergies / ingredient notes · optional<textarea maxLength={2000} {...form.register('allergy_notes')}/></label>{form.formState.errors.allergy_notes&&<p className="field-error" role="alert">{form.formState.errors.allergy_notes.message}</p>}</>}{review&&<p>Declared: {v.allergy_allergen_ids.join(', ')||'None declared'}. {v.allergy_notes}</p>}
    {warnings.isFetching&&v.allergy_allergen_ids.length>0&&<p role="status">Checking current dish allergen information…</p>}{warnings.error&&<ErrorState error={warnings.error}/>}
    {warnings.data?.map(w=><div className="allergy-warning" role="alert" key={w.token}><strong>{w.dish}</strong><p>You indicated a {w.allergen.toLowerCase()} allergy. This selected dish may contain {w.allergen.toLowerCase()}.</p><label><input type="checkbox" checked={v.allergy_acknowledgments.some(a=>a.token===w.token)} onChange={e=>form.setValue('allergy_acknowledgments',e.target.checked?[...v.allergy_acknowledgments.filter(a=>a.dish_id!==w.dish_id||a.allergen_id!==w.allergen_id),w]:v.allergy_acknowledgments.filter(a=>a.token!==w.token),{shouldDirty:true,shouldValidate:true})}/> I understand this dish may contain my declared allergen and want to keep it selected.</label></div>)}
    {dishes.some(d=>v.dish_ids.includes(d.id)&&!d.allergen_info_reviewed)&&<p className="allergy-warning">Allergen information is unavailable or incomplete for some selected dishes. Contact the catering team to confirm ingredients and cross-contact risks. Absence of a recorded allergen does not mean a dish is safe.</p>}
    {form.formState.errors.allergy_acknowledgments&&<p className="field-error" role="alert">{form.formState.errors.allergy_acknowledgments.message}</p>}
  </section>
}
export function DishAllergenEditor({dish,close}:{dish:CatalogItem;close:()=>void}) {
  const qc=useQueryClient(),allergens=useQuery({queryKey:['allergens'],queryFn:()=>records<{id:string;name:string}>('allergens','name',true)})
  const selected=useQuery({queryKey:['dish-allergens',dish.id],queryFn:()=>records<{allergen_id:string}>('dish_allergens','allergen_id',true,{dish_id:dish.id})})
  const mutation=useMutation({mutationFn:(form:HTMLFormElement)=>{const data=new FormData(form);return rpc('configure_dish_allergens',{did:dish.id,allergen_ids:data.getAll('allergens'),reviewed:data.get('reviewed')==='on'})},onSuccess:()=>{void qc.invalidateQueries();close()}})
  if(selected.error||allergens.error)return <ErrorState error={selected.error||allergens.error}/>
  if(!selected.data)return <p>Loading allergen metadata…</p>
  return <form className="form" onSubmit={e=>{e.preventDefault();mutation.mutate(e.currentTarget)}}><p>Record known ingredient allergens. A reviewed list cannot guarantee absence of cross-contact.</p>{allergens.data?.map(a=><label className="consent-check" key={a.id}><input name="allergens" type="checkbox" value={a.id} defaultChecked={selected.data.some(s=>s.allergen_id===a.id)}/>{a.name}</label>)}<label><input name="reviewed" type="checkbox" defaultChecked={dish.allergen_info_reviewed}/> Ingredient information reviewed by the catering team</label>{mutation.error&&<ErrorState error={mutation.error}/>}<button className="button" disabled={mutation.isPending}>Save allergen information</button></form>
}
