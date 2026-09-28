import { describe, expect, it } from 'vitest'
import {
  addAttentionPoint,
  insertAttentionPointAt,
  removeAttentionPoint,
  updateAttentionPoint,
} from '@/features/notes/attentionPointOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'

describe('attentionPointOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = deepFreeze(makeFullVisit())
    const ops = [
      () =>
        addAttentionPoint(visit, { id: 'n', text: ' Fuite ', owner: ' ', dueDate: '2026-10-01' }),
      () => updateAttentionPoint(visit, 'ap-1', { status: 'done', owner: 'Moi', dueDate: '' }),
      () => removeAttentionPoint(visit, 'ap-2'),
      () =>
        insertAttentionPointAt(visit, { id: 'z', text: 'Z', priority: 'low', status: 'open' }, 0),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('adds with defaults and ignores blank text', () => {
    const visit = deepFreeze(makeFullVisit())
    const next = addAttentionPoint(visit, { id: 'n', text: '  Fuite quai 3 ', owner: '  ' })
    expect(next.attentionPoints.at(-1)).toEqual({
      id: 'n',
      text: 'Fuite quai 3',
      priority: 'medium',
      status: 'open',
    })
    expect(addAttentionPoint(visit, { id: 'm', text: ' ' })).toBe(visit)
  })

  it('updates, clears optional fields, refuses blank text and invalid dates', () => {
    const visit = deepFreeze(makeFullVisit())
    const next = updateAttentionPoint(visit, 'ap-1', { status: 'in_progress', dueDate: '' })
    expect(next.attentionPoints[0]).toEqual({
      id: 'ap-1',
      text: 'Reprendre l’étanchéité',
      priority: 'high',
      status: 'in_progress',
    })
    expect(updateAttentionPoint(visit, 'ap-1', { text: '' })).toBe(visit)
    expect(
      updateAttentionPoint(visit, 'ap-1', { dueDate: '2026-13-01' }).attentionPoints[0]?.dueDate,
    ).toBe('2026-10-15')
  })

  it('removes and re-inserts at the same position', () => {
    const visit = deepFreeze(makeFullVisit())
    const { visit: without, removed, index } = removeAttentionPoint(visit, 'ap-2')
    expect(without.attentionPoints.map((p) => p.id)).toEqual(['ap-1', 'ap-3'])
    expect(insertAttentionPointAt(without, removed!, index).attentionPoints).toEqual(
      visit.attentionPoints,
    )
  })
})
