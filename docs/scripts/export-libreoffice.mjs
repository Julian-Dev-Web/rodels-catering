import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawn} from 'node:child_process'
const root=process.cwd(),name='RodelConnect_ELEC5_Technical_Documentation_2026-10-14'
const input=resolve(root,'docs/final/'+name+'.docx'),output=resolve(root,'docs/final/'+name+'.pdf')
const profile=resolve(root,'docs/.tools/lo-profile'),basic=resolve(profile,'user/basic/Standard')
const log=resolve(root,'docs/qa/converter-result.txt')
await mkdir(basic,{recursive:true});await mkdir('docs/qa',{recursive:true})
await copyFile(input,'docs/qa/pre-conversion.docx')
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const code=`Sub Main
On Error GoTo Failed
Dim options(2) As New com.sun.star.beans.PropertyValue
options(0).Name = "Hidden"
options(0).Value = True
options(1).Name = "UpdateDocMode"
options(1).Value = 3
options(2).Name = "MacroExecutionMode"
options(2).Value = 4
doc = StarDesktop.loadComponentFromURL("${pathToFileURL(input).href}", "_blank", 0, options())
doc.getTextFields().refresh()
indexes = doc.getDocumentIndexes()
For pass = 1 To 2
 doc.refresh()
 For i = 0 To indexes.getCount() - 1
  indexes.getByIndex(i).update()
 Next i
Next pass
doc.store()
Dim filters(2) As New com.sun.star.beans.PropertyValue
filters(0).Name = "UseTaggedPDF"
filters(0).Value = True
filters(1).Name = "ExportBookmarks"
filters(1).Value = True
filters(2).Name = "ReduceImageResolution"
filters(2).Value = False
Dim exportOptions(1) As New com.sun.star.beans.PropertyValue
exportOptions(0).Name = "FilterName"
exportOptions(0).Value = "writer_pdf_Export"
exportOptions(1).Name = "FilterData"
exportOptions(1).Value = filters()
doc.storeToURL("${pathToFileURL(output).href}", exportOptions())
doc.close(True)
Open "${log.replace(/\\/g,'/')}" For Output As #1
Print #1, "Updated indexes, saved editable DOCX and exported PDF."
Close #1
StarDesktop.terminate()
Exit Sub
Failed:
Open "${log.replace(/\\/g,'/')}" For Output As #1
Print #1, "Export error " & Err & ": " & Error$
Close #1
StarDesktop.terminate()
End Sub`
await writeFile(resolve(basic,'Module1.xba'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd"><script:module xmlns:script="http://openoffice.org/2000/script" script:name="Module1" script:language="StarBasic">${esc(code)}</script:module>`)
await writeFile(resolve(basic,'script.xlb'),'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd"><library:library xmlns:library="http://openoffice.org/2000/library" library:name="Standard" library:readonly="false" library:passwordprotected="false"><library:element library:name="Module1"/></library:library>')
await writeFile(resolve(basic,'dialog.xlb'),'<?xml version="1.0" encoding="UTF-8"?><library:library xmlns:library="http://openoffice.org/2000/library" library:name="Standard" library:readonly="false" library:passwordprotected="false"/>')
await writeFile(resolve(profile,'user/basic/script.xlc'),'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE library:libraries PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "libraries.dtd"><library:libraries xmlns:library="http://openoffice.org/2000/library" xmlns:xlink="http://www.w3.org/1999/xlink"><library:library library:name="Standard" xlink:href="$(USER)/basic/Standard/script.xlb/" xlink:type="simple" library:link="false"/></library:libraries>')
const registryPath=resolve(profile,'user/registrymodifications.xcu')
let registry=await readFile(registryPath,'utf8').catch(()=>'<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"></oor:items>')
if(!registry.includes('MacroSecurityLevel'))registry=registry.replace('</oor:items>','<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>0</value></prop></item></oor:items>')
await writeFile(registryPath,registry)
const exe=resolve(root,'docs/.tools/libreoffice/program/soffice.com')
const child=spawn(exe,['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--nologo','--norestore','macro:///Standard.Module1.Main'],{windowsHide:true,stdio:['ignore','pipe','pipe']})
child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d))
const exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res)})
console.log('Converter exit: '+exit)
console.log((await readFile(log,'utf8')).trim())
if(exit!==0)process.exitCode=1
