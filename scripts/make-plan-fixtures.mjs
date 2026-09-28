#!/usr/bin/env node
/**
 * Generates the plan test files in tests/fixtures/plans/:
 * - entrepot-2-pages.pdf : 2-page A3 "warehouse plan" (thin lines, text), by Chromium `page.pdf()`;
 * - plan-rdc.png         : the same drawing as a PNG (screenshot);
 * - protege.pdf          : a password-protected PDF (standard security handler, RC4 40-bit),
 *                          written byte by byte (Chromium cannot encrypt PDFs);
 * - corrompu.pdf         : a truncated / invalid PDF.
 *
 * Run: `node scripts/make-plan-fixtures.mjs` (PW_CHROMIUM_PATH to use an installed Chromium).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const outDir = resolve(fileURLToPath(new URL('../tests/fixtures/plans', import.meta.url)))
mkdirSync(outDir, { recursive: true })

/** A warehouse-like drawing: cells, docks, thin grid lines and labels. */
function planSvg(title, cells) {
  const lines = []
  for (let x = 40; x <= 1560; x += 40)
    lines.push(`<line x1="${x}" y1="40" x2="${x}" y2="1060" stroke="#bbb" stroke-width="0.4"/>`)
  for (let y = 40; y <= 1060; y += 40)
    lines.push(`<line x1="40" y1="${y}" x2="1560" y2="${y}" stroke="#bbb" stroke-width="0.4"/>`)
  const rects = Array.from({ length: cells }, (_, i) => {
    const x = 80 + i * (1440 / cells)
    return `<rect x="${x}" y="160" width="${1440 / cells - 20}" height="700" fill="none" stroke="#111" stroke-width="2"/>
      <text x="${x + 20}" y="200" font-size="22" font-family="Arial">Cellule ${i + 1}</text>`
  }).join('')
  const docks = Array.from({ length: 12 }, (_, i) => {
    const x = 100 + i * 115
    return `<rect x="${x}" y="880" width="80" height="60" fill="#e5e5e5" stroke="#111" stroke-width="1"/>
      <text x="${x + 10}" y="920" font-size="14" font-family="Arial">Quai ${i + 1}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" width="100%" height="100%">
    <rect width="1600" height="1100" fill="white"/>${lines.join('')}${rects}${docks}
    <text x="80" y="110" font-size="40" font-family="Arial" font-weight="bold">${title}</text>
    <text x="1180" y="1040" font-size="12" font-family="Arial">Échelle 1/500 — Entrepôt de test — ne pas utiliser</text>
  </svg>`
}

const html = `<!doctype html><html><head><style>
  @page { size: 420mm 297mm; margin: 0 }
  html, body { margin: 0 }
  .page { width: 420mm; height: 297mm; page-break-after: always; overflow: hidden }
  .page:last-child { page-break-after: auto }
</style></head><body>
  <div class="page">${planSvg('Plan RDC — Entrepôt Lyon Nord', 4)}</div>
  <div class="page">${planSvg('Plan Mezzanine — page 2', 6)}</div>
</body></html>`

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
await page.setContent(html)
const pdf = await page.pdf({ width: '420mm', height: '297mm', printBackground: true })
await page.setContent(`<body style="margin:0">${planSvg('Plan RDC (image PNG)', 3)}</body>`)
const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1600, height: 1100 } })
await browser.close()

// ─── Password-protected PDF (Standard security handler, V1/R2, RC4 40-bit) ─────
const PADDING = Buffer.from(
  '28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a',
  'hex',
)
const md5 = (...parts) => createHash('md5').update(Buffer.concat(parts)).digest()
function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = Buffer.alloc(data.length)
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255
    j = (j + s[i]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255]
  }
  return out
}
const pad = (password) => Buffer.concat([Buffer.from(password, 'latin1'), PADDING]).subarray(0, 32)

function protectedPdf(userPassword, ownerPassword) {
  const id = md5(Buffer.from('cp-compte-rendu-fixture'))
  const P = -44 // print + copy disallowed bits cleared; any value works for the test
  const O = rc4(md5(pad(ownerPassword)).subarray(0, 5), pad(userPassword))
  const pBytes = Buffer.alloc(4)
  pBytes.writeInt32LE(P)
  const key = md5(pad(userPassword), O, pBytes, id).subarray(0, 5)
  const U = rc4(key, PADDING)
  const hex = (b) => `<${b.toString('hex')}>`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
    `<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${P} >>`,
  ]
  let body = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body, 'latin1')
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R /ID [${hex(id)} ${hex(id)}] >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

const files = {
  'entrepot-2-pages.pdf': pdf,
  'plan-rdc.png': png,
  'protege.pdf': protectedPdf('secret', 'owner-secret'),
  'corrompu.pdf': Buffer.concat([
    pdf.subarray(0, 400),
    Buffer.from('\n%% fichier tronqué et corrompu %%\n'),
  ]),
}
for (const [name, bytes] of Object.entries(files)) {
  writeFileSync(join(outDir, name), bytes)
  console.log(`${name.padEnd(24)} ${(bytes.length / 1024).toFixed(1)} Ko`)
}
