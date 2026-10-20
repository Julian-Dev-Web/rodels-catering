import { useQuery } from '@tanstack/react-query'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { records, rpc } from '../lib/supabase'
import type { Values } from '../lib/booking-validation'
import type { CatalogItem } from '../types'
import { acknowledgmentFor,hasAllergyDeclaration,requiresAllergyAck,type AllergyWarning } from '../lib/allergy'
import { ErrorState } from './ui'
export { DishRecipeEditor as DishAllergenEditor } from './DishRecipeEditor'
export type { AllergyWarning } from '../lib/allergy'

export function useAllergyWarnings(declared:string[],notes:string,dishes:string[]) {
 return useQuery({queryKey:['allergy-warnings',declared,notes,dishes],queryFn:()=>rpc<AllergyWarning[]>('allergy_warnings',{declared,notes,dish_ids:dishes}),enabled:dishes.length>0&&hasAllergyDeclaration(declared,notes),staleTime:0,refetchInterval:15000,refetchOnMount:'always'})
}
export function AllergyRiskText({warning:w}:{warning:AllergyWarning}) {
 return <>
  {w.matches.length>0&&<p><strong>Contains your declared allergen/ingredient: </strong>{w.matches.map(m=>`${m.allergen} (${m.ingredient}${m.component_of?' in '+m.component_of:''})`).join('; ')}.</p>}
  {w.risk_types.includes('cross_contact')&&<p><strong>Possible cross-contact: </strong>{w.cross_contact_allergens.join(', ')}. {w.cross_contact_notes}</p>}
  {w.risk_types.includes('unresolved_tag')&&<p><strong>Previously recorded possible allergens: </strong>{w.unresolved_tags.join(', ')}. Ingredient evidence still needs staff review.</p>}
  {w.risk_types.includes('incomplete')&&<p><strong>Ingredient data incomplete or not verified.</strong> Sauces, garnishes and compound ingredients may need review.</p>}
  {w.risk_types.includes('custom_unresolved')&&<p><strong>Needs staff verification: </strong>We could not reliably map your Other allergies note ({w.unresolved_custom.join('; ')}). Your exact note is saved for the catering team.</p>}
  {!w.requires_ack&&<p>No declared allergen identified in the reviewed recipe. This does not guarantee allergen-free preparation or absence of cross-contact.</p>}
 </>
}
export function DishAllergyWarning({form,warning:w}:{form:UseFormReturn<Values>;warning:AllergyWarning}) {
 const acks=useWatch({control:form.control,name:'allergy_acknowledgments'}),checked=acks.some(a=>a.token===w.token)
 return <section id={'dish-allergy-'+w.dish_id} className={'allergy-warning dish-allergy-risk '+(w.status==='contains'?'contains':'uncertain')} aria-label={'Allergy information for '+w.dish} data-allergy-unacknowledged={w.requires_ack&&!checked?'true':undefined}>
  <strong>{w.requires_ack?'Allergy warning — ':'Ingredient review — '}{w.dish}</strong><AllergyRiskText warning={w}/>
  {w.requires_ack&&<><label className="consent-check"><input name="allergy_acknowledgments" type="checkbox" checked={checked} onChange={e=>form.setValue('allergy_acknowledgments',e.target.checked?[...acks.filter(a=>a.dish_id!==w.dish_id),acknowledgmentFor(w)]:acks.filter(a=>a.dish_id!==w.dish_id),{shouldDirty:true,shouldValidate:true})}/><span>I understand this dish contains an ingredient related to my declared allergy or has unresolved ingredient/cross-contact risks, and still want to include it in my reservation.</span></label>{!checked&&form.formState.errors.allergy_acknowledgments&&<p className="field-error" role="alert">Acknowledge this warning or deselect this dish before continuing.</p>}</>}
 </section>
}
export function AllergyFields({form,dishes,review=false}:{form:UseFormReturn<Values>;dishes:CatalogItem[];review?:boolean}) {
 const v=useWatch({control:form.control}) as Values
 const allergens=useQuery({queryKey:['allergens'],queryFn:()=>records<{id:string;name:string}>('allergens','name',true)})
 const warnings=useAllergyWarnings(v.allergy_allergen_ids,v.allergy_notes,v.dish_ids)
 const declared=hasAllergyDeclaration(v.allergy_allergen_ids,v.allergy_notes)
 return <section className="allergy-panel" aria-label="Food allergy cautions">
  <h3>Food allergies and ingredient cautions</h3>
  {!review&&<><p>Optional: leave blank if you have no declared allergies. Ingredient information does not guarantee allergen-free preparation.</p><div className="selection-grid">{allergens.data?.map(a=><label className="selection" key={a.id}><input type="checkbox" value={a.id} {...form.register('allergy_allergen_ids')}/><span>{a.name}</span></label>)}</div>{allergens.error&&<ErrorState error={allergens.error}/>}<label>Other allergies / ingredient notes · optional<textarea maxLength={2000} placeholder="e.g. garlic, coriander — use commas between ingredient names" {...form.register('allergy_notes')}/></label>{form.formState.errors.allergy_notes&&<p className="field-error" role="alert">{form.formState.errors.allergy_notes.message}</p>}</>}
  {review&&<p>Declared: {v.allergy_allergen_ids.map(id=>allergens.data?.find(a=>a.id===id)?.name||id).join(', ')||'None declared'}. {v.allergy_notes}</p>}
  {declared&&<p>You may keep this dish after acknowledging the warning. Please contact the catering team to confirm ingredients and cross-contact risks; acknowledgment does not make the dish allergen-free.</p>}
  {warnings.isFetching&&declared&&<p role="status">Checking current ingredients and allergy warnings…</p>}{warnings.error&&<ErrorState error={warnings.error}/>}
  {review? warnings.data?.map(w=><DishAllergyWarning key={w.token} form={form} warning={w}/>): <div className="allergy-selection-summary" aria-live="polite">{warnings.data?.map(w=><div key={w.token}><strong>{w.dish}</strong><AllergyRiskText warning={w}/>{requiresAllergyAck(w)&&<a href={'#dish-allergy-'+w.dish_id}>{v.allergy_acknowledgments.some(a=>a.token===w.token)?'Warning acknowledged':'Review and acknowledge this dish warning'}</a>}</div>)}</div>}
  {!declared&&dishes.some(d=>v.dish_ids.includes(d.id)&&d.ingredient_review_state!=='verified')&&<p>Some selected dishes still need staff ingredient review. An empty ingredient list does not mean allergen-free.</p>}
  {form.formState.errors.allergy_acknowledgments&&<p className="field-error" role="alert">{form.formState.errors.allergy_acknowledgments.message}</p>}
 </section>
}
