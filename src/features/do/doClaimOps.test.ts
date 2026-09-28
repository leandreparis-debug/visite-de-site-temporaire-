import { describe, expect, it } from 'vitest'
import {
  createDoClaim,
  getMissingStepTypes,
  insertDoClaimAt,
  removeDoClaim,
  removeStep,
  restoreStep,
  setStepStatus,
  updateDoClaim,
  updateStep,
} from '@/features/do/doClaimOps'
import { DO_STEP_SEQUENCE } from '@/features/do/doView'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'
import type { Visit } from '@/types/visit'

const STEP_IDS = DO_STEP_SEQUENCE.map((_, i) => `st-${i}`)

/** A frozen visit holding one freshly created claim `new`. */
function withClaim(): Visit {
  return deepFreeze(
    createDoClaim(makeFullVisit({ doClaims: [] }), {
      claimId: 'new',
      stepIds: STEP_IDS,
      description: ' Fissure dallage cellule 2 ',
      reference: ' DO-7 ',
      insurer: '',
      declaredAt: '2026-06-01',
    }),
  )
}

const claimOf = (visit: Visit) => visit.doClaims.find((c) => c.id === 'new')!
const types = (visit: Visit) => claimOf(visit).steps.map((s) => s.type)

describe('doClaimOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = withClaim()
    const ops = [
      () => createDoClaim(visit, { claimId: 'x', stepIds: STEP_IDS, description: 'X' }),
      () => updateDoClaim(visit, 'new', { claimedAmountCents: 100, location: '' }),
      () => removeDoClaim(visit, 'new'),
      () => insertDoClaimAt(visit, { id: 'z', description: 'Z', steps: [] }, 0),
      () => setStepStatus(visit, 'new', 'st-0', 'done', '2026-09-28'),
      () => updateStep(visit, 'new', 'st-1', { date: '2026-06-10', comment: ' ok ' }),
      () => removeStep(visit, 'new', 'st-2'),
      () => restoreStep(visit, 'new', { stepId: 'r', type: 'closed' }),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('creates the 10 standard steps in canonical order with the given ids', () => {
    const claim = claimOf(withClaim())
    expect(claim).toMatchObject({
      id: 'new',
      description: 'Fissure dallage cellule 2',
      reference: 'DO-7',
      declaredAt: '2026-06-01',
    })
    expect(claim).not.toHaveProperty('insurer')
    expect(claim.steps).toEqual(
      DO_STEP_SEQUENCE.map((type, i) => ({ id: `st-${i}`, type, status: 'todo' })),
    )
  })

  it('throws when stepIds has the wrong length, ignores a blank description', () => {
    const visit = deepFreeze(makeFullVisit())
    expect(() =>
      createDoClaim(visit, { claimId: 'x', stepIds: STEP_IDS.slice(1), description: 'X' }),
    ).toThrow(RangeError)
    expect(() =>
      createDoClaim(visit, { claimId: 'x', stepIds: [...STEP_IDS, 'extra'], description: 'X' }),
    ).toThrow(RangeError)
    expect(createDoClaim(visit, { claimId: 'x', stepIds: STEP_IDS, description: '  ' })).toBe(visit)
    // Replay of the same creation does not duplicate.
    const once = withClaim()
    expect(
      createDoClaim(once, { claimId: 'new', stepIds: STEP_IDS, description: 'X' }).doClaims,
    ).toHaveLength(1)
  })

  it('updates claim fields, amounts and refuses invalid values', () => {
    const visit = withClaim()
    const next = updateDoClaim(visit, 'new', {
      claimedAmountCents: 1_250_050,
      compensatedAmountCents: 0,
      reference: '',
      comment: ' Relance faite ',
    })
    expect(claimOf(next)).toMatchObject({
      claimedAmountCents: 1_250_050,
      compensatedAmountCents: 0,
      comment: 'Relance faite',
    })
    expect(claimOf(next)).not.toHaveProperty('reference')
    const cleared = updateDoClaim(next, 'new', { claimedAmountCents: undefined })
    expect(claimOf(cleared)).not.toHaveProperty('claimedAmountCents')
    expect(claimOf(updateDoClaim(visit, 'new', { claimedAmountCents: -1 }))).not.toHaveProperty(
      'claimedAmountCents',
    )
    expect(updateDoClaim(visit, 'new', { claimedAmountCents: 1.5 })).toEqual(visit)
    expect(updateDoClaim(visit, 'new', { description: ' ' })).toBe(visit)
    expect(updateDoClaim(visit, 'new', { declaredAt: '2026-02-30' })).toEqual(visit)
    expect(updateDoClaim(visit, 'unknown', { description: 'X' })).toBe(visit)
  })

  it('removes then re-inserts a claim', () => {
    const visit = withClaim()
    const { visit: without, removed, index } = removeDoClaim(visit, 'new')
    expect(without.doClaims).toEqual([])
    expect(insertDoClaimAt(without, removed!, index)).toEqual(visit)
    expect(removeDoClaim(visit, 'nope')).toEqual({ visit, removed: null, index: -1 })
  })

  it('setStepStatus fills the date only when it is empty', () => {
    const visit = withClaim()
    const done = setStepStatus(visit, 'new', 'st-0', 'done', '2026-09-28')
    expect(claimOf(done).steps[0]).toEqual({
      id: 'st-0',
      type: 'declaration',
      status: 'done',
      date: '2026-09-28',
    })
    const dated = updateStep(visit, 'new', 'st-0', { date: '2026-06-01' })
    expect(claimOf(setStepStatus(dated, 'new', 'st-0', 'done', '2026-09-28')).steps[0]?.date).toBe(
      '2026-06-01',
    )
    // Other statuses never set a date; back to "todo" keeps the date.
    expect(
      claimOf(setStepStatus(visit, 'new', 'st-0', 'in_progress', '2026-09-28')).steps[0],
    ).not.toHaveProperty('date')
    expect(claimOf(setStepStatus(done, 'new', 'st-0', 'todo')).steps[0]?.date).toBe('2026-09-28')
    expect(setStepStatus(visit, 'new', 'unknown', 'done')).toBe(visit)
  })

  it('updates a step date and comment', () => {
    const visit = withClaim()
    const next = updateStep(visit, 'new', 'st-1', { date: '2026-06-10', comment: ' AR reçu ' })
    expect(claimOf(next).steps[1]).toEqual({
      id: 'st-1',
      type: 'acknowledgment',
      status: 'todo',
      date: '2026-06-10',
      comment: 'AR reçu',
    })
    expect(claimOf(updateStep(next, 'new', 'st-1', { date: '', comment: '' })).steps[1]).toEqual({
      id: 'st-1',
      type: 'acknowledgment',
      status: 'todo',
    })
  })

  it('removeStep then restoreStep puts the step back at its canonical position', () => {
    const visit = withClaim()
    const first = removeStep(visit, 'new', 'st-3')
    const second = removeStep(first.visit, 'new', 'st-6')
    expect(first.removed).toEqual({ id: 'st-3', type: 'expertise', status: 'todo' })
    expect(getMissingStepTypes(claimOf(second.visit))).toEqual(['expertise', 'compensation_offer'])

    // "Rétablir une étape" (new id, "À faire").
    const restored = restoreStep(second.visit, 'new', {
      stepId: 'again',
      type: 'compensation_offer',
    })
    expect(types(restored)).toEqual(DO_STEP_SEQUENCE.filter((t) => t !== 'expertise'))
    expect(claimOf(restored).steps[5]).toEqual({
      id: 'again',
      type: 'compensation_offer',
      status: 'todo',
    })

    // Undo keeps the removed step's id, status, date and comment.
    const withData = updateStep(
      setStepStatus(visit, 'new', 'st-0', 'done', '2026-06-02'),
      'new',
      'st-0',
      {
        comment: 'Envoyée en LRAR',
      },
    )
    const gone = removeStep(withData, 'new', 'st-0')
    const back = restoreStep(gone.visit, 'new', { ...gone.removed!, stepId: gone.removed!.id })
    expect(back).toEqual(withData)

    // Last and first positions, and no duplicates.
    const noClose = removeStep(visit, 'new', 'st-9').visit
    expect(types(restoreStep(noClose, 'new', { stepId: 'c', type: 'closed' })).at(-1)).toBe(
      'closed',
    )
    expect(restoreStep(visit, 'new', { stepId: 'dup', type: 'expertise' })).toBe(visit)
    expect(removeStep(visit, 'new', 'nope')).toEqual({ visit, removed: null })
  })

  it('getMissingStepTypes lists removed types in canonical order', () => {
    const visit = withClaim()
    expect(getMissingStepTypes(claimOf(visit))).toEqual([])
    expect(getMissingStepTypes({ steps: [] })).toEqual([...DO_STEP_SEQUENCE])
    // The fixture claim only has 2 steps.
    expect(getMissingStepTypes(makeFullVisit().doClaims[0]!)).toHaveLength(8)
  })
})
