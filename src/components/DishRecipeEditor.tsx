import { useState } from 'react'
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query'
import { records,rpc } from '../lib/supabase'
import type { CatalogItem } from '../types'
import type { DishRecipe,RecipeIngredient } from '../lib/allergy'
import { ErrorState,Loading } from './ui'
const blank=():RecipeIngredient=>({name:'',aliases:[],allergen_ids:[],component_of:'',source_note:''})
export function DishRecipeEditor({dish,close}:{dish:CatalogItem;close:()=>void}) {
 const query=useQuery({queryKey:['dish-recipe',dish.id],queryFn:()=>rpc<DishRecipe>('dish_recipe',{did:dish.id})})
 if(query.isPending)return <Loading/>
 if(query.error)return <ErrorState error={query.error}/>
 return <RecipeForm key={dish.id+query.data.revision} dish={dish} initial={query.data} close={close}/>
}
function RecipeForm({dish,initial,close}:{dish:CatalogItem;initial:DishRecipe;close:()=>void}) {
 const qc=useQueryClient(),[ingredients,setIngredients]=useState(initial.ingredients),[state,setState]=useState(initial.review_state==='verified'?'verified':'incomplete'),[contacts,setContacts]=useState(initial.cross_contact_allergen_ids),[notes,setNotes]=useState(initial.cross_contact_notes),[confirmed,setConfirmed]=useState(false)
 const allergens=useQuery({queryKey:['allergens'],queryFn:()=>records<{id:string;name:string}>('allergens','name',true)})
 const mutation=useMutation({mutationFn:()=>rpc('save_dish_recipe',{did:dish.id,recipe:ingredients,review_state:state,cross_contacts:contacts,cross_notes:notes,confirm_review:confirmed}),onSuccess:()=>{void qc.invalidateQueries();close();window.dispatchEvent(new CustomEvent('recipe-saved',{detail:dish.name}))}})
 const patch=(index:number,value:Partial<RecipeIngredient>)=>{setIngredients(items=>items.map((item,i)=>i===index?{...item,...value}:item));setConfirmed(false)}
 return <form className="form recipe-editor" onSubmit={e=>{e.preventDefault();mutation.mutate()}}>
  <p>Enter the actual kitchen recipe and product-label information, including sauces, garnishes and known sub-ingredients. Dish names and photos are not recipe evidence. Do not mark an unknown recipe verified.</p>
  {ingredients.length===0&&<p className="allergy-warning">Missing Ingredients: add confirmed recipe information or save as Needs Review. No ingredients have been invented for this dish.</p>}
  {ingredients.map((item,index)=><fieldset className="recipe-ingredient" key={index}><legend>Ingredient {index+1}</legend><label>Actual ingredient / brand<input aria-label={'Ingredient name '+(index+1)} required maxLength={150} minLength={2} value={item.name} onChange={e=>patch(index,{name:e.target.value})}/></label><label>Reliable equivalent names · optional<input aria-label={'Ingredient aliases '+(index+1)} value={item.aliases.join(',')} onChange={e=>patch(index,{aliases:e.target.value.split(',')})}/><small>Use commas. Exact names/aliases support Other allergies; do not add broad or uncertain equivalents.</small></label><label>Part of sauce/mix · optional<input maxLength={150} value={item.component_of} onChange={e=>patch(index,{component_of:e.target.value})}/></label><label>Recipe / product-label evidence · optional<textarea maxLength={500} value={item.source_note} onChange={e=>patch(index,{source_note:e.target.value})}/></label><strong>Confirmed allergens in this ingredient</strong><div className="selection-grid">{allergens.data?.map(a=><label className="consent-check" key={a.id}><input type="checkbox" checked={item.allergen_ids.includes(a.id)} onChange={e=>patch(index,{allergen_ids:e.target.checked?[...item.allergen_ids,a.id]:item.allergen_ids.filter(x=>x!==a.id)})}/>{a.name}</label>)}</div><button type="button" className="text-button" onClick={()=>{setIngredients(items=>items.filter((_,i)=>i!==index));setConfirmed(false)}}>Remove ingredient {index+1}</button></fieldset>)}
  <button type="button" className="button secondary" onClick={()=>{setIngredients(items=>[...items,blank()]);setConfirmed(false)}}>Add ingredient</button>
  <fieldset><legend>Possible cross-contact — separate from ingredients</legend><div className="selection-grid">{allergens.data?.map(a=><label className="consent-check" key={a.id}><input type="checkbox" checked={contacts.includes(a.id)} onChange={e=>{setContacts(e.target.checked?[...contacts,a.id]:contacts.filter(x=>x!==a.id));setConfirmed(false)}}/>{a.name}</label>)}</div><label>Cross-contact / unresolved preparation notes · optional<textarea maxLength={2000} value={notes} onChange={e=>{setNotes(e.target.value);setConfirmed(false)}}/></label></fieldset>
  <label>Ingredient review status<select value={state} onChange={e=>{setState(e.target.value);setConfirmed(false)}}><option value="incomplete">Needs Review</option><option value="verified">Verified</option></select></label>
  {state==='verified'&&<label className="consent-check"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm this is the actual complete recipe, including relevant sauces, garnishes, sub-ingredients and confirmed allergen tags. This does not certify allergen-free preparation.</label>}
  {mutation.error&&<ErrorState error={mutation.error}/>}<button className="button" disabled={mutation.isPending||allergens.isPending||!!allergens.error}>{mutation.isPending?'Saving…':'Save ingredients & allergens'}</button>{allergens.error&&<ErrorState error={allergens.error}/>}
 </form>
}
