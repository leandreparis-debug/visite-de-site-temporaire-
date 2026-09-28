import { describe, expect, it } from 'vitest'
import {
  addInsurance,
  insertInsuranceAt,
  removeInsurance,
  updateInsurance,
} from '@/features/insurance/insuranceOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'

const frozen = () => deepFreeze(makeFullVisit())

describe('insuranceOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = frozen()
    const ops = [
      () => addInsurance(visit, { id: 'n', type: 'multirisque', insurer: ' AXA ', broker: ' ' }),
      () => updateInsurance(visit, 'ins-1', { policyNumber: 'P-1', endDate: '' }),
      () => removeInsurance(visit, 'ins-1'),
      () => insertInsuranceAt(visit, { id: 'z', type: 'other', insurer: 'Z' }, 0),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('adds a cleaned contract and refuses a blank insurer', () => {
    const visit = frozen()
    const next = addInsurance(visit, {
      id: 'n',
      type: 'responsabilite_civile',
      insurer: '  AXA France ',
      policyNumber: ' RC-42 ',
      broker: '   ',
      endDate: '2027-01-01',
      startDate: 'pas une date',
    })
    expect(next.insurances.at(-1)).toEqual({
      id: 'n',
      type: 'responsabilite_civile',
      insurer: 'AXA France',
      policyNumber: 'RC-42',
      endDate: '2027-01-01',
    })
    expect(addInsurance(visit, { id: 'm', type: 'other', insurer: '  ' })).toBe(visit)
    // Replaying the same add (same id) does not duplicate.
    expect(addInsurance(next, { id: 'n', type: 'other', insurer: 'X' }).insurances).toHaveLength(2)
  })

  it('updates, clears optional fields, refuses blank insurer and inverted dates', () => {
    const visit = frozen()
    const next = updateInsurance(visit, 'ins-1', {
      type: 'multirisque',
      broker: ' Courtage SA ',
      startDate: '',
    })
    expect(next.insurances[0]).toEqual({
      id: 'ins-1',
      type: 'multirisque',
      insurer: 'Assureur SA',
      broker: 'Courtage SA',
      endDate: '2034-01-01',
    })
    expect(updateInsurance(visit, 'ins-1', { insurer: ' ' })).toBe(visit)
    expect(updateInsurance(visit, 'ins-1', { endDate: '2023-12-31' })).toBe(visit)
    expect(updateInsurance(visit, 'unknown', { insurer: 'X' })).toBe(visit)
  })

  it('removes then re-inserts at the same position', () => {
    const visit = frozen()
    const withTwo = addInsurance(visit, { id: 'n', type: 'other', insurer: 'B' })
    const { visit: removed, removed: item, index } = removeInsurance(withTwo, 'ins-1')
    expect(removed.insurances.map((i) => i.id)).toEqual(['n'])
    expect(index).toBe(0)
    expect(insertInsuranceAt(removed, item!, index)).toEqual(withTwo)
    expect(insertInsuranceAt(withTwo, item!, 1)).toBe(withTwo)
    expect(removeInsurance(visit, 'unknown')).toEqual({ visit, removed: null, index: -1 })
  })
})
