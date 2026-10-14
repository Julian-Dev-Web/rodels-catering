import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {title,authors,references,chapters} from '../source/document-data.mjs'
import {entities,additionalChapters} from '../source/document-details.mjs'
import {appendices,stackRows,legalRows,edgeRows,rpcDescriptions} from '../source/document-appendices.mjs'
const require=createRequire(new URL('../.tools/package.json',import.meta.url))
const {Document,Packer,Paragraph,TextRun,HeadingLevel,AlignmentType,Table,TableRow,TableCell,WidthType,BorderStyle,ImageRun,TableOfContents,Footer,PageNumber,NumberFormat,StyleLevel,TableLayoutType}=require('docx')
const {loadImage}=require('@napi-rs/canvas')
const schema=JSON.parse(await readFile('docs/source/schema-manifest.json','utf8'))
const matrix=await readFile('docs/revision-action-matrix.md','utf8')
const matrixRows=matrix.split(/\r?\n/).filter(l=>/^\| R\d/.test(l)).map(l=>l.split('|').slice(1,-1).map(s=>s.trim().replace(/`/g,'')))
const filename='RodelConnect_ELEC5_Technical_Documentation_2026-10-14'
const BLACK='000000',FONT='Times New Roman',WIDTH=9026
const run=(text,extra={})=>new TextRun({text,font:FONT,color:BLACK,size:24,...extra})
const body=(text,extra={})=>new Paragraph({children:[run(text)],alignment:AlignmentType.JUSTIFIED,spacing:{line:360,after:100},indent:{firstLine:720},widowControl:true,...extra})
const heading=(text,level,extra={})=>new Paragraph({text,heading:level===1?HeadingLevel.HEADING_1:HeadingLevel.HEADING_2,outlineLevel:level-1,keepNext:true,keepLines:true,spacing:{before:level===1?0:220,after:160},...extra})
const caption=(text,figure=false)=>new Paragraph({style:figure?'FigureCaption':'TableCaption',children:[run(text,{bold:true})],spacing:{before:140,after:100,line:280},alignment:figure?AlignmentType.CENTER:AlignmentType.LEFT,keepNext:true,keepLines:true})
const breakable=text=>String(text).replace(/_/g,'_\u200b').replace(/\//g,'/\u200b')
function cell(text,width,{header=false,size=22}={}){
 const lines=String(text).split('\n')
 return new TableCell({width:{size:width,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:lines.map((line,i)=>new Paragraph({children:[run(breakable(line),{size,bold:header})],alignment:AlignmentType.LEFT,spacing:{after:i===lines.length-1?0:40,line:240},widowControl:true,keepLines:true,indent:{firstLine:0}}))})
}
function table(headers,rows,widths,{size=22}={}){
 const border={style:BorderStyle.SINGLE,size:4,color:BLACK}
 return new Table({width:{size:WIDTH,type:WidthType.DXA},layout:TableLayoutType.FIXED,columnWidths:widths,borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},rows:[new TableRow({tableHeader:true,cantSplit:true,children:headers.map((v,i)=>cell(v,widths[i],{header:true,size}))}),...rows.map(row=>new TableRow({cantSplit:true,children:row.map((v,i)=>cell(v,widths[i],{size}))}))]})
}
function entityRows(){
 return Object.keys(entities).map(name=>{
  const t=schema.tables.find(t=>t.name===name),[purpose,fields,access]=entities[name]
  if(!t)throw new Error('Dictionary table missing from actual schema: '+name)
  const pk=t.constraints.find(c=>c.type==='p').definition.replace('PRIMARY KEY','PK')
  const fks=schema.foreignKeys.filter(f=>f.child===name).map(f=>'FK '+f.child_columns.join(', ')+' → '+(f.parent_schema==='public'?'':f.parent_schema+'.')+f.parent+'('+f.parent_columns.join(', ')+')')
  return [name,purpose,fields,[pk,...fks].join('\n'),access]
 })
}
const rpcRows=schema.functions.filter(f=>f.schema==='public').map(f=>{
 const desc=rpcDescriptions[f.name];if(!desc)throw new Error('Undocumented public function '+f.name)
 return [f.name+'('+f.arguments+')\nReturns: '+f.result,...desc]
})
const tableData={
 stack:()=>table(['Component','Technology / tool chosen','Justification / implementation basis'],stackRows,[1550,2800,4676]),
 entities:()=>table(['Table name','Purpose','Key business fields','Primary / foreign keys','Verified access scope'],entityRows(),[1570,1640,1740,2200,1876],{size:21}),
 legal:()=>table(['Area','Implemented evidence','Unresolved review / action'],legalRows,[1550,2850,4626]),
 edge:()=>table(['Function','Method / authentication','Request body','Purpose / response'],edgeRows,[1860,2030,2110,3026],{size:21}),
 rpc:()=>table(['Function signature / result','Grant / required actor','Purpose'],rpcRows,[4100,1960,2966],{size:22}),
 revision:()=>table(['ID','Reconstructed issue','Action taken','Current status','Location / evidence'],matrixRows,[720,1500,2670,1800,2336],{size:21}),
}
const review=[]
const figureIndex=[],tableIndex=[]
async function figure(block){
 const data=await readFile('docs/figures/'+block.figure),img=await loadImage(data)
 const scale=Math.min(600/img.width,675/img.height),w=Math.round(img.width*scale),h=Math.round(img.height*scale)
 figureIndex.push({caption:block.caption,file:block.figure,width:img.width,height:img.height})
 review.push('!['+block.caption+'](../figures/'+block.figure+')\n\n'+block.explain)
 return [new Paragraph({pageBreakBefore:!block.inline,alignment:AlignmentType.CENTER,spacing:{before:block.inline?140:0,after:0},keepNext:true,keepLines:true,children:[new ImageRun({type:'png',data,transformation:{width:w,height:h},altText:{title:block.caption,description:block.explain,name:block.figure}})]}),caption(block.caption,true),body(block.explain,{indent:{firstLine:0},spacing:{line:300,after:100}})]
}
const content=[]
for(const [chapterIndex,chapter] of [...chapters,...additionalChapters,...appendices].entries()){
 content.push(heading(chapter.title,1,{pageBreakBefore:chapterIndex!==0}))
 review.push('# '+chapter.title)
 for(const [name,paragraphs,...blocks]of chapter.sections){
  if(name){content.push(heading(name,2));review.push('## '+name)}
  for(const text of paragraphs){content.push(body(text));review.push(text)}
  for(const block of blocks){
   if(block.figure)content.push(...await figure(block))
   if(block.table){tableIndex.push(block.caption);content.push(caption(block.caption),tableData[block.table]());review.push(block.caption)}
   if(block.references)for(const [i,[author,name,date,url]]of references.entries()){
    const reference=`[${i+1}] ${author}. (${date}). ${name}. ${url}${url.startsWith('https:')?' (Accessed October 14, 2026).':'.'}`
    content.push(body(reference,{indent:{left:400,hanging:400},alignment:AlignmentType.LEFT,spacing:{line:300,after:120}}));review.push(reference)
   }
  }
 }
}
const foot=()=>new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({children:[PageNumber.CURRENT],font:FONT,color:BLACK,size:22})],spacing:{after:0}})]})
const page={size:{width:11906,height:16838},margin:{top:1440,bottom:1440,left:1440,right:1440,header:720,footer:720}}
const front=[]
front.push(new Paragraph({children:[run('TABLE OF CONTENTS',{bold:true,size:32})],alignment:AlignmentType.CENTER,spacing:{after:240},keepNext:true}))
front.push(new TableOfContents(undefined,{headingStyleRange:'1-2',useAppliedParagraphOutlineLevel:true,hyperlink:true}))
front.push(new Paragraph({pageBreakBefore:true,children:[run('LIST OF FIGURES',{bold:true,size:32})],alignment:AlignmentType.CENTER,spacing:{after:240},keepNext:true}))
front.push(new TableOfContents(undefined,{stylesWithLevels:[new StyleLevel('Figure Caption',1)],hyperlink:true}))
front.push(new Paragraph({pageBreakBefore:true,children:[run('LIST OF TABLES',{bold:true,size:32})],alignment:AlignmentType.CENTER,spacing:{after:240},keepNext:true}))
front.push(new TableOfContents(undefined,{stylesWithLevels:[new StyleLevel('Table Caption',1)],hyperlink:true}))
const center=(text,opts={})=>new Paragraph({children:[run(text,opts.run)],alignment:AlignmentType.CENTER,spacing:{line:360,after:opts.after??240,before:opts.before??0},keepLines:true,keepNext:!!opts.keepNext})
const cover=[
 center(title,{before:1300,after:720,run:{size:36,bold:true}}),
 center('In Partial Fulfillment of the Requirements for the Subject',{after:100}),
 center('Web Commercialization and E-Commerce (ELEC5)',{after:480,run:{bold:true}}),
 center("Rodel's Catering Services",{after:650}),
 center('Prepared by',{after:160}),
 ...authors.map(name=>center(name,{after:80})),
 center('Submitted on October 14, 2026',{before:650,after:0}),
]
const tocStyles=[1,2,3].map(n=>({id:'TOC'+n,name:'toc '+n,basedOn:'Normal',run:{font:FONT,size:24,color:BLACK},paragraph:{spacing:{line:280,after:95},indent:{left:(n-1)*260},keepNext:false,widowControl:true}}))
const document=new Document({title,subject:'Web Commercialization and E-Commerce (ELEC5)',creator:authors.join('; '),lastModifiedBy:authors.join('; '),description:'Source-audited documentation with explicit implementation and verification limits.',features:{updateFields:true},styles:{default:{document:{run:{font:FONT,size:24,color:BLACK},paragraph:{spacing:{line:360,after:100},widowControl:true}},heading1:{run:{font:FONT,size:32,bold:true,color:BLACK},paragraph:{spacing:{before:0,after:180},keepNext:true}},heading2:{run:{font:FONT,size:28,bold:true,color:BLACK},paragraph:{spacing:{before:220,after:160},keepNext:true}}},paragraphStyles:[
  {id:'Normal',name:'Normal',run:{font:FONT,size:24,color:BLACK},paragraph:{spacing:{line:360,after:100},widowControl:true}},
  {id:'FigureCaption',name:'Figure Caption',basedOn:'Normal',run:{font:FONT,size:24,bold:true,color:BLACK},paragraph:{keepNext:true}},
  {id:'TableCaption',name:'Table Caption',basedOn:'Normal',run:{font:FONT,size:24,bold:true,color:BLACK},paragraph:{keepNext:true}},
  ...tocStyles,
 ],characterStyles:[{id:'Hyperlink',name:'Hyperlink',run:{font:FONT,color:BLACK,underline:{type:'none'}}},{id:'FollowedHyperlink',name:'FollowedHyperlink',run:{font:FONT,color:BLACK,underline:{type:'none'}}}]},sections:[
  {properties:{page,titlePage:true},children:cover},
  {properties:{page:{...page,pageNumbers:{start:1,formatType:NumberFormat.LOWER_ROMAN}}},footers:{default:foot()},children:front},
  {properties:{page:{...page,pageNumbers:{start:1,formatType:NumberFormat.DECIMAL}}},footers:{default:foot()},children:content},
 ]})
await mkdir('docs/final',{recursive:true})
await writeFile('docs/final/'+filename+'.docx',await Packer.toBuffer(document))
await writeFile('docs/source/document-review.md',review.join('\n\n')+'\n')
await writeFile('docs/source/document-manifest.json',JSON.stringify({title,authors,date:'2026-10-14',chapters:11,publicTables:schema.tables.length,foreignKeys:schema.foreignKeys.length,rpcCount:rpcRows.length,figures:figureIndex,tables:tableIndex,referenceCount:references.length,filename},null,2)+'\n')
console.log(JSON.stringify({docx:'docs/final/'+filename+'.docx',publicTables:schema.tables.length,rpcs:rpcRows.length,figures:figureIndex.length,tables:tableIndex.length,references:references.length}))
