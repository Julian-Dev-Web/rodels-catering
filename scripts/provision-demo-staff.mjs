// Restricted operator CLI only. Never import into React or pass secrets on argv.
import {createClient} from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key)throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in an ignored operator env file.')
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const apply=process.argv.includes('--apply')
const designated=[{email:'superadmin@test.com',role:'super_admin',passwordEnv:'DEMO_SUPER_ADMIN_PASSWORD'},{email:'manger@test.com',role:'manager',passwordEnv:'DEMO_MANAGER_PASSWORD'}]
const users=[]
for(let page=1;;page++){const {data,error}=await client.auth.admin.listUsers({page,perPage:100});if(error)throw Error('Operator account read failed.');users.push(...data.users);if(data.users.length<100)break}
for(const account of designated){
 let user=users.find(u=>u.email?.toLowerCase()===account.email)
 if(!user&&apply){const password=process.env[account.passwordEnv];if(!password)throw Error('Missing designated demo password in private operator environment.');const created=await client.auth.admin.createUser({email:account.email,password,email_confirm:true,user_metadata:{first_name:'Demo',last_name:account.role==='manager'?'Manager':'Administrator'}});if(created.error)throw Error('Designated demo account provisioning failed.');user=created.data.user}
 if(!user){console.log(JSON.stringify({role:account.role,exists:false,applied:false}));continue}
 let {data:profile,error}=await client.from('profiles').select('role,account_status').eq('id',user.id).single();if(error)throw Error('Designated Auth account is missing its profile. Review the bootstrap migration before repairing it.')
 const needsConfirmation=!user.email_confirmed_at,needsRole=profile.role!==account.role,needsActivation=profile.account_status!=='active'
 if(apply&&(needsConfirmation||needsRole||needsActivation)){
  if(profile.role==='super_admin'&&account.role!=='super_admin'){const {count,error}=await client.from('profiles').select('id',{head:true,count:'exact'}).eq('role','super_admin').eq('account_status','active').neq('id',user.id);if(error||!count)throw Error('Do not demote the last active super admin.')}
  if(needsConfirmation){const update=await client.auth.admin.updateUserById(user.id,{email_confirm:true});if(update.error)throw Error('Designated email confirmation failed.')}
  const update=await client.from('profiles').update({role:account.role,account_status:'active',status_changed_at:new Date().toISOString()}).eq('id',user.id);if(update.error)throw Error('Designated demo profile repair failed.')
  const audit=await client.from('audit_logs').insert({action:'demo.staff_provisioned',entity_id:user.id,details:{role:account.role,scope:'restricted operator CLI; designated test account'}});if(audit.error)throw Error('Provisioning audit could not be recorded.')
  profile={role:account.role,account_status:'active'}
 }
 console.log(JSON.stringify({role:account.role,exists:true,emailConfirmationNeeded:apply?false:needsConfirmation,roleCorrect:profile.role===account.role,active:profile.account_status==='active',changesApplied:apply&&(needsConfirmation||needsRole||needsActivation)}))
}
