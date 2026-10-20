import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {bookingStepSchema,bookingPayload,bookingFieldStep,type Values} from '../src/lib/booking-validation'
import {FinancialBreakdown} from '../src/components/FinancialBreakdown'
import {financialQuote,bookingFinancialRows,bookingPriceLines,financialRows} from '../src/lib/financial'
import type {Catalog} from '../src/types'
const catalog:Catalog={menu_sets:[{id:'menu',name:'Set',dish_count:3,min_guests:100,max_guests:1000,pricing_version:2}],chair_types:[{id:'normal',name:'Monoblock',price:0},{id:'upgrade',name:'Elegant chair',price:1000}],menu_categories:[],dishes:[],drinks:[],desserts:[],event_setups:[],event_features:[],add_ons:[],table_types:[],gallery_images:[]}
const warnings={isFetching:false,error:null,data:[]}
const input=()=>({event_name:'Booking fixture',event_date:'2099-12-20',event_time:'12:00',guests:100,menu_set_id:'menu',dish_ids:['a','b','c'],drink_id:'tea',dessert_id:'dessert',setup_id:'buffet',table_type_id:'round',chair_type_id:'normal',chair_quantities:{},elegant_chair_quantity:0,addon_quantities:{},feature_ids:[],allergy_allergen_ids:[],allergy_notes:'',allergy_acknowledgments:[],event_preferences:{occasion_type:'birthday',theme:'',colors:'',celebrant_age:null,setup_inclusions:[]},consent_accepted:true,consent_version:'2026-10-15-v1',save_contact:false,address:{street:'Venue',province:'Bulacan',province_code:'p',city:'San Ildefonso',city_code:'c',barangay:'Test',barangay_code:'b',contact:'09123456789'}})
describe('booking optional fields and step validation',()=>{
 it('accepts all optional inputs blank/null/omitted and requires no venue notes',()=>{
  for(const step of[0,1,2,3])expect(bookingStepSchema(step,catalog,warnings).safeParse(input()).success).toBe(true)
  const v=input();Object.assign(v,{allergy_notes:null,feature_ids:null,allergy_allergen_ids:null,allergy_acknowledgments:null,addon_quantities:{blank:'',unset:null}});Object.assign(v.event_preferences,{theme:null,colors:null,celebrant_age:''})
  const parsed=bookingStepSchema(3,catalog,warnings).parse(v) as Values
  expect(parsed).toMatchObject({allergy_notes:'',feature_ids:[],allergy_allergen_ids:[],addon_quantities:{blank:0,unset:0},event_preferences:{theme:'',colors:'',celebrant_age:null}})
 })
 it('validates only the visible step and keeps other input for later validation',()=>{
  const v=input();Object.assign(v,{dish_ids:[],drink_id:'',dessert_id:'',setup_id:'',addon_quantities:{wrong:-1},event_preferences:{occasion_type:'birthday',theme:'x'.repeat(201),colors:'',celebrant_age:null,setup_inclusions:[]}})
  expect(bookingStepSchema(0,catalog,warnings).safeParse(v).success).toBe(true)
  const menu=bookingStepSchema(1,catalog,warnings).safeParse(v);expect(menu.success).toBe(false);if(!menu.success)expect(menu.error.issues.every(e=>['dish_ids','drink_id','dessert_id'].includes(String(e.path[0])))).toBe(true)
  expect(bookingStepSchema(2,catalog,warnings).safeParse(v).success).toBe(false)
  expect(bookingStepSchema(3,catalog,warnings).safeParse(v).success).toBe(false)
 })
 it('validates provided optional values and conditional upgrades, while accepting unselected add-ons',()=>{
  for(const n of[-1,1.5,1001,Infinity])expect(bookingStepSchema(2,catalog,warnings).safeParse({...input(),addon_quantities:{chosen:n}}).success).toBe(false)
  for(const age of[0,1.5,121,'bad'])expect(bookingStepSchema(2,catalog,warnings).safeParse({...input(),event_preferences:{...input().event_preferences,celebrant_age:age}}).success).toBe(false)
  expect(bookingStepSchema(2,catalog,warnings).safeParse({...input(),chair_type_id:'upgrade',elegant_chair_quantity:0}).success).toBe(false)
  expect(bookingStepSchema(2,catalog,warnings).safeParse({...input(),chair_type_id:'upgrade',elegant_chair_quantity:100}).success).toBe(true)
  expect(bookingStepSchema(2,catalog,warnings).safeParse({...input(),addon_quantities:{empty:NaN}}).success).toBe(true)
 })
 it('requires a valid selected contact, location, guests, consent and menu choices',()=>{
  const v=input();for(const contact of['','0912','00000000000'])expect(bookingStepSchema(0,catalog,warnings).safeParse({...v,address:{...v.address,contact}}).success).toBe(false)
  for(const contact of['09123456789','639123456789','+639123456789'])expect(bookingStepSchema(0,catalog,warnings).safeParse({...v,address:{...v.address,contact},save_contact:false}).success).toBe(true)
  for(const guests of[99,1001])expect(bookingStepSchema(0,catalog,warnings).safeParse({...v,guests}).success).toBe(false)
  expect(bookingStepSchema(0,catalog,warnings).safeParse({...v,consent_accepted:false}).success).toBe(false)
  expect(bookingStepSchema(0,catalog,warnings).safeParse({...v,event_date:'2099-02-30'}).success).toBe(false)
  expect(bookingStepSchema(0,catalog,warnings).safeParse({...v,address:{...v.address,street:''}}).success).toBe(false)
  expect(bookingStepSchema(1,catalog,warnings).safeParse({...v,dish_ids:['a','b']}).success).toBe(false)
 })
 it('allows no allergies and requires acknowledgment only for a declared conflict',()=>{
  const waiting={isFetching:true,error:null,data:[{token:'conflict'}]}
  expect(bookingStepSchema(1,catalog,waiting).safeParse(input()).success).toBe(true)
  const v={...input(),allergy_allergen_ids:['seafood']}
  expect(bookingStepSchema(1,catalog,{...waiting,isFetching:false}).safeParse(v).success).toBe(false)
  expect(bookingStepSchema(1,catalog,{...waiting,isFetching:false}).safeParse({...v,allergy_acknowledgments:[{dish_id:'a',allergen_id:'seafood',token:'conflict'}]}).success).toBe(true)
 })
 it('preserves voluntarily entered preferences and historical notes, omitting notes from new payloads',()=>{
  const v=bookingStepSchema(3,catalog,warnings).parse(input()) as Values
  expect(bookingPayload(v).address).not.toHaveProperty('notes')
  const older={...v,address:{...v.address,notes:'Saved historical venue information'}}
  expect(bookingPayload(older).address.notes).toBe(older.address.notes)
  expect(bookingFieldStep('addon_quantities.fixture')).toBe(2);expect(bookingFieldStep('address.contact')).toBe(0)
 })
})
describe('readable booking financial summary',()=>{
 it('uses the same discount, VAT, deposit and balance amounts as documents',()=>{
  const f=financialQuote(11201,{kind:'percentage',value:1000,source:'account'},{mode:'vat_inclusive',rate_bps:1200,business_confirmed:false})
  const rows=bookingFinancialRows(f,f.total,1000)
  expect(rows).toContainEqual(['Customer discount (10%)',-1120]);expect(rows).toContainEqual(['VAT (12% included)',1080]);expect(rows).toContainEqual(['50% down payment',5041]);expect(rows).toContainEqual(['Remaining balance',9081])
  expect(rows).not.toContainEqual(['Tax status','Illustrative tax breakdown; business/accounting confirmation pending'])
  const compact=renderToStaticMarkup(FinancialBreakdown({snapshot:f,total:f.total,booking:true})),document=renderToStaticMarkup(FinancialBreakdown({snapshot:f,total:f.total}))
  expect(compact).not.toContain('not an official BIR tax invoice');expect(document).toContain('not an official BIR tax invoice');expect(financialRows(f,f.total).some(([key])=>key==='Tax status')).toBe(true)
 })
 it('keeps meaningful price labels and included setup without redundant zero extras or invented VAT',()=>{
  expect(bookingPriceLines({menu:3200000,setup:0,features:0,add_ons:0,guest_chair_upgrade:10000,total:3210000})).toEqual([{key:'menu',label:'Menu / catering package',amount:3200000},{key:'setup',label:'Event setup',amount:0},{key:'guest_chair_upgrade',label:'Chair upgrades',amount:10000}])
  expect(bookingFinancialRows(null,10001,5001)).toContainEqual(['Remaining balance',5000])
  const f=financialQuote(10001,null,{mode:'non_vat',rate_bps:0,business_confirmed:true});expect(bookingFinancialRows(f,f.total).some(([key])=>key.startsWith('VAT'))).toBe(false)
 })
})
