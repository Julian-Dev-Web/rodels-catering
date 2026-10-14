import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const require=createRequire(new URL('../.tools/package.json',import.meta.url))
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas')
GlobalFonts.registerFromPath('C:/Windows/Fonts/times.ttf','Times New Roman')
GlobalFonts.registerFromPath('C:/Windows/Fonts/timesbd.ttf','Times New Roman Bold')
const pdfjs=await import('../.tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs')
const filename='RodelConnect_ELEC5_Technical_Documentation_2026-10-14'
const loading=pdfjs.getDocument({data:new Uint8Array(await readFile('docs/final/'+filename+'.pdf')),standardFontDataUrl:pathToFileURL(process.cwd()+'/docs/.tools/node_modules/pdfjs-dist/standard_fonts/').href,useSystemFonts:true})
const pdf=await loading.promise
await mkdir('docs/qa/pages',{recursive:true})
const pages=[],texts=[],thumbs=[]
for(let n=1;n<=pdf.numPages;n++){
 const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.6}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height))
 const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height)
 await page.render({canvasContext:ctx,viewport}).promise
 const png='docs/qa/pages/page-'+String(n).padStart(2,'0')+'.png';await writeFile(png,canvas.toBuffer('image/png'))
 const content=await page.getTextContent(),items=content.items.filter(i=>i.str?.trim()),text=items.map(i=>i.str).join(' ')
 const violations=items.filter(i=>i.transform[4]<69||i.transform[4]+i.width>526||i.transform[5]<23||i.transform[5]>815).map(i=>({text:i.str,x:i.transform[4],y:i.transform[5],width:i.width}))
 const report={page:n,width:page.view[2],height:page.view[3],textItems:items.length,first:text.slice(0,150),last:text.slice(-140),boundsWarnings:violations}
 pages.push(report);texts.push('PAGE '+n+'\n'+text)
 const thumb=createCanvas(670,948),tc=thumb.getContext('2d');tc.drawImage(canvas,0,0,670,948);thumbs.push(thumb)
 if(n%6===0||n===pdf.numPages){
  const count=thumbs.length,sheet=createCanvas(2070,2010),sctx=sheet.getContext('2d');sctx.fillStyle='#dddddd';sctx.fillRect(0,0,2070,2010)
  for(let k=0;k<count;k++){const x=15+(k%3)*690,y=38+Math.floor(k/3)*997;sctx.fillStyle='black';sctx.font='18px Times New Roman';sctx.fillText('PDF page '+(n-count+k+1),x,y-12);sctx.drawImage(thumbs[k],x,y)}
  await writeFile('docs/qa/contact-'+String(Math.ceil(n/6)).padStart(2,'0')+'.png',sheet.toBuffer('image/png'));thumbs.length=0
 }
 page.cleanup()
 console.log('Rendered PDF page '+n+'/'+pdf.numPages)
}
const fulltext=texts.join('\n\n')
const secretFound=/\b(?:sk_test_|sk_live_|whsk_)[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|\b(?:superadmin|manger|guest)@test\.com\b/i.test(fulltext)
await writeFile('docs/qa/pdf-text.txt',fulltext)
await writeFile('docs/qa/pdf-inspection.json',JSON.stringify({pages:pdf.numPages,secretFound,pageReports:pages},null,2)+'\n')
await loading.destroy()
if(secretFound)throw new Error('PDF secret scan found an unexpected credential/account identifier')
console.log(JSON.stringify({pages:pages.length,boundsWarnings:pages.filter(p=>p.boundsWarnings.length).map(p=>p.page),secretFound}))
