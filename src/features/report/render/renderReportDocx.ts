/**
 * Mechanical translation of the report model into a Word document (`docx`).
 * No business logic here: texts, order, tones and omissions all come from
 * `buildReportModel`; styles from `docxStyles`.
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
  Tone,
} from '../model/reportModel'
import {
  CELL_MARGINS,
  contentWidthTwips,
  FONT_SIZES,
  fitImage,
  IMAGE_BOXES,
  PAGE,
  REPORT_COLORS,
  REPORT_FONT,
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

function run(
  text: string,
  options: { tone?: Tone; bold?: boolean; italic?: boolean; size?: number; color?: string } = {},
): TextRun {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italic,
    size: options.size,
    color: options.color ?? (options.tone ? TONE_COLORS[options.tone] : undefined),
  })
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
  })
}

function image(asset: ReportImage, box: { width: number; height: number }): ImageRun {
  return new ImageRun({
    type: asset.type,
    data: asset.data,
    transformation: fitImage(asset.width, asset.height, box),
  })
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: REPORT_COLORS.border }
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: REPORT_COLORS.white }
const GRID_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  insideHorizontal: THIN_BORDER,
  insideVertical: THIN_BORDER,
}
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

/** Column widths in twips, proportional to `weights`, summing to `total`. */
function columnWidths(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const widths = weights.map((w) => Math.floor((w / sum) * total))
  widths[widths.length - 1] = (widths.at(-1) ?? 0) + total - widths.reduce((a, b) => a + b, 0)
  return widths
}

function tableCell(
  cell: Cell,
  width: number,
  options: { right: boolean; header?: boolean },
): TableCell {
  const shaded = options.header || cell.shaded
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shaded
      ? {
          type: ShadingType.CLEAR,
          color: 'auto',
          fill: options.header ? REPORT_COLORS.brandSoft : REPORT_COLORS.shade,
        }
      : undefined,
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        alignment: options.right ? AlignmentType.RIGHT : undefined,
        children: [
          run(cell.text, {
            tone: cell.tone,
            bold: options.header || cell.bold,
            size: FONT_SIZES.table,
            color: options.header ? REPORT_COLORS.brand : undefined,
          }),
        ],
      }),
    ],
  })
}

/** A data table: header row repeated on each page, rows never split. */
function dataTable(table: ReportTable, landscape = false): Table {
  const total = contentWidthTwips(landscape)
  const widths = columnWidths(table.widths, total)
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
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: GRID_BORDERS,
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

/** A framed box (one-cell table): summary, deadlines. */
function box(children: Paragraph[], options: { fill: string; border: string }): Table {
  const total = contentWidthTwips(false)
  const border = { style: BorderStyle.SINGLE, size: 8, color: options.border }
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: [total],
    layout: TableLayoutType.FIXED,
    borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 120, bottom: 120, left: 180, right: 180 },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: total, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: options.fill },
            children: children.length ? children : [new Paragraph('')],
          }),
        ],
      }),
    ],
  })
}

function spacer(after = 120): Paragraph {
  return new Paragraph({ children: [], spacing: { after } })
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
            children: block.lines.map(
              (line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0 }),
            ),
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
  const lines: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: asset ? [image(asset, imageBox)] : [run('Image indisponible', { tone: 'muted' })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [
        run(photo.numberLabel, { bold: true, size: FONT_SIZES.small }),
        ...(photo.pinLabel
          ? [
              run(`  ·  ${photo.pinLabel}`, {
                bold: true,
                size: FONT_SIZES.small,
                color: REPORT_COLORS.brand,
              }),
            ]
          : []),
      ],
    }),
    new Paragraph({
      spacing: { after: 0 },
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
      children: [run(photo.details, { size: FONT_SIZES.small, tone: 'muted' })],
    }),
  ]
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 160, left: 80, right: 80 },
    children: lines,
  })
}

/**
 * Photo grid: one borderless table per page (2 or 6 photos), rows never
 * split, a page break between pages: no photo is ever cut.
 */
function photoGrid(photos: readonly ReportPhoto[], perPage: 2 | 6, assets: ReportAssets): Block[] {
  const columns = perPage === 2 ? 1 : 2
  const total = contentWidthTwips(false)
  const widths = columnWidths(Array<number>(columns).fill(1), total)
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
        width: { size: total, type: WidthType.DXA },
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
    blocks.push(heading('Contrats d’assurance', 2), dataTable(section.insurances), spacer())
  }
  for (const claim of section.claims) {
    blocks.push(heading(`Sinistre ${claim.title}${claim.closed ? ' (clôturé)' : ''}`, 2))
    claim.lines.forEach((line, i) =>
      blocks.push(paragraph([run(line, { bold: i === 0 })], { spacingAfter: 40 })),
    )
    if (claim.amounts.length)
      blocks.push(paragraph(claim.amounts.join('   ·   '), { spacingAfter: 40 }))
    blocks.push(
      paragraph([
        run(claim.status, {
          bold: true,
          color: claim.closed ? REPORT_COLORS.success : REPORT_COLORS.brand,
        }),
      ]),
    )
    for (const warning of claim.warnings)
      blocks.push(paragraph([run(warning, { tone: 'warning' })]))
    if (claim.steps) blocks.push(dataTable(claim.steps), spacer())
    if (claim.deadlines) {
      blocks.push(
        box(
          [
            paragraph([run('Délais', { bold: true, color: REPORT_COLORS.brand })], {
              spacingAfter: 60,
            }),
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
              {
                spacingAfter: 0,
              },
            ),
          ],
          { fill: REPORT_COLORS.shade, border: REPORT_COLORS.border },
        ),
        spacer(240),
      )
    }
  }
  return blocks
}

/** Blocks of one section, split in pages of each orientation. */
interface Part {
  landscape: boolean
  blocks: Block[]
}

function sectionParts(section: ReportSection, assets: ReportAssets, startsPart: boolean): Part[] {
  const title = heading(section.title, 1)
  switch (section.key) {
    case 'summary':
      return [
        {
          landscape: false,
          blocks: [
            title,
            box(
              section.items.map((item) =>
                paragraph(
                  [
                    run(`${item.label} : `, { bold: true }),
                    run(item.value, { tone: item.tone, bold: item.tone === 'danger' }),
                  ],
                  { spacingAfter: 60 },
                ),
              ),
              { fill: REPORT_COLORS.brandSoft, border: REPORT_COLORS.brand },
            ),
          ],
        },
      ]
    case 'general':
      return [
        {
          landscape: false,
          blocks: [
            title,
            ...(section.purpose
              ? [paragraph([run('Objet : ', { bold: true }), run(section.purpose)])]
              : []),
            ...(section.present ? [heading('Présents', 2), dataTable(section.present)] : []),
            ...(section.absent ? [heading('Absents / excusés', 2), dataTable(section.absent)] : []),
          ],
        },
      ]
    case 'notes':
      return [
        {
          landscape: false,
          blocks: [
            title,
            ...section.zones.flatMap((zone) => [
              heading(zone.title, 2),
              ...noteBlocks(zone.blocks),
            ]),
          ],
        },
      ]
    case 'attention':
      return [
        {
          landscape: false,
          blocks: [title, paragraph(section.summary), dataTable(section.table)],
        },
      ]
    case 'plans':
      // One landscape section per plan; the section title on the first one.
      return section.plans.map((plan, index) => {
        const asset = assets.plans.get(plan.planId)
        return {
          landscape: true,
          blocks: [
            ...(index === 0 ? [title] : []),
            heading(plan.name, 2),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: asset
                ? [image(asset, IMAGE_BOXES.plan)]
                : [run('Plan indisponible', { tone: 'muted' })],
            }),
            ...(plan.pins ? [dataTable(plan.pins, true)] : []),
          ],
        }
      })
    case 'photos':
      return [
        {
          landscape: false,
          blocks: [
            heading(section.title, 1, { pageBreakBefore: !startsPart }),
            ...photoGrid(section.photos, section.perPage, assets),
          ],
        },
      ]
    case 'doInsurance':
      return [{ landscape: false, blocks: [title, ...doInsuranceBlocks(section)] }]
    case 'projectsCosts':
      return [
        {
          landscape: false,
          blocks: [
            title,
            ...(section.projects
              ? [heading('Projets', 2), dataTable(section.projects), spacer()]
              : []),
            ...(section.costs ? [heading('Coûts', 2), dataTable(section.costs)] : []),
          ],
        },
      ]
  }
}

// ─── Cover, header, footer ───────────────────────────────────────────────────

function coverBlocks(model: ReportModel, assets: ReportAssets): Block[] {
  const { cover } = model
  const total = contentWidthTwips(false)
  const band = new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: [total],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    margins: { top: 480, bottom: 480, left: 360, right: 360 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: total, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: REPORT_COLORS.brand },
            children: [
              paragraph(
                [
                  run(cover.kindTitle.toUpperCase(), {
                    color: REPORT_COLORS.white,
                    size: FONT_SIZES.coverKind,
                    bold: true,
                  }),
                ],
                {
                  spacingAfter: 240,
                },
              ),
              paragraph(
                [
                  run(cover.title, {
                    color: REPORT_COLORS.white,
                    size: FONT_SIZES.coverTitle,
                    bold: true,
                  }),
                ],
                {
                  spacingAfter: 0,
                },
              ),
            ],
          }),
        ],
      }),
    ],
  })
  const [siteName, ...siteDetails] = cover.siteLines
  return [
    new Paragraph({
      spacing: { after: 1200 },
      children: [image(assets.logo, { width: 400, height: IMAGE_BOXES.coverLogoHeight })],
    }),
    band,
    spacer(720),
    paragraph(
      [run(siteName ?? '', { bold: true, size: FONT_SIZES.coverSite, color: REPORT_COLORS.brand })],
      {
        spacingAfter: 80,
      },
    ),
    ...siteDetails.map((line) =>
      paragraph([run(line, { size: FONT_SIZES.cover })], { spacingAfter: 40 }),
    ),
    spacer(480),
    paragraph([
      run('Date : ', { bold: true, size: FONT_SIZES.cover }),
      run(cover.dateLine, { size: FONT_SIZES.cover }),
    ]),
    ...(cover.author
      ? [
          paragraph([
            run('Rédacteur : ', { bold: true, size: FONT_SIZES.cover }),
            run(cover.author, { size: FONT_SIZES.cover }),
          ]),
        ]
      : []),
    spacer(1200),
    paragraph([run(cover.generatedLine, { tone: 'muted', size: FONT_SIZES.small })]),
  ]
}

function pageHeader(model: ReportModel, assets: ReportAssets, landscape: boolean): Header {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwips(landscape) }],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: REPORT_COLORS.border, space: 4 },
        },
        children: [
          image(assets.logo, { width: 200, height: IMAGE_BOXES.headerLogoHeight }),
          run(`\t${model.header.siteName} — ${model.header.date}`, {
            size: FONT_SIZES.small,
            tone: 'muted',
          }),
        ],
      }),
    ],
  })
}

function pageFooter(model: ReportModel, landscape: boolean): Footer {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwips(landscape) }],
        children: [
          run(model.footer.text, { size: FONT_SIZES.small, tone: 'muted' }),
          new TextRun({
            size: FONT_SIZES.small,
            color: REPORT_COLORS.muted,
            children: ['\tPage ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  })
}

function pageProperties(landscape: boolean): ISectionOptions['properties'] {
  return {
    page: {
      size: {
        width: PAGE.width,
        height: PAGE.height,
        orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
      },
      margin: PAGE.margin,
    },
  }
}

/**
 * Builds the `docx` Document of a report model: cover page (no header or
 * footer), then portrait pages, one landscape section per plan, and header
 * (logo, site, date) / footer (internal document, "Page X / Y") everywhere
 * else.
 */
export function buildReportDocument(model: ReportModel, assets: ReportAssets): Document {
  // Merge consecutive blocks of the same orientation into Word sections.
  const parts: Part[] = []
  for (const section of model.sections) {
    const last = parts.at(-1)
    for (const part of sectionParts(section, assets, !last || last.landscape)) {
      const current = parts.at(-1)
      if (current && !current.landscape && !part.landscape) current.blocks.push(...part.blocks)
      else parts.push({ landscape: part.landscape, blocks: [...part.blocks] })
    }
  }
  const sections: ISectionOptions[] = [
    { properties: pageProperties(false), children: coverBlocks(model, assets) },
    ...parts.map((part) => ({
      properties: pageProperties(part.landscape),
      headers: { default: pageHeader(model, assets, part.landscape) },
      footers: { default: pageFooter(model, part.landscape) },
      children: part.blocks,
    })),
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
          paragraph: { spacing: { line: 264, lineRule: LineRuleType.AUTO } },
        },
        heading1: {
          run: {
            font: REPORT_FONT,
            size: FONT_SIZES.heading1,
            bold: true,
            color: REPORT_COLORS.brand,
          },
          paragraph: { spacing: { before: 360, after: 180 } },
        },
        heading2: {
          run: {
            font: REPORT_FONT,
            size: FONT_SIZES.heading2,
            bold: true,
            color: REPORT_COLORS.text,
          },
          paragraph: { spacing: { before: 240, after: 100 } },
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
