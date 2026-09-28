import { describe, expect, it } from 'vitest'
import {
  addNoteSection,
  insertTemplate,
  moveNoteSection,
  removeNoteSection,
  sortedSections,
  updateNoteSection,
} from '@/features/notes/noteSectionOps'
import { NOTE_TEMPLATES, WAREHOUSE_ZONES } from '@/features/notes/templates'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'
import type { Visit } from '@/types/visit'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`)
const titles = (visit: Visit) => sortedSections(visit).map((s) => s.title)
const orders = (visit: Visit) => sortedSections(visit).map((s) => s.order)

function threeSections(): Visit {
  let visit: Visit = { ...makeFullVisit(), noteSections: [] }
  for (const [id, title] of [
    ['a', 'A'],
    ['b', 'B'],
    ['c', 'C'],
  ] as const) {
    visit = addNoteSection(visit, { id, title })
  }
  return deepFreeze(visit)
}

describe('noteSectionOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = threeSections()
    const ops = [
      () => addNoteSection(visit, { id: 'd', title: 'D' }),
      () => updateNoteSection(visit, 'a', { title: ' A2 ', content: 'x\n- y' }),
      () => removeNoteSection(visit, 'b'),
      () => moveNoteSection(visit, 'c', -1),
      () => insertTemplate(visit, NOTE_TEMPLATES.meeting, ids(4)),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('adds sections at the end with a fallback title', () => {
    const visit = addNoteSection(threeSections(), { id: 'd' })
    expect(titles(visit)).toEqual(['A', 'B', 'C', 'Nouvelle section'])
    expect(orders(visit)).toEqual([0, 1, 2, 3])
  })

  it('updates title (blank refused) and raw content', () => {
    const visit = threeSections()
    const next = updateNoteSection(visit, 'a', { title: '  Toiture ', content: '  - fuite\n' })
    expect(sortedSections(next)[0]).toMatchObject({ title: 'Toiture', content: '  - fuite\n' })
    expect(updateNoteSection(visit, 'a', { title: '  ' })).toBe(visit)
  })

  it('moveNoteSection recomputes order and ignores the bounds', () => {
    const visit = threeSections()
    const moved = moveNoteSection(visit, 'c', -1)
    expect(titles(moved)).toEqual(['A', 'C', 'B'])
    expect(orders(moved)).toEqual([0, 1, 2])
    expect(moveNoteSection(visit, 'a', -1)).toBe(visit)
    expect(moveNoteSection(visit, 'c', 1)).toBe(visit)
  })

  it('removes and renumbers', () => {
    const { visit, removed, index } = removeNoteSection(threeSections(), 'b')
    expect(titles(visit)).toEqual(['A', 'C'])
    expect(orders(visit)).toEqual([0, 1])
    expect(removed?.title).toBe('B')
    expect(index).toBe(1)
  })

  it('insertTemplate skips existing titles (accent/case-insensitive) and counts', () => {
    const base = deepFreeze(
      addNoteSection(
        { ...makeFullVisit(), noteSections: [] },
        { id: 'x', title: 'toiture et ETANCHEITE' },
      ),
    )
    const { visit, added } = insertTemplate(base, NOTE_TEMPLATES.technical_visit, ids(20))
    expect(added).toBe(WAREHOUSE_ZONES.length - 1)
    expect(titles(visit)[0]).toBe('toiture et ETANCHEITE')
    expect(titles(visit)).not.toContain('Toiture et étanchéité')
    expect(titles(visit).slice(1)).toEqual(WAREHOUSE_ZONES.slice(1))
    expect(new Set(visit.noteSections.map((s) => s.id)).size).toBe(WAREHOUSE_ZONES.length)

    const again = insertTemplate(
      visit,
      NOTE_TEMPLATES.technical_visit,
      ids(20).map((id) => `${id}b`),
    )
    expect(again.added).toBe(0)
    expect(again.visit).toBe(visit)
  })
})
