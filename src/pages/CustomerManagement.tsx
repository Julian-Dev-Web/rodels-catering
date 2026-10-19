import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { records, rpc } from '../lib/supabase'
import { date } from '../lib/format'
import { Badge, DataTable, ErrorState, Loading, Modal, PageHeading } from '../components/ui'
import type { Profile, RecordRow } from '../types'

export function CustomerManagement() {
  const qc = useQueryClient()
  const customers = useQuery({queryKey:['customer-accounts'],queryFn:()=>records<Profile>('profiles','created_at',false,{role:'customer'})})
  const [target,setTarget] = useState<Profile|null>(null)
  const [percent,setPercent] = useState('0')
  const [reason,setReason] = useState('')
  const save = useMutation({
    mutationFn: (remove:boolean) => rpc('set_customer_account_discount', {customer_id:target!.id,percentage_bps:remove?0:Math.round(Number(percent)*100),reason}),
    onSuccess:()=>{setTarget(null);void qc.invalidateQueries()},
  })
  const edit=(customer:Profile)=>{save.reset();setTarget(customer);setPercent(String((customer.account_discount_bps||0)/100));setReason('')}
  return <>
    <PageHeading title="Customer Management" eyebrow="MANAGER · CUSTOMER ACCOUNTS">Assign an account percentage discount for new reservations and reviewed unpaid quotes. Paid bookings and open checkouts keep their agreed prices. A staff-selected promotion replaces the account discount for that booking; discounts do not combine.</PageHeading>
    {customers.isPending?<Loading/>:customers.error?<ErrorState error={customers.error}/>:<DataTable
      rows={customers.data as unknown as RecordRow[]}
      columns={[
        {key:'full_name',label:'Customer'},
        {key:'phone',label:'Contact number'},
        {key:'account_status',label:'Status',render:r=><Badge value={String(r.account_status)}/>},
        {key:'account_discount_bps',label:'Account Discount',render:r=>Number(r.account_discount_bps)>0?Number(r.account_discount_bps)/100+'%':'None'},
        {key:'account_discount_changed_at',label:'Discount updated',render:r=>r.account_discount_changed_at?date(String(r.account_discount_changed_at)):'—'},
      ]}
      actions={r=><button className="button small secondary" onClick={()=>edit(customers.data.find(p=>p.id===r.id)!)}>Edit account discount</button>}
    />}
    {target&&<Modal title={'Account Discount · '+target.full_name} close={()=>{if(!save.isPending)setTarget(null)}}>
      <form className="form" onSubmit={e=>{e.preventDefault();save.mutate(false)}}>
        <p>Changes apply when a new reservation is quoted or an eligible unpaid quote is refreshed. Verified payments, completed bookings and pending checkout amounts remain unchanged.</p>
        <label>Account Discount (%)<input type="number" name="percentage" min="0" max="100" step="0.01" required list="account-discount-rates" value={percent} onChange={e=>setPercent(e.target.value)}/></label>
        <datalist id="account-discount-rates">{[0,5,10,15,20].map(p=><option key={p} value={p}/>)}</datalist>
        <label>Reason for assignment, change or removal<textarea name="reason" required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        {save.error&&<ErrorState error={save.error}/>}
        <div className="actions"><button className="button" disabled={save.isPending}>Save account discount</button><button type="button" className="button secondary" disabled={save.isPending||reason.trim().length<3||!target.account_discount_bps} onClick={()=>save.mutate(true)}>Remove discount</button></div>
      </form>
    </Modal>}
  </>
}
