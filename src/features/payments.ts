import {useEffect} from 'react'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {rpc,supabase} from '../lib/supabase'
import {useAuth} from './auth'
import type {PaymentSummary,PaymentEntry} from '../lib/payments'
const keys=new Set(['reservation','reservations','payments','transactions','balances','booking-ledger','booking-balance','reservation-activity','metrics','operational-metrics','payment-summary','payment-history','payment-report','complete-report-data','payment-email-status','notifications','change-requests','change-request','adjustment-refunds'])
export function usePaymentSummary(id:string){return useQuery({queryKey:['payment-summary',id],enabled:!!id,queryFn:()=>rpc<PaymentSummary>('payment_summary',{rid:id}),refetchOnWindowFocus:true})}
export function usePaymentHistory(id:string){return useQuery({queryKey:['payment-history',id],queryFn:()=>rpc<PaymentEntry[]>('payment_history',{rid:id}),refetchOnWindowFocus:true})}
export function useFinancialRealtime(){
 const {profile}=useAuth(),qc=useQueryClient()
 useEffect(()=>{
  if(!profile)return
  const refresh=()=>void qc.invalidateQueries({predicate:q=>keys.has(String(q.queryKey[0]))})
  let channel=supabase.channel('financial-'+profile.id)
  for(const table of['reservations','payments','transactions','balances','reservation_changes','adjustment_refunds'])channel=channel.on('postgres_changes',{event:'*',schema:'public',table,...(table==='reservations'&&profile.role==='customer'?{filter:'customer_id=eq.'+profile.id}:{})},refresh)
  channel.subscribe(status=>{if(status==='SUBSCRIBED')refresh()})
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh)
  return()=>{void supabase.removeChannel(channel);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh)}
 },[profile,qc])
}
