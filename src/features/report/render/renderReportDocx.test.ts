// @vitest-environment node
import { crc32, deflateSync } from 'node:zlib'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildReportModel } from '@/features/report/model/buildReportModel'
import {
  buildReportDocument,
  type ReportAssets,
  type ReportImage,
} from '@/features/report/render/renderReportDocx'
import { Packer } from 'docx'
import { formatEuros } from '@/lib/money'
import { makeReportInput, REPORT_PHOTOS, REPORT_PLANS } from '@/test/reportFixtures'

/** A valid solid-colour PNG (distinct bytes per colour: images are deduplicated by hash). */
function png(width: number, height: number, rgb: [number, number, number]): ReportImage {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())])
  const raw = Buffer.concat(Array<Buffer>(height).fill(row))
  const data = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return { data: new Uint8Array(data), type: 'png', width, height }
}

function makeAssets(): ReportAssets {
  return {
    logo: png(120, 40, [0, 78, 159]),
    plans: new Map(REPORT_PLANS.map((plan, i) => [plan.id, png(300, 200, [200, 10 * i, 0])])),
    photos: new Map(REPORT_PHOTOS.map((photo, i) => [photo.id, png(160, 120, [10, 20 * i, 90])])),
  }
}

async function generate(input = makeReportInput()) {
  const model = buildReportModel(input)
  const buffer = await Packer.toBuffer(buildReportDocument(model, makeAssets()))
  const zip = await JSZip.loadAsync(buffer)
  const read = (path: string) => zip.file(path)?.async('string') ?? Promise.resolve('')
  return { model, zip, buffer, read }
}

describe('renderReportDocx', () => {
  it('produces a Word archive with the report content', async () => {
    const { model, zip, buffer, read } = await generate()
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    const document = await read('word/document.xml')
    expect(document).toContain('Entrepôt Lyon Nord')
    expect(document).toContain('Repère n°1')
    for (const section of model.sections)
      expect(document).toContain(section.title.replace('’', '’'))
    // Kind label: small capitals rendered by Word (allCaps), source text unchanged.
    expect(document).toContain('Compte rendu de visite technique')
    expect(document).toContain('<w:caps/>')
    expect(document).toContain('Généré le 28 septembre 2026 à 14h05')
    // Grand total, formatted like on screen.
    const projects = model.sections.find((s) => s.key === 'projectsCosts')
    if (projects?.key !== 'projectsCosts') throw new Error('no costs')
    expect(document).toContain(formatEuros(projects.totalCents.ttc))
    expect(document).toContain('Total général')
    // Every page is portrait: no landscape section, even for the plans.
    expect(document).not.toContain('w:orient="landscape"')
    // Native headings for the navigation pane, no field-based table of contents.
    expect(document).toContain('w:pStyle w:val="Heading1"')
    expect(document).toContain('w:pStyle w:val="Heading2"')
    expect(document).not.toMatch(/TOC \\/)
    // Photos cannot be split across pages.
    expect(document).toContain('<w:cantSplit/>')
    const media = Object.values(zip.files).filter(
      (file) => !file.dir && file.name.startsWith('word/media/'),
    )
    expect(media).toHaveLength(REPORT_PHOTOS.length + REPORT_PLANS.length + 1)
  })

  it('has a header (site, date) and a footer (internal document, page X / Y)', async () => {
    const { zip, read } = await generate()
    const headers = Object.keys(zip.files).filter((p) => /^word\/header\d+\.xml$/.test(p))
    const footers = Object.keys(zip.files).filter((p) => /^word\/footer\d+\.xml$/.test(p))
    expect(headers.length).toBeGreaterThan(0)
    expect(footers.length).toBeGreaterThan(0)
    const header = await read(headers[0]!)
    expect(header).toContain('Entrepôt Lyon Nord')
    expect(header).toContain('28/09/2026')
    const footer = await read(footers[0]!)
    expect(footer).toContain('Document interne — Carrefour Property')
    expect(footer).toContain('PAGE')
    expect(footer).toContain('NUMPAGES')
    // Bullets from the notes use Word's native numbering.
    expect(await read('word/document.xml')).toContain('<w:numPr>')
  })

  it('puts 2, 4 or 6 photos per page, never more', async () => {
    const six = await generate()
    const four = await generate(makeReportInput({ options: { photosPerPage: 4 } }))
    const two = await generate(makeReportInput({ options: { photosPerPage: 2 } }))
    const pageBreaks = async (read: (p: string) => Promise<string>) =>
      ((await read('word/document.xml')).match(/<w:pageBreakBefore\/>/g) ?? []).length
    // 5 photos: 1 page at 6 per page, 2 pages at 4, 3 pages at 2.
    expect((await pageBreaks(four.read)) - (await pageBreaks(six.read))).toBe(1)
    expect((await pageBreaks(two.read)) - (await pageBreaks(six.read))).toBe(2)
  })

  it('shows the site photo on the cover, which has no footer', async () => {
    const plain = await generate()
    const input = makeReportInput()
    const withCover = await generate({
      ...input,
      visit: { ...input.visit, coverPhotoId: 'ph-3' },
    })
    const drawings = (xml: string) => (xml.match(/<w:drawing>/g) ?? []).length
    const [before, after] = await Promise.all([
      plain.read('word/document.xml'),
      withCover.read('word/document.xml'),
    ])
    // One more image in the document, but the same photo is stored once.
    expect(drawings(after) - drawings(before)).toBe(1)
    const media = (zip: JSZip) =>
      Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith('word/media/')).length
    expect(media(withCover.zip)).toBe(media(plain.zip))
    // The cover is the first section: its properties (w:sectPr) carry no footer.
    const firstSection = after.slice(0, after.indexOf('</w:sectPr>'))
    expect(firstSection).not.toContain('w:footerReference')
    expect(firstSection).toContain('Généré le 28 septembre 2026 à 14h05')
  })
})
