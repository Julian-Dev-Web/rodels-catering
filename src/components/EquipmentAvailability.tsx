import { useQuery } from '@tanstack/react-query'
import { rpc } from '../lib/supabase'
import { ErrorState } from './ui'
export interface EquipmentAvailabilityRow {equipment_id:string;code:string;name:string;total:number|null;allocated:number;available:number|null;overcommitted:boolean;active:boolean}
export function EquipmentAvailability({day,rid,requested,monoblockRequested=0}:{day:string;rid?:string;requested:number;monoblockRequested?:number}) {
  const query=useQuery({queryKey:['equipment-availability',day,rid],enabled:/^\d{4}-\d{2}-\d{2}$/.test(day),queryFn:()=>rpc<EquipmentAvailabilityRow[]>('equipment_availability',{day,rid:rid||null}),refetchInterval:15000})
  return <section className="equipment-availability" aria-label="Shared chair availability"><h3>Chair stock for this event date</h3><p>Chairs are shared for the entire day. Drafts and pending requests do not reserve stock; approval checks availability again.</p>{query.error&&<ErrorState error={query.error}/>}{query.isPending&&<p role="status">Checking chair availability…</p>}{query.data?.filter(i=>['elegant_chair','monoblock_chair'].includes(i.code)).map(item=>{
    const amount=item.code==='elegant_chair'?requested:monoblockRequested
    return <div key={item.equipment_id}><h4>{item.name}</h4><dl className="detail-list"><dt>Total usable chairs</dt><dd>{item.total??'Manager confirmation needed'}</dd><dt>Allocated to other bookings</dt><dd>{item.allocated}</dd><dt>Available for this booking</dt><dd>{item.available??'Not yet confirmed'}</dd><dt>Requested chairs</dt><dd>{amount}</dd></dl>{item.overcommitted&&<p className="field-error" role="alert">Existing commitments exceed recorded stock. Contact the manager before requesting more chairs.</p>}{amount>0&&(item.total===null||!item.active||amount>(item.available??0))&&<p className="field-error" role="alert">{item.total===null?`The manager must confirm ${item.name} stock before these chairs can be secured.`:!item.active?`${item.name} are unavailable for new allocations.`:`Only ${item.available??0} ${item.name} are available; ${amount} requested. Reduce the quantity or choose another date.`}</p>}</div>
  })}</section>
}
