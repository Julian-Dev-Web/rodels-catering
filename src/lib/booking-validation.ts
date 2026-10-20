import { z } from 'zod'
import type { Catalog } from '../types'
import { earliestEventDate } from './format'
import { validMobile } from './booking'
import { hasAllergyDeclaration,requiresAllergyAck } from './allergy'

const emptyText=(value:unknown)=>value==null?'':value
export const optionalQuantity=(value:unknown)=>value==null||value===''||(typeof value==='number'&&Number.isNaN(value))?0:Number(value)
export const optionalAge=(value:unknown)=>value==null||value===''?null:Number(value)
const text=(max:number)=>z.preprocess(emptyText,z.string().max(max))
const list=z.preprocess(value=>value==null?[]:value,z.array(z.string()))
const quantities=(max:number)=>z.preprocess(value=>value==null?{}:value,z.record(z.string(),z.preprocess(optionalQuantity,z.number().int('Use a whole-number quantity.').min(0,'Quantity cannot be negative.').max(max))))
export const bookingSchema=z.object({
  event_name:z.string().trim().min(2,'Enter an event name with at least 2 characters.').max(150),
  event_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Choose an event date.').refine(v=>Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'Choose a valid calendar date.').refine(v=>v>=earliestEventDate(),'Choose a date at least 3 days ahead for preparation.'),
  event_time:z.string().min(5,'Choose an event time.'),
  guests:z.number('Enter the number of guests.').int('Use a whole guest count.').min(1).max(10000),
  menu_set_id:z.string().min(1,'Choose a package.'),
  drink_id:z.string(),dessert_id:z.string(),setup_id:z.string(),dish_ids:z.array(z.string()),
  allergy_allergen_ids:list,allergy_notes:text(2000),
  allergy_acknowledgments:z.preprocess(v=>v==null?[]:v,z.array(z.object({dish_id:z.string(),allergen_id:z.string(),token:z.string(),matched_allergens:z.array(z.string()).optional(),risk_types:z.array(z.string()).optional(),recipe_hash:z.string().optional(),acknowledged_at:z.string().optional()}))),
  feature_ids:list,table_type_id:z.string(),
  event_preferences:z.object({occasion_type:z.enum(['birthday','wedding','other']),theme:text(200),colors:text(200),celebrant_age:z.preprocess(optionalAge,z.number().int('Enter a whole age.').min(1,'Age must be between 1 and 120.').max(120,'Age must be between 1 and 120.').nullable()),setup_inclusions:list}),
  consent_accepted:z.boolean(),consent_version:z.string(),save_contact:z.preprocess(v=>v==null?false:v,z.boolean()),
  chair_quantities:quantities(10000),chair_type_id:z.string(),
  elegant_chair_quantity:z.preprocess(optionalQuantity,z.number().int().min(0).max(10000)),
  addon_quantities:quantities(1000),
  address:z.object({street:z.string().max(500,'Keep the venue address within 500 characters.'),province:z.string(),city:z.string(),barangay:z.string(),province_code:z.string(),city_code:z.string(),barangay_code:z.string(),contact:z.string(),
    // Kept only to carry historical values; there is no venue-notes input.
    notes:z.string().nullish(),
  }),
})
export type Values=z.output<typeof bookingSchema>
interface Warnings {isFetching:boolean;error:unknown;data?:{token:string;requires_ack?:boolean}[]}
const fields=[
  ['event_name','event_date','event_time','guests','menu_set_id','address','consent_accepted','consent_version'],
  ['dish_ids','drink_id','dessert_id','allergy_allergen_ids','allergy_notes','allergy_acknowledgments'],
  ['setup_id','table_type_id','chair_type_id','elegant_chair_quantity','chair_quantities','addon_quantities','feature_ids','event_preferences'],
] as const
export function bookingFieldStep(path:string) {
  const key=path.split('.')[0]
  return fields.findIndex(group=>(group as readonly string[]).includes(key))
}
export function bookingStepSchema(step:number,catalog:Catalog|undefined,warnings:Warnings) {
  const shape=step===3?bookingSchema:bookingSchema.pick(Object.fromEntries(fields[step].map(key=>[key,true])) as {[K in keyof Values]?:true}).passthrough()
  return shape.superRefine((raw,ctx)=>{
    const v=raw as Values,selected=catalog?.menu_sets.find(p=>p.id===v.menu_set_id)
    const error=(path:string,message:string)=>ctx.addIssue({code:'custom',path:path.split('.'),message})
    if(step===0||step===3){
      if(!v.consent_accepted)error('consent_accepted','Accept the current Terms and Privacy Notice.')
      if(!validMobile(v.address.contact))error('address.contact','Enter a valid Philippine mobile number.')
      for(const key of ['province_code','city_code','barangay_code','street'] as const)if(!v.address[key]?.trim())error('address.'+key,'Complete this event location field.')
      if(!selected)error('menu_set_id','Choose a current set menu.')
      else if(v.guests<(selected.min_guests||1)||v.guests>(selected.max_guests||10000))error('guests',`Choose ${selected.min_guests}–${selected.max_guests||10000} guests.`)
    }
    if(step===1||step===3){
      if(v.dish_ids.length!==selected?.dish_count)error('dish_ids',`Choose exactly ${selected?.dish_count||'the required number of'} dishes.`)
      if(!v.drink_id)error('drink_id','Choose one drink.')
      if(!v.dessert_id)error('dessert_id','Choose one dessert.')
      if(v.dish_ids.length>0&&hasAllergyDeclaration(v.allergy_allergen_ids,v.allergy_notes)&&(warnings.isFetching||warnings.error||warnings.data===undefined||warnings.data.some(w=>requiresAllergyAck(w)&&!v.allergy_acknowledgments.some(a=>a.token===w.token))))error('allergy_acknowledgments','Review and acknowledge each selected dish warning before continuing.')
    }
    if(step===2||step===3){
      if(!v.setup_id)error('setup_id','Choose an event setup.')
      if(!v.table_type_id)error('table_type_id','Choose the table shape.')
      const chair=catalog?.chair_types.find(c=>c.id===v.chair_type_id),upgraded=(chair?.price||0)>0
      if(selected?.pricing_version===2&&!chair)error('chair_type_id','Choose guest seating.')
      if(upgraded&&(!Number.isInteger(v.elegant_chair_quantity)||v.elegant_chair_quantity<1||v.elegant_chair_quantity>v.guests))error('elegant_chair_quantity','Choose a whole chair count from 1 to your guest count.')
      if(upgraded&&v.elegant_chair_quantity<v.guests&&!catalog?.chair_types.some(c=>c.name==='Monoblock'&&c.price===0))error('chair_type_id','Included Monoblock seating is currently unavailable. Contact support.')
      if(selected?.pricing_version!==2&&Object.values(v.chair_quantities).reduce((n,q)=>n+q,0)<v.guests)error('chair_quantities','Choose enough chairs for your guests.')
    }
  })
}
export function bookingPayload(v:Values):Values {
  const address={...v.address}
  if(address.notes==null||address.notes==='')delete address.notes
  return {...v,address}
}
// Validation can reorder object properties between wizard steps. Compare the
// normalized selections, rather than JSON insertion order, when a quote is saved.
export function bookingPayloadKey(v:Values):string {
  const parsed=bookingSchema.safeParse(v)
  const payload=bookingPayload(parsed.success?parsed.data:v)
  return JSON.stringify(payload,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value)
}
