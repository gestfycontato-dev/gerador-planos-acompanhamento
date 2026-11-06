import fs from 'node:fs/promises'
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const input = await FileBlob.load('plano-terapeutico-referencia.xlsx')
const workbook = await SpreadsheetFile.importXlsx(input)
const sheets = workbook.worksheets.items
console.log(JSON.stringify(sheets.map(s => ({ name: s.name, used: s.getUsedRange()?.address })), null, 2))
for (const sheet of sheets) {
  const used = sheet.getUsedRange()
  if (used) {
    const check = await workbook.inspect({ kind: 'table', range: `${sheet.name}!${used.address.split('!').pop()}`, include: 'values,formulas', tableMaxRows: 100, tableMaxCols: 30 })
    console.log(check.ndjson)
    const image = await workbook.render({ sheetName: sheet.name, autoCrop: 'all', scale: 1.4, format: 'png' })
    await fs.writeFile(`template-${sheet.name.replace(/[^a-z0-9]/gi,'_')}.png`, new Uint8Array(await image.arrayBuffer()))
  }
}
