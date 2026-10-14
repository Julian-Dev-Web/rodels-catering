import {readFile,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
const require=createRequire(new URL('../.tools/package.json',import.meta.url))
const JSZip=require('jszip')
const manifest=JSON.parse(await readFile('docs/source/document-manifest.json','utf8'))
const pdfQA=JSON.parse(await readFile('docs/qa/pdf-inspection.json','utf8'))
const docxQA=JSON.parse(await readFile('docs/qa/docx-inspection.json','utf8'))
if(pdfQA.secretFound||pdfQA.pageReports.some(p=>p.boundsWarnings.length)||docxQA.scans.some(s=>s.found))throw new Error('Document QA checks have unresolved failures')
if(pdfQA.pageReports[1].textItems<20)throw new Error('Automatic contents were not populated')
const basename=manifest.filename
const files=[
 'README.md','PPT_AND_PROCEEDINGS_PROMPT.md','revision-action-matrix.md','evidence-audit.md','gaps-and-questions.md','rendered-qa.md',
 'final/'+basename+'.docx','final/'+basename+'.pdf',
 'source/schema-manifest.json','source/dependency-versions.json',
 ...manifest.figures.map(f=>'figures/'+f.file),
]
const zip=new JSZip(),entries=[]
for(const file of files){const data=await readFile('docs/'+file);zip.file(file,data);entries.push({file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')})}
const finalManifest={date:'2026-10-14',title:manifest.title,authors:manifest.authors,pages:pdfQA.pages,figures:manifest.figures.length,tables:manifest.tables.length,publicTables:manifest.publicTables,foreignKeys:manifest.foreignKeys,publicRPCs:manifest.rpcCount,references:manifest.referenceCount,entries}
zip.file('artifact-manifest.json',JSON.stringify(finalManifest,null,2)+'\n')
await writeFile('docs/final/artifact-manifest.json',JSON.stringify(finalManifest,null,2)+'\n')
const out='docs/final/RodelConnect_ELEC5_Presentation_Source_Pack_2026-10-14.zip'
const data=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}})
await writeFile(out,data)
console.log(JSON.stringify({zip:out,bytes:data.length,entries:files.length,pages:pdfQA.pages}))
