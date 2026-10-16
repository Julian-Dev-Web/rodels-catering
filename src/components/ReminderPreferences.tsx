import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../features/auth'
import { rpc } from '../lib/supabase'
import { ErrorState } from './ui'
export function ReminderPreferences() {
  const {profile,refresh}=useAuth()
  const mutation=useMutation({mutationFn:(form:HTMLFormElement)=>{const d=new FormData(form);return rpc('update_reminder_preferences',{in_app:d.get('in_app')==='on',email:d.get('email')==='on'})},onSuccess:refresh})
  if(!profile)return null
  const manager=profile.role==='manager'
  return <form className="panel form" onSubmit={e=>{e.preventDefault();mutation.mutate(e.currentTarget)}}><h2>{manager?'Manager preparation reminders':'Upcoming event reminders'}</h2><p>{manager?'Receive a separate daily preparation reminder for each approved upcoming event, from seven days through one day before the event. Open Upcoming preparation to review the schedule.':'Daily reminders run from seven days through one day before your confirmed events.'} Reminders use the configured Manila send time. Email requires a working sender configuration; provider acceptance does not guarantee inbox delivery.</p><label className="consent-check"><input name="in_app" type="checkbox" defaultChecked={profile.reminder_inapp_opt_in!==false}/> {manager?'Send daily in-app preparation reminders':'Send daily in-app event reminders'}</label><label className="consent-check"><input name="email" type="checkbox" defaultChecked={profile.reminder_email_opt_in===true}/> {manager?'I want daily preparation reminder emails for upcoming events':'I want daily event reminder emails for my bookings'}</label><p>You may turn these optional reminders off here. Booking status and payment notices are separate.</p><button className="button secondary" disabled={mutation.isPending}>Save reminder preferences</button>{mutation.error&&<ErrorState error={mutation.error}/>}</form>
}
