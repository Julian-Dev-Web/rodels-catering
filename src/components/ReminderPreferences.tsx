import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../features/auth'
import { rpc } from '../lib/supabase'
import { ErrorState } from './ui'
export function ReminderPreferences() {
  const {profile,refresh}=useAuth()
  const mutation=useMutation({mutationFn:(form:HTMLFormElement)=>{const d=new FormData(form);return rpc('update_reminder_preferences',{in_app:d.get('in_app')==='on',email:d.get('email')==='on'})},onSuccess:refresh})
  if(!profile)return null
  return <form className="panel form" onSubmit={e=>{e.preventDefault();mutation.mutate(e.currentTarget)}}><h2>Upcoming event reminders</h2><p>Daily reminders run from seven days through one day before confirmed events, using the configured Manila send time. Email requires a working sender configuration; provider acceptance does not guarantee inbox delivery.</p><label className="consent-check"><input name="in_app" type="checkbox" defaultChecked={profile.reminder_inapp_opt_in!==false}/> Send daily in-app event reminders</label><label className="consent-check"><input name="email" type="checkbox" defaultChecked={profile.reminder_email_opt_in===true}/> I want daily event reminder emails for my bookings</label><p>You may turn these optional reminders off here. Booking status and payment notices are separate.</p><button className="button secondary" disabled={mutation.isPending}>Save reminder preferences</button>{mutation.error&&<ErrorState error={mutation.error}/>}</form>
}
