import { useDeferredValue, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rpc } from '../lib/supabase'
import { discountBasisPoints } from '../lib/manager-input'
import { DataTable, ErrorState, Loading, Modal, PageHeading } from '../components/ui'
import { FeedbackNotice } from '../components/FeedbackNotice'
import type { RecordRow } from '../types'

interface Customer {id:string;full_name:string;email:string;account_status:string;account_discount_bps:number}
interface Directory {customers:Customer[];total:number;min_bps:number;max_bps:number;business_cap_configured:boolean}
interface SavedDiscount {customer_name:string;previous_bps:number;percentage_bps:number}
export function CustomerManagement() {
  const qc=useQueryClient(),picker=useRef<HTMLSelectElement>(null)
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),keyword=useDeferredValue(search)
  const directory=useQuery({queryKey:['customer-directory',keyword,page],queryFn:()=>rpc<Directory>('staff_customer_directory',{search:keyword,page_number:page,page_size:20})})
  const [target,setTarget]=useState<Customer|null>(null),[choice,setChoice]=useState('10'),[custom,setCustom]=useState('')
  const [removing,setRemoving]=useState<Customer|null>(null),[notice,setNotice]=useState<{text:string;error?:boolean}|null>(null)
  const mutation=useMutation({
    mutationFn:({customer,remove=false}:{customer:Customer;remove?:boolean})=>rpc<SavedDiscount>('manage_customer_account_discount',{
      customer_id:customer.id,percentage_bps:remove?0:discountBasisPoints(choice==='custom'?custom:choice,directory.data?.min_bps,directory.data?.max_bps),
    }),
    onSuccess:(saved,args)=>{
      const next=saved.percentage_bps/100,previous=saved.previous_bps/100
      setNotice({text:next===0?`Discount removed from ${saved.customer_name}. Future reservations will use regular pricing unless a promotion is assigned.`:previous===0?`${next}% discount successfully assigned to ${saved.customer_name}. It will apply to eligible future reservations.`:`Customer discount updated from ${previous}% to ${next}%. It will apply to eligible future reservations.`})
      if(target?.id===args.customer.id)setTarget({...args.customer,account_discount_bps:saved.percentage_bps})
      setRemoving(null);void qc.invalidateQueries({queryKey:['customer-directory']})
    },
    onError:error=>setNotice({text:error instanceof Error?error.message:'Could not save the discount. Please try again.',error:true}),
  })
  function select(customer:Customer){setTarget(customer);const percent=String(customer.account_discount_bps/100);setChoice(['5','10','15','20'].includes(percent)?percent:customer.account_discount_bps?'custom':'10');setCustom(customer.account_discount_bps?percent:'');picker.current?.focus()}
  const customers=directory.data?.customers||[],options=target&&!customers.some(c=>c.id===target.id)?[target,...customers]:customers
  return <>
    <PageHeading title="Customer account discounts." eyebrow="MANAGER · CUSTOMER MANAGEMENT">Choose a registered customer and a percentage. The account discount applies to eligible future bookings across Simple Buffet, Birthday and Wedding. Paid bookings keep their saved prices.</PageHeading>
    {notice&&<FeedbackNotice {...notice} close={()=>setNotice(null)}/>}
    <section className="panel form" aria-label="Assign customer discount">
      <label>Find customer by name or email<input type="search" value={search} maxLength={200} disabled={mutation.isPending} onChange={e=>{setSearch(e.target.value);setPage(0);setTarget(null)}} placeholder="Search registered customers…"/></label>
      {directory.error&&<ErrorState error={directory.error}/>}
      <form className="form" onSubmit={e=>{e.preventDefault();setNotice(null);if(!target)return;try{if(discountBasisPoints(choice==='custom'?custom:choice,directory.data?.min_bps,directory.data?.max_bps)===0){setRemoving(target);return}}catch{mutation.mutate({customer:target});return}mutation.mutate({customer:target})}}>
        <label>1. Select Customer<select ref={picker} name="customer" required value={target?.id||''} disabled={mutation.isPending||directory.isFetching||keyword!==search} onChange={e=>{const found=options.find(c=>c.id===e.target.value);if(found)select(found);else setTarget(null)}}><option value="">{directory.isPending?'Loading customers…':!customers.length?'No customers match this search':'Choose a customer'}</option>{options.map(c=><option key={c.id} value={c.id}>{c.full_name||'Name not provided'} — {c.email||'Email unavailable'}{c.account_discount_bps?` · ${c.account_discount_bps/100}% discount`:''}</option>)}</select></label>
        {target&&<p className="date-help">Current account discount: <strong>{target.account_discount_bps?target.account_discount_bps/100+'%':'None'}</strong></p>}
        <label>2. Choose Discount<select name="discount-choice" value={choice} disabled={mutation.isPending} onChange={e=>setChoice(e.target.value)}>{[5,10,15,20].map(p=><option key={p} value={p}>{p}%</option>)}<option value="custom">Custom percentage</option></select></label>
        {choice==='custom'&&<label>Custom percentage<input name="custom-percentage" type="text" inputMode="decimal" value={custom} maxLength={6} onChange={e=>setCustom(e.target.value)} disabled={mutation.isPending} required placeholder="e.g. 12.5"/></label>}
        <p className="date-help">Supported range: {(directory.data?.min_bps??0)/100}%–{(directory.data?.max_bps??10000)/100}%, with up to two decimal places. No separate business discount cap is configured. Promotions replace the account discount; they never combine automatically.</p>
        <button className="button" disabled={!target||mutation.isPending||!directory.data}>{mutation.isPending?'Saving discount…':'3. Save Discount'}</button>
      </form>
    </section>
    <h2>Registered customers</h2>
    {directory.isPending?<Loading/>:<DataTable externalPagination key={keyword+'-'+page} rows={customers as unknown as RecordRow[]} columns={[
      {key:'full_name',label:'Customer'},{key:'email',label:'Email'},
      {key:'account_discount_bps',label:'Current Discount',render:r=>Number(r.account_discount_bps)?Number(r.account_discount_bps)/100+'%':'None'},
      {key:'discount_status',label:'Discount status',render:r=>Number(r.account_discount_bps)>0?'Active':'None'},
    ]} actions={r=><><button className="text-button" disabled={mutation.isPending} onClick={()=>select(customers.find(c=>c.id===r.id)!)}>Edit</button><button className="text-button" disabled={mutation.isPending||!Number(r.account_discount_bps)} onClick={()=>setRemoving(customers.find(c=>c.id===r.id)!)}>Remove</button></>}/>}
    <div className="actions directory-pagination" aria-label="Customer directory pages"><button className="button secondary small" disabled={page===0||directory.isFetching||mutation.isPending} onClick={()=>setPage(p=>p-1)}>Previous customers</button><span>{directory.data?.total||0} matching customers · Page {page+1}</span><button className="button secondary small" disabled={(page+1)*20>=(directory.data?.total||0)||directory.isFetching||mutation.isPending} onClick={()=>setPage(p=>p+1)}>Next customers</button></div>
    {removing&&<Modal title="Remove account discount?" close={()=>{if(!mutation.isPending)setRemoving(null)}}><p>Remove the {removing.account_discount_bps/100}% account discount for {removing.full_name}? Future eligible quotes will use regular pricing unless a promotion applies. Paid bookings and open checkouts remain unchanged.</p><div className="actions"><button className="button secondary" disabled={mutation.isPending} onClick={()=>setRemoving(null)}>Keep discount</button><button className="button" disabled={mutation.isPending} onClick={()=>mutation.mutate({customer:removing,remove:true})}>{mutation.isPending?'Removing…':'Confirm removal'}</button></div></Modal>}
  </>
}
