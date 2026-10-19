import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useReservations } from '../features/reservations'
import { records, rpc } from '../lib/supabase'
import { date, todayManila } from '../lib/format'
import { stockQuantity } from '../lib/manager-input'
import { DataTable, ErrorState, Loading, Modal, PageHeading } from '../components/ui'
import { FeedbackNotice } from '../components/FeedbackNotice'
import type { EquipmentAvailabilityRow } from '../components/EquipmentAvailability'
import type { RecordRow } from '../types'
interface Equipment {id:string;name:string;code:string;usable_quantity:number|null;active:boolean}
interface StockResult {equipment_name:string;adjustment:string;quantity:number;total:number}
export function EquipmentManagement() {
  const qc=useQueryClient(),[day,setDay]=useState(todayManila()),bookings=useReservations()
  const inventory=useQuery({queryKey:['equipment-inventory'],queryFn:()=>records<Equipment>('equipment_inventory','name',true)})
  const availability=useQuery({queryKey:['equipment-availability',day],queryFn:()=>rpc<EquipmentAvailabilityRow[]>('equipment_availability',{day}),enabled:!!day,refetchInterval:15000})
  const allocations=useQuery({queryKey:['equipment-allocations',day],queryFn:()=>records<RecordRow>('equipment_allocations','event_date',true,{event_date:day}),enabled:!!day})
  const [action,setAction]=useState<{item:Equipment;kind:'add'|'remove'|'initial'|'availability';operation:string}|null>(null)
  const [quantity,setQuantity]=useState(''),[note,setNote]=useState(''),[notice,setNotice]=useState<{text:string;error?:boolean}|null>(null)
  const mutation=useMutation({
    mutationFn:async()=>{
      if(!action)throw Error('Choose equipment first.')
      if(action.kind==='availability')return rpc<StockResult>('set_equipment_active',{eid:action.item.id,is_active:!action.item.active})
      const amount=stockQuantity(quantity,action.kind==='initial')
      if(action.kind==='initial'){
        return rpc<StockResult>('confirm_equipment_stock',{eid:action.item.id,quantity:amount})
      }
      return rpc<StockResult>('adjust_equipment_stock',{eid:action.item.id,adjustment:action.kind,quantity:amount,note,operation_id:action.operation})
    },
    onSuccess:result=>{const name=result.equipment_name.replace(/Chair$/,'Chairs');setNotice({text:['paused','resumed'].includes(result.adjustment)?`${name} ${result.adjustment} for new allocations. Physical stock and saved bookings are unchanged.`:result.adjustment==='initial'?`${name} starting stock confirmed: ${result.total.toLocaleString()}.`: `Successfully ${result.adjustment==='add'?'added':'removed'} ${result.quantity.toLocaleString()} ${name}. Total usable stock: ${result.total.toLocaleString()}.`});setAction(null);void qc.invalidateQueries()},
    onError:error=>setNotice({text:error instanceof Error?error.message:'Could not update stock. Please try again.',error:true}),
  })
  function open(item:Equipment,kind:'add'|'remove'|'initial'|'availability'){setQuantity('');setNote('');mutation.reset();setAction({item,kind,operation:crypto.randomUUID()})}
  return <>
    <PageHeading title="Chair inventory." eyebrow="MANAGER · PHYSICAL STOCK">Manage usable Elegant Chairs and Monoblock Chairs. Reservations share stock for the whole event date. Drafts and pending requests do not hold chairs; approval checks availability again.</PageHeading>
    {notice&&<FeedbackNotice {...notice} close={()=>setNotice(null)}/>}
    <label>Availability for event date<input type="date" required value={day} onChange={e=>setDay(e.target.value)}/></label>
    {(inventory.error||availability.error)&&<ErrorState error={inventory.error||availability.error}/>}
    {inventory.isPending?<Loading/>:<div className="inventory-grid">{inventory.data?.map(item=>{
      const stock=availability.data?.find(a=>a.equipment_id===item.id)
      return <section className="panel form" key={item.id} aria-label={item.name+' physical stock'}>
        <h2>{item.name.replace(/Chair$/,'Chairs')}</h2>
        <dl className="detail-list"><dt>Total usable physical stock</dt><dd>{item.usable_quantity===null?'Needs confirmation':item.usable_quantity.toLocaleString()}</dd><dt>Allocated on {day?date(day):'selected date'}</dt><dd>{stock?.allocated??'Checking…'}</dd><dt>Available on this date</dt><dd>{stock?.available??'Not confirmed'}</dd></dl>
        {item.usable_quantity===null&&<p className="date-help">Confirm the actual starting count with the catering team. No sample inventory has been entered. New bookings using these chairs require confirmed stock.</p>}
        {stock?.overcommitted&&<p className="field-error" role="alert">Existing commitments exceed recorded stock. Resolve the shortage with the catering team; saved bookings remain unchanged.</p>}
        {!item.active&&<p className="date-help">Unavailable for new allocations.</p>}
        <div className="actions">{item.usable_quantity===null?<button className="button secondary" onClick={()=>open(item,'initial')}>Confirm starting stock</button>:<><button className="button secondary" onClick={()=>open(item,'add')}>Add Stock</button><button className="button secondary" onClick={()=>open(item,'remove')}>Remove Stock</button></>}<button className="text-button" onClick={()=>open(item,'availability')}>{item.active?'Pause new allocations':'Resume new allocations'}</button></div>
      </section>
    })}</div>}
    <h2>Bookings using stock on this date</h2>{allocations.error&&<ErrorState error={allocations.error}/>}
    <DataTable rows={(allocations.data||[]).map(a=>{const b=bookings.data?.find(b=>b.id===a.reservation_id);return {...a,id:String(a.reservation_id)+String(a.equipment_id),equipment:inventory.data?.find(i=>i.id===a.equipment_id)?.name,reference:b?.reservation_reference,event:b?.event_name,status:b?.status}})} columns={[{key:'reference',label:'Reservation'},{key:'event',label:'Event'},{key:'equipment',label:'Equipment'},{key:'quantity',label:'Allocated chairs'},{key:'status',label:'Booking status'}]}/>
    {action&&<Modal title={(action.kind==='availability'?'Change availability':action.kind==='initial'?'Confirm starting stock':action.kind==='add'?'Add Stock':'Remove Stock')+' · '+action.item.name} close={()=>{if(!mutation.isPending)setAction(null)}}><form className="form" onSubmit={e=>{e.preventDefault();setNotice(null);mutation.mutate()}}>
      <p>{action.kind==='availability'?'Control whether new reservations may request this equipment.':action.kind==='initial'?'Enter the verified physical count, not the number available on a single event date.':`Current recorded physical stock: ${action.item.usable_quantity?.toLocaleString()}. ${action.kind==='remove'?'Removing stock cannot reduce the total below upcoming commitments.':'Purchased or restored usable chairs increase physical stock.'}`}</p>
      {action.kind==='availability'?<p>{action.item.active?'Pause':'Resume'} new allocations? Physical stock and existing bookings will stay unchanged.</p>:<label>{action.kind==='initial'?'Verified starting stock':'Quantity to '+action.kind}<input name="stock-quantity" type="text" inputMode="numeric" maxLength={7} required value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={mutation.isPending}/></label>}
      {['add','remove'].includes(action.kind)&&<label>Note · optional<input name="stock-note" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={mutation.isPending} placeholder={action.kind==='remove'?'e.g. Damaged chairs':'e.g. Newly purchased chairs'}/></label>}
      {action.kind==='initial'&&<label className="consent-check"><input type="checkbox" required/> I verified this actual usable count with the catering team.</label>}
      {mutation.error&&<ErrorState error={mutation.error}/>}
      <div className="actions"><button className="button secondary" type="button" disabled={mutation.isPending} onClick={()=>setAction(null)}>Cancel</button><button className="button" disabled={mutation.isPending}>{mutation.isPending?'Updating inventory…':action.kind==='availability'?'Confirm availability change':action.kind==='initial'?'Confirm starting stock':action.kind==='add'?'Confirm Add Stock':'Confirm Remove Stock'}</button></div>
    </form></Modal>}
  </>
}
