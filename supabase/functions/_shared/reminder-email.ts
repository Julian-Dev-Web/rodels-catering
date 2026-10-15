export interface ReminderEmail { id:string; payload: Record<string,unknown> }
export async function sendReminderEmail(job:ReminderEmail,key:string,request:typeof fetch=fetch) {
  try {
    const response=await request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'event-reminder-'+job.id},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(15000)})
    if(!response.ok)return {status:response.status>=500?'uncertain':'failed',provider:null} as const
    const result=await response.json()
    return typeof result.id==='string'&&result.id ? {status:'sent',provider:result.id} as const : {status:'uncertain',provider:null} as const
  }catch{return {status:'uncertain',provider:null} as const}
}
