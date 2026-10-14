import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../.tools/package.json',import.meta.url))
const JSZip=require('jszip')
const filename='RodelConnect_ELEC5_Technical_Documentation_2026-10-14'
const zip=await JSZip.loadAsync(await readFile('docs/final/'+filename+'.docx'))
const xml=await zip.file('word/document.xml').async('string')
const styles=await zip.file('word/styles.xml').async('string')
const text=xml.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
const secrets=[['provider secret',/\b(?:sk_test_|sk_live_|whsk_)[A-Za-z0-9]+/g],['JWT',/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g],['private test account email',/\b(?:superadmin|manger|manager|guest)@test\.com\b/gi]]
const scans=secrets.map(([label,pattern])=>({label,found:pattern.test(text)}))
const colors=[...new Set([...xml.matchAll(/<w:color\b[^>]*w:val="([^"]+)"/g)].map(m=>m[1]))]
const report={file:filename+'.docx',bodyColors:colors,heading1Count:(xml.match(/w:pStyle w:val="Heading1"/g)||[]).length,heading2Count:(xml.match(/w:pStyle w:val="Heading2"/g)||[]).length,repeatTableHeaders:(xml.match(/<w:tblHeader/g)||[]).length,cantSplitRows:(xml.match(/<w:cantSplit/g)||[]).length,tocInstructions:[...xml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)].map(m=>m[1]).filter(s=>s.includes('TOC')),scans}
if(scans.some(s=>s.found)||colors.some(c=>!['000000','auto'].includes(c)))throw new Error('Document contains an unexpected secret identifier or text color')
await mkdir('docs/qa',{recursive:true})
await writeFile('docs/qa/docx-inspection.json',JSON.stringify(report,null,2)+'\n')
await writeFile('docs/qa/docx-text.txt',text)
await writeFile('docs/qa/docx-styles.xml',styles)
console.log(JSON.stringify(report))
