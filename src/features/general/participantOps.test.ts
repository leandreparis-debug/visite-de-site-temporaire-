import { describe, expect, it } from 'vitest'
import {
  addParticipant,
  countPresence,
  insertParticipantAt,
  moveParticipant,
  removeParticipant,
  updateParticipant,
} from '@/features/general/participantOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'

// Fixture: part-1 Jeanne Martin (present), part-2 Paul Durand (absent).
const frozen = () => deepFreeze(makeFullVisit())
const names = (visit: ReturnType<typeof makeFullVisit>) => visit.participants.map((p) => p.name)

describe('participantOps', () => {
  it('never mutates and is deterministic (replay-safe)', () => {
    const visit = frozen()
    const ops = [
      () => addParticipant(visit, { id: 'n', name: ' Zoé ', role: ' ', company: 'ACME ' }),
      () => updateParticipant(visit, 'part-1', { name: 'Jeanne M.', present: false, role: '' }),
      () => removeParticipant(visit, 'part-1'),
      () => insertParticipantAt(visit, { id: 'x', name: 'X', present: true }, 1),
      () => moveParticipant(visit, 'part-2', -1),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('adds a trimmed participant, present by default, ignoring blank names', () => {
    const visit = frozen()
    const added = addParticipant(visit, {
      id: 'n',
      name: '  Zoé Petit ',
      role: ' ',
      company: 'ACME ',
    })
    expect(added.participants.at(-1)).toEqual({
      id: 'n',
      name: 'Zoé Petit',
      company: 'ACME',
      present: true,
    })
    expect(addParticipant(visit, { id: 'm', name: '   ' })).toBe(visit)
    // Replaying the same add (same id) does not duplicate.
    expect(addParticipant(added, { id: 'n', name: 'Zoé Petit' }).participants).toHaveLength(3)
  })

  it('updates fields, removes emptied optional fields, refuses a blank name', () => {
    const visit = frozen()
    const updated = updateParticipant(visit, 'part-1', {
      role: '',
      company: ' Autre ',
      present: false,
    })
    expect(updated.participants[0]).toEqual({
      id: 'part-1',
      name: 'Jeanne Martin',
      company: 'Autre',
      present: false,
    })
    expect(updateParticipant(visit, 'part-1', { name: '  ' })).toBe(visit)
    expect(updateParticipant(visit, 'unknown', { name: 'X' })).toBe(visit)
  })

  it('removes then re-inserts at the same position', () => {
    const visit = frozen()
    const { visit: without, removed, index } = removeParticipant(visit, 'part-1')
    expect(names(without)).toEqual(['Paul Durand'])
    expect(index).toBe(0)
    expect(removed?.name).toBe('Jeanne Martin')
    const restored = insertParticipantAt(without, removed!, index)
    expect(restored.participants).toEqual(visit.participants)
    expect(insertParticipantAt(restored, removed!, index)).toBe(restored)
    expect(removeParticipant(visit, 'unknown')).toEqual({ visit, removed: null, index: -1 })
  })

  it('moves within bounds only', () => {
    const visit = frozen()
    expect(moveParticipant(visit, 'part-1', -1)).toBe(visit)
    expect(moveParticipant(visit, 'part-2', 1)).toBe(visit)
    expect(names(moveParticipant(visit, 'part-1', 1))).toEqual(['Paul Durand', 'Jeanne Martin'])
    expect(names(moveParticipant(visit, 'part-2', -1))).toEqual(['Paul Durand', 'Jeanne Martin'])
  })

  it('counts presence', () => {
    expect(countPresence(frozen().participants)).toEqual({ present: 1, absent: 1 })
  })
})
