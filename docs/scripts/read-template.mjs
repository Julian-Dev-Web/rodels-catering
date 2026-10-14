import { readFile, writeFile } from 'node:fs/promises'
import { getDocument } from '../.tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
const path = 'C:/Users/AMD/Downloads/elec5 technical documentation (1).pdf'
const loading = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: true })
const pdf = await loading.promise
const pages = []
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number)
  const text = await page.getTextContent()
  pages.push(text.items.map((item) => item.str + (item.hasEOL ? '\n' : ' ')).join(''))
}
await writeFile('docs/source/required-template.txt', pages.join('\n\nPAGE BREAK\n\n'))
console.log(JSON.stringify({ pages: pdf.numPages }))
console.log(pages.join('\n\n'))
await loading.destroy()
