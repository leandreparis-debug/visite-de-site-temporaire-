import { describe, expect, it } from 'vitest'
import { getReportChecks, getReportContents } from '@/features/report/model/reportContents'
import { makeReportInput, makeReportVisit, REPORT_PHOTOS } from '@/test/reportFixtures'

describe('getReportContents', () => {
  it('previews every section with counts', () => {
    const contents = getReportContents(makeReportInput())
    expect(contents.photos).toEqual({ preview: '5 photos (1 sans légende)', empty: false })
    expect(contents.plans).toEqual({ preview: '2 plans, 3 repères', empty: false })
    expect(contents.general.preview).toBe('3 participants (2 présents) · objet renseigné')
    expect(contents.notes.preview).toBe('2 sections')
    expect(contents.doInsurance.preview).toBe('1 contrat · 1 sinistre')
    expect(contents.projectsCosts.preview).toBe('2 projets · 2 lignes de coûts')
  })

  it('marks empty sections, following the photo options', () => {
    const visit = makeReportVisit({ doClaims: [], insurances: [], pins: [], nextPinNumber: 1 })
    const contents = getReportContents(
      makeReportInput({ visit, plans: [], options: { onlyPinnedPhotos: true } }),
    )
    expect(contents.doInsurance).toEqual({ preview: 'vide', empty: true })
    expect(contents.plans.empty).toBe(true)
    // No pinned photo: the photo sheet would be empty.
    expect(contents.photos).toEqual({ preview: 'vide', empty: true })
  })
})

describe('getReportChecks', () => {
  it('lists the points to check, each with its tab', () => {
    const base = makeReportVisit()
    const visit = makeReportVisit({
      author: undefined,
      doClaims: [
        { ...base.doClaims[0]!, declaredAt: undefined },
        { ...base.doClaims[0]!, id: 'c2', claimedAmountCents: 10, compensatedAmountCents: 20 },
      ],
    })
    expect(
      getReportChecks(visit, REPORT_PHOTOS).map((c) => [c.text.replace(/\s/g, ' '), c.tab]),
    ).toEqual([
      [
        'Sinistre DO « DO-2026-001 » : le montant indemnisé (0,20 €) dépasse le montant réclamé (0,10 €).',
        'do-insurance',
      ],
      ['1 photo sans légende', 'photos'],
      ['Sinistre « DO-2026-001 » : date de déclaration non renseignée', 'do-insurance'],
      ['Rédacteur non renseigné', 'general'],
      ['Section de notes « Quais » vide (omise du rapport)', 'notes'],
    ])
  })

  it('is empty for a well-filled visit', () => {
    const visit = makeReportVisit({ noteSections: [] })
    expect(getReportChecks(visit, [{ caption: 'ok' }])).toEqual([])
  })
})
