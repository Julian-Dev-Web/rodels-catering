import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const profile=resolve('docs/.tools/public-browser-profile')
const process=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=9237','--user-data-dir='+profile,'about:blank',
],{windowsHide:true,stdio:'ignore'})
let socket,sequence=0
const pending=new Map()
async function send(method,params={}) {
  const id=++sequence
  const result=new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});setTimeout(()=>{if(pending.delete(id))reject(new Error('Browser command timed out: '+method))},25000).unref()})
  socket.send(JSON.stringify({id,method,params}))
  return result
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
try{
  let pages
  for(let attempt=0;attempt<30;attempt++){
    try{pages=await(await fetch('http://127.0.0.1:9237/json/list')).json();break}catch{await delay(300)}
  }
  if(!pages)throw new Error('Owned headless browser did not start')
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage=event=>{const reply=JSON.parse(event.data);const item=pending.get(reply.id);if(item){pending.delete(reply.id);if(reply.error)item.reject(new Error(reply.error.message));else item.resolve(reply.result)}}
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:1050,deviceScaleFactor:2,mobile:false})
  const records=[]
  for(const [name,path] of [['ui-home','/'],['ui-register','/register'],['ui-login','/login']]){
    const url='https://rodels-catering.vercel.app'+path
    await send('Page.navigate',{url})
    await delay(3500)
    for(let attempt=0;attempt<12;attempt++){
      const ready=await send('Runtime.evaluate',{expression:"document.readyState==='complete' && !!document.querySelector('h1')",returnByValue:true})
      if(ready.result.value)break
      await delay(500)
    }
    await send('Runtime.evaluate',{expression:'document.fonts.ready.then(()=>true)',awaitPromise:true,returnByValue:true})
    const contents=await send('Runtime.evaluate',{expression:"JSON.stringify({title:document.title,h1:document.querySelector('h1')?.innerText,fieldLabels:Array.from(document.querySelectorAll('form label')).map(x=>x.innerText)})",returnByValue:true})
    const metrics=await send('Page.getLayoutMetrics')
    const height=Math.min(Math.ceil(metrics.cssContentSize.height),1800)
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1366,height,scale:1}})
    await writeFile(`docs/figures/${name}.png`,Buffer.from(shot.data,'base64'))
    records.push({file:name+'.png',source:url,captured_date:'2026-10-14',type:'real unauthenticated live UI screenshot',...JSON.parse(contents.result.value)})
  }
  await writeFile('docs/source/screenshot-manifest.json',JSON.stringify(records,null,2)+'\n')
  console.log(JSON.stringify(records))
  await send('Browser.close').catch(()=>{})
}finally{
  socket?.close()
  if(process.exitCode===null)process.kill()
}
