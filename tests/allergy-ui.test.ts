import {describe,it,expect,vi} from 'vitest'
vi.mock('../src/lib/supabase',()=>({records:vi.fn(),rpc:vi.fn()}))
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {useForm} from 'react-hook-form'
import {AllergyRiskText,DishAllergyWarning} from '../src/components/AllergyFields'
import {acknowledgmentFor,hasAllergyDeclaration,recipeStatus,type AllergyWarning} from '../src/lib/allergy'
import {bookingStepSchema,type Values} from '../src/lib/booking-validation'
import {restorePersistedDraft} from '../src/lib/booking-draft'
import type {Catalog} from '../src/types'
const warning:AllergyWarning={dish_id:'quail',dish:'Green Peas with Quail Eggs',allergen_id:'dish_risk',token:'recipe-token',recipe_hash:'hash',review_state:'verified',matches:[{allergen_id:'egg',allergen:'Egg',ingredient:'Quail eggs',ingredient_id:'ingredient',component_of:'',kind:'allergen'}],risk_types:['contains'],requires_ack:true,status:'contains',cross_contact_allergens:[],cross_contact_notes:'',unresolved_tags:[],unresolved_custom:[]}
function Checkbox({acknowledged=false}:{acknowledged?:boolean}){const form=useForm<Values>({defaultValues:{allergy_acknowledgments:acknowledged?[acknowledgmentFor(warning)]:[]}});return createElement(DishAllergyWarning,{form,warning})}
describe('accessible dish-specific ingredient warnings',()=>{
 it('renders the quail-egg evidence and an unchecked explicit acknowledgment for that dish',()=>{
  const markup=renderToStaticMarkup(createElement(Checkbox));expect(markup).toContain('Green Peas with Quail Eggs');expect(markup).toContain('Egg (Quail eggs)');expect(markup).toContain('type="checkbox"');expect(markup).toContain('data-allergy-unacknowledged="true"');expect(markup).not.toContain('checked=""');expect(markup).toContain('still want to include it');
  const checked=renderToStaticMarkup(createElement(Checkbox,{acknowledged:true}));expect(checked).toContain('checked=""');expect(checked).not.toContain('data-allergy-unacknowledged="true"');
 })
 it('distinguishes confirmed, cross-contact, incomplete, custom uncertainty and reviewed-no-match text',()=>{
  const uncertain={...warning,matches:[],risk_types:['cross_contact','incomplete','custom_unresolved'],requires_ack:true,cross_contact_allergens:['Egg'],cross_contact_notes:'Shared equipment',unresolved_custom:['unknown sauce']};const text=renderToStaticMarkup(createElement(AllergyRiskText,{warning:uncertain}));expect(text).toContain('Possible cross-contact');expect(text).toContain('not verified');expect(text).toContain('Needs staff verification');expect(text).not.toContain('Contains your declared');
  const reviewed=renderToStaticMarkup(createElement(AllergyRiskText,{warning:{...warning,matches:[],risk_types:[],requires_ack:false,status:'reviewed_no_match'}}));expect(reviewed).toContain('No declared allergen identified');expect(reviewed).toContain('does not guarantee');
 })
 it('preserves bounded acknowledgment metadata in drafts without restoring arbitrary objects',()=>{
  const ack=acknowledgmentFor(warning);const restored=restorePersistedDraft({allergy_acknowledgments:[] as typeof ack[]},{allergy_acknowledgments:[{...ack,untrusted:{accept:true}}]});expect(restored.allergy_acknowledgments).toEqual([ack]);expect(ack.matched_allergens).toEqual(['Egg']);expect(ack.risk_types).toEqual(['contains']);
 })
 it('validates custom-only allergies, blocks missing/stale acknowledgments and permits reviewed-no-match or no declaration',()=>{
  const catalog={menu_sets:[{id:'menu',dish_count:1}],chair_types:[]} as unknown as Catalog;
  const values={menu_set_id:'menu',dish_ids:['quail'],drink_id:'tea',dessert_id:'dessert',allergy_allergen_ids:[],allergy_notes:'garlic',allergy_acknowledgments:[]};const warnings={isFetching:false,error:null,data:[warning]};
  expect(hasAllergyDeclaration([],values.allergy_notes)).toBe(true);expect(bookingStepSchema(1,catalog,warnings).safeParse(values).success).toBe(false);
  expect(bookingStepSchema(1,catalog,warnings).safeParse({...values,allergy_acknowledgments:[acknowledgmentFor(warning)]}).success).toBe(true);
  expect(bookingStepSchema(1,catalog,{isFetching:false,error:null}).safeParse(values).success).toBe(false);
  expect(bookingStepSchema(1,catalog,{...warnings,data:[{...warning,token:'updated'}]}).safeParse({...values,allergy_acknowledgments:[acknowledgmentFor(warning)]}).success).toBe(false);
  expect(bookingStepSchema(1,catalog,{...warnings,data:[{...warning,requires_ack:false}]}).safeParse(values).success).toBe(true);
  expect(bookingStepSchema(1,catalog,{...warnings,isFetching:true}).safeParse({...values,allergy_notes:''}).success).toBe(true);
  expect(recipeStatus('verified',2)).toBe('Verified');expect(recipeStatus('incomplete',1)).toBe('Needs Review');expect(recipeStatus('not_reviewed',0)).toBe('Missing Ingredients');
 })
})
