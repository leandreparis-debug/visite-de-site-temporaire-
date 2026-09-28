import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/lib/errors'
import { parseOrThrow } from '@/lib/validation'
import { makeFullVisit } from '@/test/fixtures'
import { pinSchema } from '@/types/media'
import { getVisitWarnings, visitSchema, type Visit } from '@/types/visit'

function issuesOf(data: unknown) {
  const result = visitSchema.safeParse(data)
  expect(result.success).toBe(false)
  return result.error?.issues ?? []
}

describe('visitSchema', () => {
  it('accepts a complete valid visit', () => {
    const visit = makeFullVisit()
    expect(visitSchema.parse(visit)).toEqual(visit)
  })

  it('rejects an empty title with a French message', () => {
    const issues = issuesOf(makeFullVisit({ title: '   ' }))
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toEqual(['title'])
    expect(issues[0]?.message).toBe('Le titre est obligatoire')
  })

  it('rejects a title longer than 200 characters', () => {
    const [issue] = issuesOf(makeFullVisit({ title: 'x'.repeat(201) }))
    expect(issue?.message).toBe('Le titre ne doit pas dépasser 200 caractères')
  })

  it('rejects endDate before startDate (projects and insurances)', () => {
    const visit = makeFullVisit()
    const invalid: Visit = {
      ...visit,
      projects: [
        {
          id: 'p',
          name: 'Projet',
          status: 'planned',
          startDate: '2026-05-01',
          endDate: '2026-04-30',
        },
      ],
      costs: [],
      insurances: [
        {
          id: 'i',
          type: 'multirisque',
          insurer: 'X',
          startDate: '2026-05-01',
          endDate: '2025-01-01',
        },
      ],
    }
    const issues = issuesOf(invalid)
    expect(issues.map((i) => i.path)).toEqual([
      ['insurances', 0, 'endDate'],
      ['projects', 0, 'endDate'],
    ])
    expect(issues[0]?.message).toBe(
      'La date de fin doit être postérieure ou égale à la date de début',
    )
  })

  it('accepts endDate equal to startDate', () => {
    const visit = makeFullVisit()
    visit.projects[0] = { ...visit.projects[0]!, startDate: '2026-05-01', endDate: '2026-05-01' }
    expect(visitSchema.safeParse(visit).success).toBe(true)
  })

  it('rejects a non-integer amount', () => {
    const visit = makeFullVisit()
    visit.costs[0] = { ...visit.costs[0]!, amountHtCents: 12.5 }
    const [issue] = issuesOf(visit)
    expect(issue?.path).toEqual(['costs', 0, 'amountHtCents'])
    expect(issue?.message).toBe('Le montant doit être un nombre entier de centimes')
  })

  it('rejects negative amounts and invalid VAT rates', () => {
    const visit = makeFullVisit()
    visit.costs[0] = { ...visit.costs[0]!, amountHtCents: -1, vatRateBp: 20.5 }
    expect(issuesOf(visit).map((i) => i.path.join('.'))).toEqual([
      'costs.0.amountHtCents',
      'costs.0.vatRateBp',
    ])
  })

  it('defaults the VAT rate to 20 %', () => {
    const visit = makeFullVisit()
    const { vatRateBp: _omitted, ...costWithoutVat } = visit.costs[1]!
    const parsed = visitSchema.parse({ ...visit, costs: [visit.costs[0], costWithoutVat] })
    expect(parsed.costs[1]?.vatRateBp).toBe(2000)
  })

  it('rejects pin coordinates outside 0–1', () => {
    const pin = { id: 'p', planId: 'pl', photoId: 'ph', x: 1.2, y: -0.1, number: 1 }
    const result = pinSchema.safeParse(pin)
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['x', 'y'])
    expect(result.error?.issues[0]?.message).toBe('La coordonnée doit être comprise entre 0 et 1')

    const visit = makeFullVisit({ pins: [pin] })
    expect(issuesOf(visit).map((i) => i.path.join('.'))).toEqual(['pins.0.x', 'pins.0.y'])
  })

  it('rejects duplicate pin numbers and pin numbers < 1', () => {
    const base = { planId: 'pl', photoId: 'ph', x: 0.5, y: 0.5 }
    const issues = issuesOf(
      makeFullVisit({
        pins: [
          { ...base, id: 'a', number: 1 },
          { ...base, id: 'b', number: 1 },
          { ...base, id: 'c', number: 0 },
        ],
      }),
    )
    expect(issues.map((i) => i.path.join('.')).sort()).toEqual(['pins.1.number', 'pins.2.number'])
    const duplicates = issuesOf(
      makeFullVisit({
        nextPinNumber: 4,
        pins: [
          { ...base, id: 'a', number: 3 },
          { ...base, id: 'b', number: 3 },
        ],
      }),
    )
    expect(duplicates.map((i) => i.message)).toEqual(['Le numéro de repère 3 est déjà utilisé'])
  })

  it('rejects a pin counter not greater than every pin number', () => {
    const issues = issuesOf(makeFullVisit({ nextPinNumber: 1 }))
    expect(issues.map((i) => i.path.join('.'))).toEqual(['nextPinNumber'])
    expect(issues[0]?.message).toBe('Le compteur de repères doit être supérieur au numéro 1')
  })

  it('rejects a cost linked to an unknown project', () => {
    const visit = makeFullVisit()
    visit.costs[0] = { ...visit.costs[0]!, projectId: 'unknown' }
    expect(issuesOf(visit).map((i) => i.path.join('.'))).toEqual(['costs.0.projectId'])
  })

  it('rejects invalid dates, times and schema versions', () => {
    const issues = issuesOf({
      ...makeFullVisit(),
      date: '2026-02-30',
      startTime: '25:00',
      schemaVersion: 2,
    })
    expect(issues.map((i) => i.path.join('.')).sort()).toEqual([
      'date',
      'schemaVersion',
      'startTime',
    ])
  })

  it('produces a ValidationError listing French field labels', () => {
    const visit = makeFullVisit({ title: '' })
    visit.costs[1] = { ...visit.costs[1]!, amountHtCents: 0.5 }
    try {
      parseOrThrow(visitSchema, visit)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validation = error as ValidationError
      expect(validation.issues.map((i) => i.field)).toEqual(['Titre', 'Coûts n°2 › Montant HT'])
      expect(validation.userMessage).toContain('Titre : Le titre est obligatoire')
      expect(validation.userMessage).toContain(
        'Coûts n°2 › Montant HT : Le montant doit être un nombre entier de centimes',
      )
      expect(validation.message).toMatch(/^Validation failed: title: /)
    }
  })
})

describe('getVisitWarnings', () => {
  it('returns no warning for consistent amounts', () => {
    expect(getVisitWarnings(makeFullVisit())).toEqual([])
  })

  it('warns when the compensated amount exceeds the claimed amount', () => {
    const visit = makeFullVisit()
    visit.doClaims[0] = {
      ...visit.doClaims[0]!,
      claimedAmountCents: 100_000,
      compensatedAmountCents: 150_000,
    }
    // A warning, not an error: the visit is still valid.
    expect(visitSchema.safeParse(visit).success).toBe(true)
    const warnings = getVisitWarnings(visit).map((w) => w.replace(/[\u00a0\u202f]/g, ' '))
    expect(warnings).toEqual([
      'Sinistre DO « DO-2026-001 » : le montant indemnisé (1 500,00 €) dépasse le montant réclamé (1 000,00 €).',
    ])
  })
})
