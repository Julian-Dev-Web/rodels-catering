import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { crc32 } from 'node:zlib'
import { instance } from '../.tools/node_modules/@viz-js/viz/dist/viz.js'
const require = createRequire(new URL('../.tools/package.json', import.meta.url))
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
GlobalFonts.registerFromPath('C:/Windows/Fonts/times.ttf','Times New Roman')
GlobalFonts.registerFromPath('C:/Windows/Fonts/timesbd.ttf','Times New Roman Bold')
const viz = await instance()
const schema = JSON.parse(await readFile('docs/source/schema-manifest.json','utf8'))
const style = `graph [bgcolor="white",fontname="Times New Roman",fontsize=19,ranksep=0.48,nodesep=0.30,pad=0.18]; node [shape=box,fontname="Times New Roman",fontsize=15,color="black",fontcolor="black",style="rounded,filled",fillcolor="white",margin="0.14,0.09"]; edge [fontname="Times New Roman",fontsize=11,color="black",fontcolor="black",arrowsize=0.65];`
function chunk(type,data) { const name=Buffer.from(type); const result=Buffer.alloc(12+data.length); result.writeUInt32BE(data.length); name.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([name,data]))>>>0,8+data.length);return result }
function dpi(png) {const p=Buffer.alloc(9);p.writeUInt32BE(11811,0);p.writeUInt32BE(11811,4);p[8]=1;return Buffer.concat([png.subarray(0,33),chunk('pHYs',p),png.subarray(33)])}
const files=[]
async function draw(name,body,{landscape=false,wide=false}={}) {
  if(name==='architecture') body=`rankdir=TB;
   actors[label="Customer / manager / super_admin",shape=ellipse];
   client[label="Browser SPA: React + TypeScript\nStatic assets served by Vercel\nGitHub main triggers frontend builds"];
   api[label="Supabase platform APIs\nAuth, PostgREST/RPC, Storage, Realtime"];
   functions[label="Supabase Edge Functions: Deno\nUser verification; server-held secrets"];
   database[label="PostgreSQL\n34 public tables; RLS, constraints and SQL rules",shape=cylinder];
   provider[label="PayMongo\nHosted checkout / refunds / signed webhook"];
   optional[label="Optional Resend email code\nDelivery configuration unverified",style="rounded,dashed"];
   actors->client[label="Use application"];
   client->api[label="User JWT / public reads"];
   client->functions[label="Checkout and staff requests"];
   api->database[label="Authorized data and business RPCs"];
   functions->api[label="Verify user / service RPCs"];
   functions->provider[label="REST API / signed webhook",dir=both];
   functions->optional[label="Internal worker only",style=dashed];
   provider->optional[style=invis];
   graph[label="Browser also uses PSGC address lookups with manual fallback.\nOperators apply SQL and deploy functions through the CLI.",labelloc=b,fontsize=12];`
  const dot=`digraph G {${style} ${body}}`
  const svg=viz.renderString(dot,{format:'svg',engine:'dot'})
  const image=await loadImage(Buffer.from(svg))
  const width=wide?3600:landscape?3200:2600
  const height=Math.round(width*image.height/image.width)
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d')
  ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height)
  await writeFile(`docs/figures/${name}.png`,dpi(canvas.toBuffer('image/png')))
  await writeFile(`docs/source/${name}.dot`,dot)
  files.push({file:`${name}.png`,width,height,dpi:300})
}
await draw('architecture',`rankdir=TB;
 users[label="Customer / manager / super_admin",shape=ellipse];
 browser[label="Browser: React + TypeScript SPA"];
 git[label="GitHub: main source branch"];vercel[label="Vercel: frontend build / hosting"];
 auth[label="Supabase Auth\nEmail/password and user JWT"];
 api[label="Supabase Data API\nPostgREST and RPC"];
 db[label="PostgreSQL\n34 public tables, RLS and SQL rules",shape=cylinder];
 edgefn[label="Supabase Edge Functions\nDeno; server-held provider secrets"];
 storage[label="Supabase Storage\nAvatars and gallery"];
 realtime[label="Supabase Realtime\nPrivate notifications subscription"];
 pay[label="PayMongo\nHosted checkout, webhook and refunds"];
 psgc[label="PSGC API\nEvent-address selectors"];
 resend[label="Resend: optional email code\nConfiguration/delivery unverified",style="rounded,dashed"];
 operator[label="Operator: manual SQL and CLI"];
 users->browser[label="Use application"];
 git->vercel[label="Push triggers build"];vercel->browser[label="Static assets over HTTPS"];
 browser->auth[label="Sign in / recovery"];auth->browser[label="Authenticated session"];
 browser->api[label="Public key + user JWT; RLS"];api->db[label="Authorized reads / SQL RPCs"];
 browser->edgefn[label="Authenticated operations"];edgefn->auth[label="Verify user with getUser()"];
 edgefn->api[label="Service-only provider operations"];
 edgefn->pay[label="Provider REST API"];pay->edgefn[label="Signed payment webhook"];
 browser->storage[label="Policy-controlled image access"];
 browser->realtime[label="Subscribe; polling fallback"];
 db->realtime[label="notifications publication"];
 browser->psgc[label="Public lookup; manual fallback"];
 edgefn->resend[label="Optional worker",style=dashed];
 operator->db[label="Migrations"];operator->edgefn[label="Deploy and secrets"];
 `)
await draw('reservation-workflow',`rankdir=TB;
 start[label="Browse active packages / check available dates",shape=ellipse];
 login[label="Register / sign in as customer"];
 event[label="Enter event, future date/time, contact and address"];
 menu[label="Select package, exact dish count, drink and dessert"];
 setup[label="Select setup, optional features/add-ons, tables and chairs"];
 save[label="save_reservation(data)\nOwnership, eligibility and canonical SQL quote"];
 draft[label="Draft + saved pricing snapshot\nEdit only while unpaid / eligible"];
 final[label="finalize_reservation(rid)\nValidate selections, seating and complete address"];
 review[label="for_approval + balance record\nCustomer/staff notification and audit"];
 payment[label="Customer may open PayMongo checkout\nSee separate payment data-flow diagram"];
 staff[label="Staff review / valid status transition"];
 approved[label="Approved reservation holds capacity\nMaximum three per date",shape=ellipse];
 start->login->event->menu->setup->save->draft->final->review;
 review->payment;review->staff->approved;
 `)
await draw('payment-data-flow',`rankdir=TB;
 client[label="Customer requests partial / full / balance checkout"];
 edgefn[label="Edge verifies user and customer role"];
 rpc[label="begin_checkout: lock reservation\nCalculate canonical amount; one pending checkout"];
 claim[label="Claim provider operation once\nAmbiguous failures require reconciliation"];
 checkout[label="Create PayMongo hosted Checkout Session\nStore provider session and safe checkout URL"];
 provider[label="Customer pays in provider checkout"];
 redirect[label="Return redirect\nDisplays status; cannot mark paid",style="rounded,dashed"];
 signed[label="PayMongo payment webhook"];
 verify[label="Verify raw-body HMAC, timestamp and mode\nFetch provider session independently"];
 confirm[label="confirm_provider_payment\nMatch session/amount, deduplicate, update ledger"];
 capacity[label="Future date has available capacity?",shape=diamond];
 approved[label="Record payment + approve\nHold capacity, balance, transaction, audit and notices"];
 pending[label="Record payment; retain for_approval\nStaff coordinates date capacity with customer"];
 client->edgefn->rpc->claim->checkout->provider;
 provider->redirect[style=dashed];provider->signed->verify->confirm->capacity;
 capacity->approved[label="Yes"];capacity->pending[label="No"];
 `)
function label(table,brief) {
  if(table==='auth_users')return 'auth.users\\n(platform-managed)\\nPK id'
  const t=schema.tables.find(x=>x.name===table)
  const pk=t.constraints.find(x=>x.type==='p')?.definition.replace('PRIMARY KEY ','PK ')||'No primary key'
  const names=table.length>23?table.replace(/_([^_]+)$/,'\\n$1'):table
  return names+'\\n'+(brief?'':pk+'\\n')+(brief?'':t.columns.filter(x=>x.column_name.endsWith('_id')&&x.column_name!=='id').map(x=>x.column_name).join('\\n'))
}
async function erd(name,names,brief=false) {
  const set=new Set(names)
  const body=['rankdir=TB; graph [splines=polyline]; edge [dir=none,fontsize=10,labeldistance=1.6];']
  const remaining=new Set(names),ordered=[]
  while(remaining.size){
    const ready=[...remaining].filter(n=>!schema.foreignKeys.some(f=>f.child===n&&remaining.has(f.parent_schema==='auth'?'auth_users':f.parent)))
    if(!ready.length)throw new Error('Unexpected cycle in audited foreign keys')
    for(const n of ready){ordered.push(n);remaining.delete(n)}
  }
  // Invisible ordering edges control portrait layout; only visible lines are FKs.
  for(let i=0;i<ordered.length-3;i++)body.push(`${ordered[i]}->${ordered[i+3]}[style=invis,weight=2];`)
  for(const name of names)body.push(`${name}[label="${label(name,brief)}",fontsize=${brief?15:14}];`)
  const visible=schema.foreignKeys.filter(fk=>set.has(fk.child)&&set.has(fk.parent_schema==='auth'?'auth_users':fk.parent))
  for(const fk of visible){
    const parent=fk.parent_schema==='auth'?'auth_users':fk.parent
    const incoming=visible.filter(f=>f.child===fk.child),index=incoming.indexOf(fk)
    const port=incoming.length===2?['nw','ne'][index]:incoming.length===3?['nw','n','ne'][index]:incoming.length===4?['ne','w','e','nw'][index]:'n'
    body.push(`${parent}->${fk.child}[taillabel="${fk.required_parent?'1':'0..1'}",headlabel="${fk.unique_child?'0..1':'0..*'}",headport=${port}];`)
  }
  await draw(name,body.join('\n'),{wide:name==='erd-complete'})
}
await erd('erd-complete',['auth_users',...schema.tables.map(x=>x.name)],true)
await erd('erd-catalog-booking',['profiles','menu_sets','menu_categories','dishes','drinks','desserts','reservations','reservation_items'],false)
await erd('erd-event-selections',['reservations','event_setups','event_features','add_ons','chair_types','table_types','reservation_event_setups','reservation_event_features','reservation_add_ons','reservation_tables_chairs'],false)
await erd('erd-finance-scheduling',['reservations','payments','balances','transactions','cancellations','refunds','refund_operations','reschedule_requests','reservation_reschedules'],false)
await erd('erd-identity-service',['auth_users','profiles','reservations','feedback','support_tickets','support_messages','notifications','email_deliveries','audit_logs','gallery_images','app_settings','webhook_events'],false)
await writeFile('docs/source/figure-manifest.json',JSON.stringify(files,null,2)+'\n')
console.log(JSON.stringify(files))
