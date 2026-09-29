/*
 * Report files for the demo, matching the API's ReportExporter (CSV / Excel / PDF) without any library:
 * a tiny XLSX (Office Open XML in an uncompressed zip) and a plain one-font PDF.
 */

export interface TabularReport {
  title: string
  subtitle: string
  headers: string[]
  rows: string[][]
}

const BRAND = 'FARO RESTURENT AND COFFE'

// ---- CSV ------------------------------------------------------------------------------------------------

export function toCsv(report: TabularReport) {
  const escape = (v: string) => (/[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [report.headers, ...report.rows].map((row) => row.map(escape).join(','))
  // BOM so Excel opens UTF-8 (₺, ç, ş, ğ …) correctly.
  return new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
}

// ---- XLSX ------------------------------------------------------------------------------------------------

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const isNumber = (value: string) => /^-?\d+(\.\d+)?$/.test(value)

export function toXlsx(report: TabularReport) {
  const col = (i: number) => String.fromCharCode(65 + i)
  const text = (ref: string, value: string, style = 0) => `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`
  const cell = (ref: string, value: string) => (isNumber(value) ? `<c r="${ref}"><v>${value}</v></c>` : text(ref, value))

  const header = 5
  const rows = [
    `<row r="1">${text('A1', BRAND, 1)}</row>`,
    `<row r="2">${text('A2', report.title, 2)}</row>`,
    `<row r="3">${text('A3', report.subtitle, 3)}</row>`,
    `<row r="${header}">${report.headers.map((h, c) => text(`${col(c)}${header}`, h, 4)).join('')}</row>`,
    ...report.rows.map((row, r) => `<row r="${header + 1 + r}">${row.map((v, c) => cell(`${col(c)}${header + 1 + r}`, v)).join('')}</row>`),
  ]
  const widths = report.headers.map((h, c) => Math.min(60, Math.max(h.length, ...report.rows.map((r) => (r[c] ?? '').length)) + 3))
  const cols = widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')

  const ns = 'http://schemas.openxmlformats.org'
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  const sheetName = xml(report.title.slice(0, 31))

  return zip(
    [
      ['[Content_Types].xml', `${head}<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ['_rels/.rels', `${head}<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `${head}<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `${head}<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', `${head}<styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF808080"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
      ['xl/worksheets/sheet1.xml', `${head}<worksheet xmlns="${ns}/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData></worksheet>`],
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Zip archive with stored (uncompressed) entries — all an .xlsx reader needs. */
function zip(files: [name: string, content: string][], type: string) {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const header = (size: number, write: (view: DataView) => void) => {
    const bytes = new Uint8Array(size)
    write(new DataView(bytes.buffer))
    return bytes
  }

  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(content)
    const crc = crc32(data)
    const common = (v: DataView, at: number) => {
      v.setUint16(at, 20, true) // version needed
      v.setUint16(at + 2, 0x0800, true) // UTF-8 names
      v.setUint16(at + 4, 0, true) // stored
      v.setUint16(at + 6, 0, true) // time
      v.setUint16(at + 8, 0x21, true) // date: 1980-01-01
      v.setUint32(at + 10, crc, true)
      v.setUint32(at + 14, data.length, true)
      v.setUint32(at + 18, data.length, true)
      v.setUint16(at + 22, nameBytes.length, true)
    }
    parts.push(
      header(30, (v) => {
        v.setUint32(0, 0x04034b50, true)
        common(v, 4)
      }),
      nameBytes,
      data,
    )
    central.push(
      header(46, (v) => {
        v.setUint32(0, 0x02014b50, true)
        v.setUint16(4, 20, true) // version made by
        common(v, 6)
        v.setUint32(42, offset, true)
      }),
      nameBytes,
    )
    offset += 30 + nameBytes.length + data.length
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0)
  const end = header(22, (v) => {
    v.setUint32(0, 0x06054b50, true)
    v.setUint16(8, files.length, true)
    v.setUint16(10, files.length, true)
    v.setUint32(12, centralSize, true)
    v.setUint32(16, offset, true)
  })
  return new Blob([...parts, ...central, end] as BlobPart[], { type })
}

// ---- PDF -------------------------------------------------------------------------------------------------

/** The standard PDF fonts use WinAnsi (≈ Latin-1); Turkish letters outside it are written without the accent. */
const latin1 = (value: string) =>
  value
    .replace(/[şŞğĞıİ]/g, (c) => ({ ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I' })[c] ?? c)
    .replace(/[–—]/g, '-')
    .replace(/…/g, '\x85')
    .replace(/[^\x20-\xff]/g, '?')

const pdfText = (value: string) => `(${latin1(value).replace(/[\\()]/g, (c) => `\\${c}`)})`

export function toPdf(report: TabularReport, generatedAt: string) {
  const W = 595.28
  const H = 841.89
  const margin = 36
  const rowH = 18
  const tableW = W - 2 * margin
  const weights = report.headers.map((_, i) => (i === 0 ? 2 : 1))
  const unit = tableW / weights.reduce((a, b) => a + b, 0)
  const widths = weights.map((w) => w * unit)

  const fit = (value: string, width: number, size: number) => {
    const max = Math.floor((width - 12) / (size * 0.5))
    return value.length > max ? value.slice(0, Math.max(1, max - 1)) + '…' : value
  }
  const textAt = (x: number, y: number, value: string, size: number, bold = false, color = '0.067 0.067 0.067') =>
    `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfText(value)} Tj ET\n`
  const rect = (x: number, y: number, w: number, h: number, color: string) => `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`

  const pages: string[] = []
  let content = ''
  let y = 0

  const tableHeader = () => {
    content += rect(margin, y - rowH, tableW, rowH, '0.067 0.067 0.067')
    let x = margin
    report.headers.forEach((h, i) => {
      content += textAt(x + 8, y - 12.5, fit(h, widths[i], 10), 10, true, '1 1 1')
      x += widths[i]
    })
    y -= rowH
  }

  const newPage = (first: boolean) => {
    if (content) pages.push(content)
    content = ''
    y = H - margin
    if (first) {
      content += textAt(margin, y - 20, 'FARO', 22, true)
      content += textAt(margin, y - 32, 'RESTURENT AND COFFE', 8, false, '0.4 0.4 0.4')
      content += textAt(margin, y - 56, report.title, 14, true)
      content += textAt(margin, y - 71, report.subtitle, 10, false, '0.4 0.4 0.4')
      y -= 88
    }
    tableHeader()
  }

  newPage(true)
  report.rows.forEach((row, index) => {
    if (y - rowH < margin + 24) newPage(false)
    content += rect(margin, y - rowH, tableW, rowH, index % 2 === 0 ? '1 1 1' : '0.961 0.961 0.961')
    content += rect(margin, y - rowH, tableW, 0.5, '0.898 0.898 0.898')
    let x = margin
    row.forEach((value, i) => {
      content += textAt(x + 8, y - 12.5, fit(value, widths[i], 10), 10)
      x += widths[i]
    })
    y -= rowH
  })
  pages.push(content)

  // Objects: 1 catalog, 2 pages, 3–4 fonts, then a page + content stream per page.
  const objects: string[] = []
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  pages.forEach((body, i) => {
    const footer = `${BRAND} · Generated ${generatedAt} · Page ${i + 1}`
    const stream = body + textAt(W / 2 - footer.length * 2, margin - 14, footer, 8, false, '0.4 0.4 0.4')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`)
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
  })

  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  // Every character is a single byte (Latin-1), so string length = byte length.
  return new Blob([Uint8Array.from(pdf, (c) => c.charCodeAt(0))], { type: 'application/pdf' })
}
