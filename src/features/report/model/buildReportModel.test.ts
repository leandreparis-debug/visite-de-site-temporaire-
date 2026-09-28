import { describe, expect, it } from 'vitest'
import { summarizeCostsByStatus } from '@/features/costs/costView'
import { DO_STEP_SEQUENCE, getDeadlineAlerts } from '@/features/do/doView'
import { buildReportModel } from '@/features/report/model/buildReportModel'
import {
  DEFAULT_REPORT_OPTIONS,
  type ReportSection,
  type ReportSectionKey,
} from '@/features/report/model/reportModel'
import { formatEuros } from '@/lib/money'
import { deepFreeze } from '@/test/deepFreeze'
import { makeReportInput, makeReportVisit, REPORT_TODAY } from '@/test/reportFixtures'

function section<K extends ReportSectionKey>(sections: readonly ReportSection[], key: K) {
  const found = sections.find((s) => s.key === key)
  if (!found) throw new Error(`no ${key}`)
  return found as Extract<ReportSection, { key: K }>
}

describe('buildReportModel', () => {
  it('orders and numbers every section of a complete visit', () => {
    const model = buildReportModel(makeReportInput())
    expect(model.sections.map((s) => s.title)).toEqual([
      '1. Synthèse',
      '2. Informations générales',
      '3. Observations par zone',
      '4. Points d’attention et actions',
      '5. Plans annotés',
      '6. Planche photos',
      '7. Dommages-Ouvrage et assurances',
      '8. Projets et coûts',
    ])
    expect(model.fileName).toBe('CR - Entrepôt Lyon Nord - 2026-09-28.docx')
    expect(model.cover).toEqual({
      kindTitle: 'Compte rendu de visite technique',
      title: 'Visite entrepôt Lyon',
      siteLines: ['Entrepôt Lyon Nord', 'Code site : LYN-01', '1 rue du Quai', 'Lyon'],
      dateLine: '28 septembre 2026 à 09h30',
      author: 'Jeanne Martin',
      generatedLine: 'Généré le 28 septembre 2026 à 14h05',
    })
    expect(model.header).toEqual({ siteName: 'Entrepôt Lyon Nord', date: '28/09/2026' })
    expect(model.footer.text).toBe('Document interne — Carrefour Property')
  })

  it('omits empty sections and renumbers the others', () => {
    const visit = makeReportVisit({
      purpose: undefined,
      participants: [],
      noteSections: [{ id: 'x', title: 'Vide', content: '\n  \n', order: 0 }],
      attentionPoints: [],
      doClaims: [],
      insurances: [],
      pins: [],
      nextPinNumber: 1,
    })
    const model = buildReportModel(makeReportInput({ visit, plans: [] }))
    expect(model.sections.map((s) => s.title)).toEqual([
      '1. Synthèse',
      '2. Planche photos',
      '3. Projets et coûts',
    ])
    // A visit with nothing at all: only the cover.
    const empty = makeReportVisit({
      purpose: undefined,
      participants: [],
      noteSections: [],
      attentionPoints: [],
      doClaims: [],
      insurances: [],
      projects: [],
      costs: [],
      pins: [],
      nextPinNumber: 1,
    })
    expect(
      buildReportModel(makeReportInput({ visit: empty, photos: [], plans: [] })).sections,
    ).toEqual([])
  })

  it('respects the options: unchecked section, pinned photos only, photos per page', () => {
    const model = buildReportModel(
      makeReportInput({
        options: {
          sections: { ...DEFAULT_REPORT_OPTIONS.sections, summary: false, notes: false },
          onlyPinnedPhotos: true,
          photosPerPage: 2,
        },
      }),
    )
    expect(model.sections.map((s) => s.key)).toEqual([
      'general',
      'attention',
      'plans',
      'photos',
      'doInsurance',
      'projectsCosts',
    ])
    expect(model.sections[0]?.title).toBe('1. Informations générales')
    const photos = section(model.sections, 'photos')
    expect(photos.perPage).toBe(2)
    // Numbers stay those of the full photo order.
    expect(photos.photos.map((p) => [p.numberLabel, p.pinLabel])).toEqual([
      ['Photo n°1', 'Repère n°1'],
      ['Photo n°2', 'Repère n°2'],
      ['Photo n°3', 'Repère n°3'],
    ])
  })

  it('titles the report according to the kind of visit', () => {
    expect(buildReportModel(makeReportInput()).cover.kindTitle).toBe(
      'Compte rendu de visite technique',
    )
    const meeting = makeReportVisit({ kind: 'meeting', startTime: undefined })
    const cover = buildReportModel(makeReportInput({ visit: meeting })).cover
    expect(cover.kindTitle).toBe('Compte rendu de réunion')
    expect(cover.dateLine).toBe('28 septembre 2026')
  })

  it('splits participants into present and absent', () => {
    const general = section(buildReportModel(makeReportInput()).sections, 'general')
    expect(general.purpose).toBe('Visite annuelle de la toiture et des quais')
    expect(general.present?.rows.map((row) => row.map((c) => c.text))).toEqual([
      ['Jeanne Martin', 'Property Manager', 'Carrefour Property'],
      ['Luc Petit', '', 'Couverture SA'],
    ])
    expect(general.absent?.rows.map((row) => row[0]?.text)).toEqual(['Paul Durand'])
    const allPresent = makeReportVisit({
      participants: [{ id: 'p', name: 'Seul', present: true }],
    })
    expect(
      section(buildReportModel(makeReportInput({ visit: allPresent })).sections, 'general').absent,
    ).toBeNull()
  })

  it('parses the notes in stored order and skips empty sections', () => {
    const notes = section(buildReportModel(makeReportInput()).sections, 'notes')
    expect(notes.zones).toEqual([
      {
        title: 'Toiture',
        blocks: [
          { type: 'paragraph', lines: ['Infiltrations visibles :'] },
          { type: 'bullets', items: ['cellule 3', 'chéneau nord'] },
          { type: 'paragraph', lines: ['À suivre.'] },
        ],
      },
      { title: 'Sprinklage', blocks: [{ type: 'paragraph', lines: ['RAS'] }] },
    ])
  })

  it('sorts attention points like the screen, overdue in red, done in grey', () => {
    const visit = makeReportVisit({
      attentionPoints: [
        { id: 'a', text: 'Fait', priority: 'high', status: 'done' },
        { id: 'b', text: 'En retard', priority: 'medium', status: 'open', dueDate: '2026-09-01' },
        { id: 'c', text: 'Urgent', priority: 'high', status: 'in_progress' },
      ],
    })
    const attention = section(buildReportModel(makeReportInput({ visit })).sections, 'attention')
    expect(attention.summary).toBe('2 ouverts dont 1 en retard')
    expect(attention.table.rows.map((row) => row[1]?.text)).toEqual(['Urgent', 'En retard', 'Fait'])
    expect(attention.table.rows[1]?.[0]).toEqual({
      text: 'À traiter — En retard',
      tone: 'danger',
      bold: true,
    })
    expect(attention.table.rows[1]?.[4]).toEqual({ text: '01/09/2026', tone: 'danger' })
    expect(attention.table.rows[2]?.every((cell) => cell.tone === 'muted')).toBe(true)
  })

  it('lists the pins of each plan sorted by number', () => {
    const plans = section(buildReportModel(makeReportInput()).sections, 'plans')
    expect(plans.plans.map((p) => p.name)).toEqual(['RDC', 'R+1'])
    expect(plans.plans[0]?.pins?.rows.map((row) => row.map((c) => c.text))).toEqual([
      ['1', 'Vue générale toiture', 'Vue générale', ''],
      ['2', 'Chéneau bouché', 'Désordre', ''],
      ['3', 'Descente d’eau pluviale', 'Sécurité', 'Descente EP'],
    ])
    expect(plans.plans[1]?.pins).toBeNull()
  })

  it('describes each photo', () => {
    const photos = section(buildReportModel(makeReportInput()).sections, 'photos')
    expect(photos.perPage).toBe(6)
    expect(photos.photos[1]).toEqual({
      photoId: 'ph-2',
      numberLabel: 'Photo n°2',
      pinLabel: 'Repère n°2',
      caption: 'Chéneau bouché',
      captionMissing: false,
      details: 'Désordre · 15/09/2026 à 10h42',
    })
    expect(photos.photos[3]).toMatchObject({
      numberLabel: 'Photo n°4',
      caption: 'Sans légende',
      captionMissing: true,
      details: 'Équipement',
    })
    expect(photos.photos[3]).not.toHaveProperty('pinLabel')
  })

  it('shows the same DO alerts as doView, and closed claims compactly', () => {
    const base = makeReportVisit()
    const claim = {
      ...base.doClaims[0]!,
      declaredAt: '2026-07-20',
      steps: DO_STEP_SEQUENCE.map((type, i) => ({
        id: `s${i}`,
        type,
        status: i === 0 ? ('done' as const) : ('todo' as const),
        ...(i === 0 && { date: '2026-07-20' }),
      })),
    }
    const closed = {
      ...claim,
      id: 'closed',
      reference: 'DO-OLD',
      steps: [{ id: 'z', type: 'closed' as const, status: 'done' as const }],
    }
    const visit = makeReportVisit({ doClaims: [closed, claim] })
    const doSection = section(buildReportModel(makeReportInput({ visit })).sections, 'doInsurance')
    expect(doSection.claims.map((c) => c.title)).toEqual(['DO-2026-001', 'DO-OLD'])
    const [open, compact] = doSection.claims
    const alerts = getDeadlineAlerts(claim, REPORT_TODAY)
    expect(alerts).toHaveLength(2)
    expect(open?.deadlines?.entries.map((e) => e.text)).toEqual(alerts.map((a) => a.label))
    expect(open?.deadlines?.entries[0]?.tone).toBe('danger')
    expect(open?.deadlines?.intro).toBe('Délais calculés à partir de la déclaration du 20/07/2026.')
    expect(open?.deadlines?.disclaimer).toBe(
      'Délai indicatif (art. L242-1 du Code des assurances), à vérifier selon le contrat.',
    )
    expect(open?.status).toBe('En cours : Accusé de réception de l’assureur — 1 / 10 étapes')
    expect(open?.amounts).toEqual([
      `Montant réclamé : ${formatEuros(1_500_000)}`,
      `Montant indemnisé : ${formatEuros(1_200_000)}`,
    ])
    expect(open?.steps?.rows.slice(0, 2)).toEqual([
      [
        { text: 'Déclaration du sinistre', bold: false },
        { text: 'Terminé', tone: 'success' },
        { text: '20/07/2026' },
        { text: '' },
      ],
      [
        { text: 'Accusé de réception de l’assureur', bold: true },
        { text: 'À faire', tone: 'normal' },
        { text: '' },
        { text: '' },
      ],
    ])
    expect(compact).toMatchObject({ closed: true, steps: null, deadlines: null })
    expect(compact?.status).toBe('Clôturé — 1 / 1 étapes')
    expect(doSection.insurances?.rows[0]?.at(-1)).toEqual({
      text: 'Valide',
      tone: 'success',
      bold: true,
    })
  })

  it('has the same totals as costView, grouped by project with unassigned last', () => {
    const input = makeReportInput()
    const costs = section(buildReportModel(input).sections, 'projectsCosts')
    const { total } = summarizeCostsByStatus(input.visit.costs)
    expect(costs.totalCents).toEqual({
      ht: total.htCents,
      vat: total.vatCents,
      ttc: total.ttcCents,
    })
    const rows = costs.costs!.rows.map((row) => row.map((c) => c.text))
    expect(rows.map((row) => row[0])).toEqual([
      'Réfection toiture — 1 ligne',
      'Devis couvreur',
      'Non rattachés — 1 ligne',
      'Étude structure',
      'Estimations',
      'Devis reçus',
      'Total général',
    ])
    expect(rows.at(-1)).toEqual([
      'Total général',
      '',
      '',
      '',
      formatEuros(total.htCents),
      '',
      formatEuros(total.vatCents),
      formatEuros(total.ttcCents),
    ])
    expect(costs.costs!.rightAligned).toEqual([4, 5, 6, 7])
    expect(costs.projects?.rows.map((row) => row[0]?.text)).toEqual([
      'Réfection toiture',
      'Mise aux normes quais',
    ])
  })

  it('builds a summary from the existing overview modules', () => {
    const summary = section(buildReportModel(makeReportInput()).sections, 'summary')
    expect(summary.items.map((i) => [i.label, i.value.replace(/\s/g, ' ')])).toEqual([
      ['Points d’attention', '2 ouverts'],
      ['Sinistres DO', '1 sinistre en cours'],
      ['Contrats d’assurance', '1 contrat'],
      ['Projets', '0 en cours sur 2 projets'],
      ['Coûts engagés', '0,00 € HT'],
      ['Coûts facturés', '0,00 € HT'],
    ])
  })

  it('is pure: same input, same output, frozen input untouched', () => {
    const input = deepFreeze(makeReportInput())
    const first = buildReportModel(input)
    expect(buildReportModel(input)).toEqual(first)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
  })
})
