/**
 * Mechanical translation of the report model into a Word document (`docx`).
 * No business logic here: texts, order, tones and omissions all come from
 * `buildReportModel`; the visual identity from `docxStyles`.
 *
 * Every page is A4 portrait (annotated plans included).
 *
 * Loaded lazily (dynamic import) at the first generation, like pdf.js: the
 * library is inlined in the single file but only evaluated when needed.
 *
 * Word compatibility: native heading styles (navigation pane), no field-based
 * table of contents (it would ask to update fields when opening), only PAGE /
 * NUMPAGES fields in the footer (updated silently by Word), PNG and JPEG
 * images only.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
} from 'docx'
import type {
  Cell,
  DoInsuranceSection,
  NoteBlock,
  ReportModel,
  ReportPhoto,
  ReportSection,
  ReportTable,
  SummaryItem,
  Tone,
} from '../model/reportModel'
import {
  CELL_MARGINS,
  CONTENT_WIDTH,
  FONT_SIZES,
  fitImage,
  IMAGE_BOXES,
  LABEL_SPACING,
  PAGE,
  REPORT_COLORS,
  REPORT_FONT,
  TONE_ACCENTS,
  TONE_COLORS,
} from './docxStyles'

/** An image ready to embed (PNG or JPEG bytes and pixel size). */
export interface ReportImage {
  data: Uint8Array
  type: 'png' | 'jpg'
  width: number
  height: number
}

/** Images referenced by the model: logo, annotated plans and photos, by id. */
export interface ReportAssets {
  logo: ReportImage
  plans: ReadonlyMap<string, ReportImage>
  photos: ReadonlyMap<string, ReportImage>
}

type Block = Paragraph | Table

// ─── Small builders ──────────────────────────────────────────────────────────

interface RunOptions {
  tone?: Tone
  bold?: boolean
  italic?: boolean
  size?: number
  color?: string
  caps?: boolean
}

function run(text: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italic,
    size: options.size,
    allCaps: options.caps,
    characterSpacing: options.caps ? LABEL_SPACING : undefined,
    color: options.color ?? (options.tone ? TONE_COLORS[options.tone] : undefined),
  })
}

/** Small uppercase, letter-spaced label (cover, cards). */
function label(text: string, color: string = REPORT_COLORS.muted): TextRun {
  return run(text, { caps: true, bold: true, size: FONT_SIZES.label, color })
}

function paragraph(
  children: TextRun[] | string,
  options: { spacingAfter?: number; align?: 'right' | 'center'; keepNext?: boolean } = {},
): Paragraph {
  return new Paragraph({
    children: typeof children === 'string' ? [run(children)] : children,
    spacing: { after: options.spacingAfter ?? 120 },
    alignment:
      options.align === 'right'
        ? AlignmentType.RIGHT
        : options.align === 'center'
          ? AlignmentType.CENTER
          : undefined,
    keepNext: options.keepNext,
  })
}

const line = (color: string = REPORT_COLORS.line, size = 4): IBorderOptions => ({
  style: BorderStyle.SINGLE,
  size,
  color,
})
const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: REPORT_COLORS.white }

/**
 * Titre 1 (rule underneath) or Titre 2 (plum accent bar on the left), native
 * Word styles so that the navigation pane lists them.
 */
function heading(
  text: string,
  level: 1 | 2,
  options: { pageBreakBefore?: boolean } = {},
): Paragraph {
  return new Paragraph({
    text,
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    pageBreakBefore: options.pageBreakBefore,
    keepNext: true,
    border:
      level === 1
        ? { bottom: { ...line(REPORT_COLORS.line, 6), space: 6 } }
        : { left: { ...line(REPORT_COLORS.brand, 24), space: 8 } },
  })
}

function image(asset: ReportImage, box: { width: number; height: number }): ImageRun {
  return new ImageRun({
    type: asset.type,
    data: asset.data,
    transformation: fitImage(asset.width, asset.height, box),
  })
}

const NO_BORDERS = {
  top: NONE,
  bottom: NONE,
  left: NONE,
  right: NONE,
  insideHorizontal: NONE,
  insideVertical: NONE,
}

/** Column widths in twips, proportional to `weights`, summing to `total`. */
function columnWidths(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const widths = weights.map((w) => Math.floor((w / sum) * total))
  widths[widths.length - 1] = (widths.at(-1) ?? 0) + total - widths.reduce((a, b) => a + b, 0)
  return widths
}

function spacer(after = 120): Paragraph {
  return new Paragraph({ children: [], spacing: { after } })
}

// ─── Tables and cards ────────────────────────────────────────────────────────

function tableCell(
  cell: Cell,
  width: number,
  options: { right: boolean; header?: boolean },
): TableCell {
  const fill = options.header
    ? REPORT_COLORS.brand
    : cell.shaded
      ? REPORT_COLORS.brandSoft
      : undefined
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        alignment: options.right ? AlignmentType.RIGHT : undefined,
        children: [
          run(cell.text, {
            tone: cell.tone,
            bold: options.header || cell.bold,
            size: FONT_SIZES.table,
            color: options.header ? REPORT_COLORS.white : undefined,
          }),
        ],
      }),
    ],
  })
}

/**
 * A data table: plum header row (repeated on each page), thin horizontal
 * rules only, rows never split.
 */
function dataTable(table: ReportTable): Table {
  const widths = columnWidths(table.widths, CONTENT_WIDTH)
  const right = new Set(table.rightAligned ?? [])
  const row = (cells: readonly Cell[], header: boolean) =>
    new TableRow({
      tableHeader: header,
      cantSplit: true,
      children: cells.map((cell, i) =>
        tableCell(cell, widths[i] ?? 0, { right: right.has(i), header }),
      ),
    })
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: NONE,
      left: NONE,
      right: NONE,
      insideVertical: NONE,
      bottom: line(),
      insideHorizontal: line(),
    },
    margins: CELL_MARGINS,
    rows: [
      row(
        table.headers.map((text) => ({ text })),
        true,
      ),
      ...table.rows.map((cells) => row(cells, false)),
    ],
  })
}

/** A tinted callout with a coloured accent bar on the left (deadlines…). */
function callout(children: Paragraph[], accent: string): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    margins: { top: 140, bottom: 140, left: 220, right: 220 },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: REPORT_COLORS.shade },
            borders: { top: NONE, bottom: NONE, right: NONE, left: line(accent, 36) },
            children: children.length ? children : [new Paragraph('')],
          }),
        ],
      }),
    ],
  })
}

/** Summary as a grid of key-figure cards (2 per row), accent colour by tone. */
function kpiGrid(items: readonly SummaryItem[]): Table {
  const widths = columnWidths([1, 1], CONTENT_WIDTH)
  const gap = line(REPORT_COLORS.white, 48)
  const card = (item: SummaryItem | undefined, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: item
        ? { type: ShadingType.CLEAR, color: 'auto', fill: REPORT_COLORS.shade }
        : undefined,
      borders: item
        ? { top: gap, bottom: gap, right: gap, left: line(TONE_ACCENTS[item.tone], 36) }
        : { top: gap, bottom: gap, right: gap, left: gap },
      margins: { top: 140, bottom: 140, left: 220, right: 160 },
      children: item
        ? [
            paragraph([label(item.label)], { spacingAfter: 40 }),
            paragraph(
              [
                run(item.value, {
                  bold: true,
                  size: FONT_SIZES.kpi,
                  color: item.tone === 'normal' ? REPORT_COLORS.ink : TONE_COLORS[item.tone],
                }),
              ],
              { spacingAfter: 0 },
            ),
          ]
        : [new Paragraph('')],
    })
  const rows: TableRow[] = []
  for (let i = 0; i < items.length; i += 2) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [card(items[i], widths[0] ?? 0), card(items[i + 1], widths[1] ?? 0)],
      }),
    )
  }
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows,
  })
}

// ─── Sections ────────────────────────────────────────────────────────────────

function noteBlocks(blocks: readonly NoteBlock[]): Paragraph[] {
  return blocks.flatMap((block) =>
    block.type === 'bullets'
      ? block.items.map(
          (item) => new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 60 } }),
        )
      : [
          new Paragraph({
            spacing: { after: 120 },
            children: block.lines.map((text, i) => new TextRun({ text, break: i > 0 ? 1 : 0 })),
          }),
        ],
  )
}

function photoCell(
  photo: ReportPhoto,
  asset: ReportImage | undefined,
  large: boolean,
  width: number,
) {
  const imageBox = large ? IMAGE_BOXES.photoLarge : IMAGE_BOXES.photoSmall
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 200, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: asset ? [image(asset, imageBox)] : [run('Image indisponible', { tone: 'muted' })],
      }),
      new Paragraph({
        spacing: { after: 20 },
        children: [
          run(photo.numberLabel, { bold: true, size: FONT_SIZES.small, color: REPORT_COLORS.ink }),
          ...(photo.pinLabel
            ? [
                run(`   ${photo.pinLabel}`, {
                  bold: true,
                  size: FONT_SIZES.small,
                  color: REPORT_COLORS.brand,
                }),
              ]
            : []),
        ],
      }),
      new Paragraph({
        spacing: { after: 20 },
        children: [
          run(photo.caption, {
            size: FONT_SIZES.small,
            tone: photo.captionMissing ? 'muted' : undefined,
            italic: photo.captionMissing,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 0 },
        children: [run(photo.details, { size: FONT_SIZES.label, tone: 'muted' })],
      }),
    ],
  })
}

/**
 * Photo grid: one borderless table per page (2 or 6 photos), rows never
 * split, a page break between pages: no photo is ever cut.
 */
function photoGrid(photos: readonly ReportPhoto[], perPage: 2 | 6, assets: ReportAssets): Block[] {
  const columns = perPage === 2 ? 1 : 2
  const widths = columnWidths(Array<number>(columns).fill(1), CONTENT_WIDTH)
  const blocks: Block[] = []
  for (let start = 0; start < photos.length; start += perPage) {
    const page = photos.slice(start, start + perPage)
    const rows: TableRow[] = []
    for (let i = 0; i < page.length; i += columns) {
      const cells = Array.from({ length: columns }, (_, c) => {
        const photo = page[i + c]
        return photo
          ? photoCell(photo, assets.photos.get(photo.photoId), columns === 1, widths[c] ?? 0)
          : new TableCell({
              width: { size: widths[c] ?? 0, type: WidthType.DXA },
              children: [new Paragraph('')],
            })
      })
      rows.push(new TableRow({ cantSplit: true, children: cells }))
    }
    if (start > 0)
      blocks.push(new Paragraph({ children: [], pageBreakBefore: true, spacing: { after: 0 } }))
    blocks.push(
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: widths,
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows,
      }),
    )
  }
  return blocks
}

function doInsuranceBlocks(section: DoInsuranceSection): Block[] {
  const blocks: Block[] = []
  if (section.insurances) {
    blocks.push(heading('Contrats d’assurance', 2), dataTable(section.insurances), spacer(240))
  }
  for (const claim of section.claims) {
    blocks.push(heading(`Sinistre ${claim.title}${claim.closed ? ' (clôturé)' : ''}`, 2))
    blocks.push(
      paragraph([label(claim.status, claim.closed ? REPORT_COLORS.success : REPORT_COLORS.brand)], {
        spacingAfter: 80,
      }),
    )
    claim.lines.forEach((text, i) =>
      blocks.push(
        paragraph([run(text, { bold: i === 0, color: i === 0 ? REPORT_COLORS.ink : undefined })], {
          spacingAfter: 40,
        }),
      ),
    )
    if (claim.amounts.length)
      blocks.push(
        paragraph([run(claim.amounts.join('    ·    '), { bold: true })], { spacingAfter: 80 }),
      )
    for (const warning of claim.warnings)
      blocks.push(paragraph([run(warning, { tone: 'warning' })]))
    if (claim.steps) blocks.push(dataTable(claim.steps), spacer())
    if (claim.deadlines) {
      const worst = claim.deadlines.entries.some((e) => e.tone === 'danger')
        ? 'danger'
        : claim.deadlines.entries.some((e) => e.tone === 'warning')
          ? 'warning'
          : 'normal'
      blocks.push(
        callout(
          [
            paragraph([label('Délais', REPORT_COLORS.brand)], { spacingAfter: 60 }),
            paragraph([run(claim.deadlines.intro)], { spacingAfter: 60 }),
            ...claim.deadlines.entries.map((entry) =>
              paragraph([run(entry.text, { tone: entry.tone, bold: entry.tone === 'danger' })], {
                spacingAfter: 40,
              }),
            ),
            paragraph(
              [
                run(claim.deadlines.disclaimer, {
                  italic: true,
                  tone: 'muted',
                  size: FONT_SIZES.small,
                }),
              ],
              { spacingAfter: 0 },
            ),
          ],
          TONE_ACCENTS[worst],
        ),
        spacer(280),
      )
    }
  }
  return blocks
}

function sectionBlocks(section: ReportSection, assets: ReportAssets): Block[] {
  const title = heading(section.title, 1)
  switch (section.key) {
    case 'summary':
      return [title, kpiGrid(section.items)]
    case 'general':
      return [
        title,
        ...(section.purpose
          ? [
              paragraph([label('Objet')], { spacingAfter: 40 }),
              paragraph([run(section.purpose)], { spacingAfter: 200 }),
            ]
          : []),
        ...(section.present ? [heading('Présents', 2), dataTable(section.present)] : []),
        ...(section.absent ? [heading('Absents / excusés', 2), dataTable(section.absent)] : []),
      ]
    case 'notes':
      return [
        title,
        ...section.zones.flatMap((zone) => [heading(zone.title, 2), ...noteBlocks(zone.blocks)]),
      ]
    case 'attention':
      return [
        title,
        paragraph([label(section.summary, REPORT_COLORS.brand)], { spacingAfter: 120 }),
        dataTable(section.table),
      ]
    case 'plans':
      // Portrait, one plan per page: title, annotated plan at full width, pins table.
      return section.plans.flatMap((plan, index) => {
        const asset = assets.plans.get(plan.planId)
        return [
          ...(index === 0 ? [heading(section.title, 1, { pageBreakBefore: true })] : []),
          heading(plan.name, 2, { pageBreakBefore: index > 0 }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: asset
              ? [image(asset, IMAGE_BOXES.plan)]
              : [run('Plan indisponible', { tone: 'muted' })],
          }),
          ...(plan.pins ? [dataTable(plan.pins)] : []),
        ]
      })
    case 'photos':
      return [
        heading(section.title, 1, { pageBreakBefore: true }),
        ...photoGrid(section.photos, section.perPage, assets),
      ]
    case 'doInsurance':
      return [heading(section.title, 1, { pageBreakBefore: true }), ...doInsuranceBlocks(section)]
    case 'projectsCosts':
      return [
        title,
        ...(section.projects
          ? [heading('Projets', 2), dataTable(section.projects), spacer(240)]
          : []),
        ...(section.costs ? [heading('Coûts', 2), dataTable(section.costs)] : []),
      ]
  }
}

// ─── Cover, header, footer ───────────────────────────────────────────────────

/** Borderless two-column "label / value" table of the cover. */
function coverFacts(rows: readonly [string, string[]][]): Table {
  const widths = columnWidths([1, 3], CONTENT_WIDTH)
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { ...NO_BORDERS, insideHorizontal: line(), bottom: line(), top: line() },
    margins: { top: 140, bottom: 140, left: 0, right: 100 },
    rows: rows.map(
      ([name, values]) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: widths[0] ?? 0, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.TOP,
              children: [paragraph([label(name)], { spacingAfter: 0 })],
            }),
            new TableCell({
              width: { size: widths[1] ?? 0, type: WidthType.DXA },
              children: values.map((value, i) =>
                paragraph(
                  [
                    run(value, {
                      size: i === 0 ? FONT_SIZES.coverValue : FONT_SIZES.body,
                      bold: i === 0,
                      color: i === 0 ? REPORT_COLORS.ink : REPORT_COLORS.muted,
                    }),
                  ],
                  { spacingAfter: 20 },
                ),
              ),
            }),
          ],
        }),
    ),
  })
}

function coverBlocks(model: ReportModel, assets: ReportAssets): Block[] {
  const { cover } = model
  const [siteName = '', ...siteDetails] = cover.siteLines
  const facts: [string, string[]][] = [
    ['Site', [siteName, ...siteDetails]],
    ['Date', [cover.dateLine]],
    ...(cover.author ? [['Rédacteur', [cover.author]] as [string, string[]]] : []),
  ]
  const band = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    margins: { top: 200, bottom: 200, left: 280, right: 280 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: REPORT_COLORS.brand },
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH - 560 }],
                children: [
                  label(model.footer.text, REPORT_COLORS.white),
                  run(`\t${cover.generatedLine}`, {
                    size: FONT_SIZES.small,
                    color: REPORT_COLORS.white,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
  return [
    new Paragraph({
      spacing: { after: 2200 },
      children: [image(assets.logo, IMAGE_BOXES.coverLogo)],
    }),
    paragraph([label(cover.kindTitle, REPORT_COLORS.brand)], { spacingAfter: 160 }),
    new Paragraph({
      spacing: { after: 360, line: 240, lineRule: LineRuleType.AUTO },
      border: { bottom: { ...line(REPORT_COLORS.brand, 18), space: 14 } },
      children: [
        run(cover.title, { bold: true, size: FONT_SIZES.coverTitle, color: REPORT_COLORS.ink }),
      ],
    }),
    spacer(400),
    coverFacts(facts),
    spacer(3600),
    band,
  ]
}

function pageHeader(model: ReportModel, assets: ReportAssets): Header {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
        border: { bottom: { ...line(), space: 6 } },
        children: [
          image(assets.logo, IMAGE_BOXES.headerLogo),
          run(`\t${model.header.siteName}`, {
            size: FONT_SIZES.small,
            bold: true,
            color: REPORT_COLORS.ink,
          }),
          run(`   ${model.header.date}`, { size: FONT_SIZES.small, tone: 'muted' }),
        ],
      }),
    ],
  })
}

function pageFooter(model: ReportModel): Footer {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
        border: { top: { ...line(), space: 6 } },
        children: [
          run(model.footer.text, { size: FONT_SIZES.label, tone: 'muted' }),
          new TextRun({
            size: FONT_SIZES.small,
            color: REPORT_COLORS.muted,
            children: ['\tPage '],
          }),
          new TextRun({
            size: FONT_SIZES.small,
            bold: true,
            color: REPORT_COLORS.brand,
            children: [PageNumber.CURRENT],
          }),
          new TextRun({
            size: FONT_SIZES.small,
            color: REPORT_COLORS.muted,
            children: [' / ', PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  })
}

const PAGE_PROPERTIES: ISectionOptions['properties'] = {
  page: {
    size: { width: PAGE.width, height: PAGE.height, orientation: PageOrientation.PORTRAIT },
    margin: PAGE.margin,
  },
}

/**
 * Builds the `docx` Document of a report model: cover page (no header or
 * footer), then the content pages, all A4 portrait, with header (logo, site,
 * date) and footer (internal document, "Page X / Y").
 */
export function buildReportDocument(model: ReportModel, assets: ReportAssets): Document {
  const content = model.sections.flatMap((section) => sectionBlocks(section, assets))
  const sections: ISectionOptions[] = [
    { properties: PAGE_PROPERTIES, children: coverBlocks(model, assets) },
    {
      properties: PAGE_PROPERTIES,
      headers: { default: pageHeader(model, assets) },
      footers: { default: pageFooter(model) },
      children: content,
    },
  ]
  return new Document({
    creator: model.cover.author ?? 'Carrefour Property',
    title: `${model.cover.kindTitle} — ${model.cover.title}`,
    description: model.cover.generatedLine,
    styles: {
      default: {
        document: {
          run: { font: REPORT_FONT, size: FONT_SIZES.body, color: REPORT_COLORS.text },
          // lineRule AUTO: an exact line height would clip inline images.
          paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO } },
        },
        heading1: {
          run: {
            font: REPORT_FONT,
            size: FONT_SIZES.heading1,
            bold: true,
            color: REPORT_COLORS.brand,
          },
          paragraph: { spacing: { before: 480, after: 240 } },
        },
        heading2: {
          run: {
            font: REPORT_FONT,
            size: FONT_SIZES.heading2,
            bold: true,
            color: REPORT_COLORS.ink,
          },
          paragraph: { spacing: { before: 320, after: 140 } },
        },
      },
    },
    sections,
  })
}

/** Renders the report model as a .docx Blob. */
export function renderReportDocx(model: ReportModel, assets: ReportAssets): Promise<Blob> {
  return Packer.toBlob(buildReportDocument(model, assets))
}
