import { CheckCircle2, AlertCircle, X } from 'lucide-react'
export function FeedbackNotice({text,error=false,close}:{text:string;error?:boolean;close:()=>void}) {
  return <div className={'feedback-notice '+(error?'failure':'success')} role={error?'alert':'status'} aria-atomic="true">
    {error?<AlertCircle size={21}/>:<CheckCircle2 size={21}/>}
    <p>{text}</p><button type="button" className="icon-button" aria-label="Dismiss message" onClick={close}><X size={18}/></button>
  </div>
}
