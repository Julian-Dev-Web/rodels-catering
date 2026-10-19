import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rpc } from '../lib/supabase'
import { discountBasisPoints } from '../lib/manager-input'
import { message } from '../lib/format'
import { DataTable, ErrorState, Loading, Modal, PageHeading } from '../components/ui'
import { FeedbackNotice } from '../components/FeedbackNotice'
import { discountSummary, discountDate, type DiscountUsage } from '../lib/account-discount'
import type { RecordRow } from '../types'

interface Customer {id:string;full_name:string;email:string;account_status:string;account_discount_bps:number;assignment_id:string|null;usage_type:DiscountUsage|null;expires_on:string|null;discount_status:string}
interface Directory {customers:Customer[];total:number;min_bps:number;max_bps:number}
interface SavedDiscount {customer_name:string;previous_bps:number;percentage_bps:number;usage_type:DiscountUsage;expires_on:string|null}
export function CustomerManagement() {
  const qc=useQueryClient()
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),keyword=useDeferredValue(search)
  const directory=useQuery({queryKey:['customer-directory',keyword,page],queryFn:()=>rpc<Directory>('staff_customer_directory',{search:keyword,page_number:page,page_size:20})})
  const [target,setTarget]=useState<Customer|null>(null),[choice,setChoice]=useState('10'),[custom,setCustom]=useState('')
  const [usage,setUsage]=useState<DiscountUsage>('ongoing'),[expires,setExpires]=useState(false),[expiry,setExpiry]=useState(''),[fieldError,setFieldError]=useState('')
  const [removing,setRemoving]=useState<Customer|null>(null),[notice,setNotice]=useState<{text:string;error?:boolean}|null>(null)
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const mutation=useMutation({
    mutationFn:({customer,remove=false}:{customer:Customer;remove?:boolean})=>rpc<SavedDiscount>('save_customer_discount',{
      customer_id:customer.id,percentage_bps:remove?0:discountBasisPoints(choice==='custom'?custom:choice,directory.data?.min_bps,directory.data?.max_bps),
      usage_type:remove?customer.usage_type||'ongoing':usage,expires_on:remove||!expires?null:expiry,expected_assignment_id:customer.assignment_id,
    }),
    onSuccess:async(saved)=>{
      await qc.invalidateQueries({queryKey:['customer-directory']})
      void qc.invalidateQueries({queryKey:['account-discount']})
      setNotice({text:saved.percentage_bps===0?`Discount removed from ${saved.customer_name}. New eligible reservations will use regular pricing.`:`${saved.previous_bps?'Discount updated successfully. ':''}${saved.percentage_bps/100}% discount successfully assigned to ${saved.customer_name} — ${discountSummary(saved.usage_type,saved.expires_on)}.`})
      setTarget(null);setRemoving(null)
    },
    onError:error=>{const detail=message(error)||'Unable to save discount. Please try again.';setFieldError(detail);setNotice({text:detail,error:true});void qc.invalidateQueries({queryKey:['customer-directory']})},
  })
  function open(customer:Customer){
    setTarget(customer);setFieldError('');setNotice(null)
    const editing=customer.account_discount_bps>0&&['ACTIVE','RESERVED'].includes(customer.discount_status)
    const percent=String(editing?customer.account_discount_bps/100:10)
    setChoice(['5','10','15','20'].includes(percent)?percent:'custom');setCustom(editing?percent:'')
    setUsage(editing?customer.usage_type||'ongoing':'ongoing');setExpires(editing&&!!customer.expires_on);setExpiry(editing?customer.expires_on||'':'')
  }
  function save(){
    if(!target)return
    try{
      const bps=discountBasisPoints(choice==='custom'?custom:choice,directory.data?.min_bps,directory.data?.max_bps)
      if(bps===0)throw Error('Use Remove Discount to remove the offer, or choose a percentage greater than zero.')
      if(expires&&(!expiry||expiry<today))throw Error('Choose today or a future expiration date (Manila).')
      setFieldError('');mutation.mutate({customer:target})
    }catch(error){setFieldError(error instanceof Error?error.message:'Check the discount fields.')}
  }
  const customers=directory.data?.customers||[],currentPercent=choice==='custom'?custom:choice
  return <>
    <PageHeading title="Your customers." eyebrow="MANAGER · CUSTOMER MANAGEMENT">Find a customer and manage their account offer. Paid bookings keep their agreed prices.</PageHeading>
    {notice&&<FeedbackNotice {...notice} close={()=>setNotice(null)}/>}
    <label className="customer-search">Find customer by name or email<input type="search" value={search} maxLength={200} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Search registered customers…"/></label>
    <details className="discount-help"><summary>About account offers</summary><p>Ongoing offers apply to eligible future bookings. One-time offers are held at checkout and used after the first verified payment, including a down payment. An assigned promotion takes precedence; offers do not combine. Expiration is at the end of the selected day in Manila. Open checkouts retain their agreed quote.</p></details>
    <h2>Registered customers</h2>
    {directory.error?<ErrorState error={directory.error}/>:directory.isPending?<Loading/>:!customers.length?<section className="panel" role="status">{keyword?'No customers match this name or email.':'No registered customers yet.'}</section>:<DataTable externalPagination key={keyword+'-'+page} rows={customers as unknown as RecordRow[]} columns={[
      {key:'full_name',label:'Customer'},{key:'email',label:'Email'},
      {key:'account_discount_bps',label:'Assigned discount',render:r=>Number(r.account_discount_bps)?Number(r.account_discount_bps)/100+'%':'None'},
      {key:'usage_type',label:'Type',render:r=>r.usage_type==='one_time'?'One-time only':r.usage_type==='ongoing'?'Every future booking':'—'},
      {key:'expires_on',label:'Expiration',render:r=>r.expires_on?discountDate(String(r.expires_on)):r.assignment_id?'No expiration':'—'},
      {key:'discount_status',label:'Status',render:r=><span className="badge">{String(r.discount_status).toLowerCase()}</span>},
    ]} actions={r=>{const customer=customers.find(c=>c.id===r.id)!;return <><button className="text-button" disabled={mutation.isPending} onClick={()=>open(customer)}>{customer.account_discount_bps>0&&['ACTIVE','RESERVED'].includes(customer.discount_status)?'Edit Discount':'Assign Discount'}</button>{customer.assignment_id&&customer.account_discount_bps>0&&<button className="text-button" disabled={mutation.isPending} onClick={()=>{setFieldError('');setRemoving(customer)}}>Remove Discount</button>}</>}}/>}
    <div className="actions directory-pagination" aria-label="Customer directory pages"><button className="button secondary small" disabled={page===0||directory.isFetching||mutation.isPending} onClick={()=>setPage(p=>p-1)}>Previous customers</button><span>{directory.data?.total||0} matching customers · Page {page+1}</span><button className="button secondary small" disabled={(page+1)*20>=(directory.data?.total||0)||directory.isFetching||mutation.isPending} onClick={()=>setPage(p=>p+1)}>Next customers</button></div>
    {target&&<Modal title={target.account_discount_bps>0&&['ACTIVE','RESERVED'].includes(target.discount_status)?'Edit customer discount':'Assign customer discount'} close={()=>{if(!mutation.isPending)setTarget(null)}}>
      <form className="form discount-dialog" onSubmit={e=>{e.preventDefault();save()}}>
        <p>Assign discount to: <strong>{target.full_name||'Name not provided'}</strong><br/>{target.email}</p>
        <fieldset disabled={mutation.isPending}><legend>Discount percentage</legend><div className="discount-presets">{['5','10','15','20','custom'].map(p=><button type="button" className={'button '+(choice===p?'':'secondary')} aria-pressed={choice===p} key={p} onClick={()=>setChoice(p)}>{p==='custom'?'Custom':p+'%'}</button>)}</div>
          {choice==='custom'&&<label>Custom percentage<input name="custom-percentage" inputMode="decimal" value={custom} maxLength={6} onChange={e=>setCustom(e.target.value)} placeholder="e.g. 12.5" required/></label>}
        </fieldset>
        <fieldset disabled={mutation.isPending}><legend>How often can this discount be used?</legend>
          <label className="discount-radio"><input type="radio" name="discount-usage" value="ongoing" checked={usage==='ongoing'} onChange={()=>setUsage('ongoing')}/><span><strong>Every future booking</strong><small>Ongoing account offer while active.</small></span></label>
          <label className="discount-radio"><input type="radio" name="discount-usage" value="one_time" checked={usage==='one_time'} onChange={()=>setUsage('one_time')}/><span><strong>One-time only</strong><small>Used after one booking’s first verified payment.</small></span></label>
        </fieldset>
        <fieldset disabled={mutation.isPending}><legend>Expiration</legend>
          <label className="discount-expiration"><input type="radio" name="discount-expiration" checked={!expires} onChange={()=>setExpires(false)}/>No expiration</label>
          <label className="discount-expiration"><input type="radio" name="discount-expiration" checked={expires} onChange={()=>setExpires(true)}/>Ends on</label>
          {expires&&<label>Last valid day (Manila)<input name="discount-expiry" type="date" value={expiry} min={today} required onChange={e=>setExpiry(e.target.value)}/></label>}
        </fieldset>
        <p className="account-offer" aria-live="polite">{currentPercent||'—'}% off · {discountSummary(usage,expires?expiry:null)}</p>
        {fieldError&&<p className="error" role="alert">{fieldError}</p>}
        <div className="actions"><button type="button" className="button secondary" disabled={mutation.isPending} onClick={()=>setTarget(null)}>Cancel</button><button className="button" disabled={mutation.isPending}>{mutation.isPending?'Saving…':'Save Discount'}</button></div>
      </form>
    </Modal>}
    {removing&&<Modal title="Remove account discount?" close={()=>{if(!mutation.isPending)setRemoving(null)}}><p>Remove the account offer for <strong>{removing.full_name}</strong>? Future eligible quotes will use regular pricing. Paid bookings and open checkouts keep their agreed prices.</p>{fieldError&&<p role="alert" className="error">{fieldError}</p>}<div className="actions"><button className="button secondary" disabled={mutation.isPending} onClick={()=>setRemoving(null)}>Keep discount</button><button className="button" disabled={mutation.isPending} onClick={()=>mutation.mutate({customer:removing,remove:true})}>{mutation.isPending?'Removing…':'Confirm removal'}</button></div></Modal>}
  </>
}
