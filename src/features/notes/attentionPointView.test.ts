import { describe, expect, it } from 'vitest'
import {
  formatAttentionSummary,
  isOverdue,
  sortAttentionPointsForDisplay,
  summarizeAttentionPoints,
} from '@/features/notes/attentionPointView'
import { deepFreeze } from '@/test/deepFreeze'
import type { AttentionPoint } from '@/types/visit'

const point = (id: string, fields: Partial<AttentionPoint> = {}): AttentionPoint => ({
  id,
  text: id,
  priority: 'medium',
  status: 'open',
  ...fields,
})

const TODAY = '2026-09-28'

describe('attentionPointView', () => {
  it('sorts: not done first, then priority desc, then due date asc (none last)', () => {
    const points = deepFreeze(
      [
        point('done-high', { status: 'done', priority: 'high' }),
        point('low'),
        point('medium-nodue'),
        point('medium-late', { dueDate: '2026-10-20' }),
        point('medium-early', { dueDate: '2026-10-01' }),
        point('high-progress', { priority: 'high', status: 'in_progress' }),
        point('low-real', { priority: 'low', dueDate: '2026-09-01' }),
      ].map((p) => (p.id === 'low' ? { ...p, priority: 'low' as const } : p)),
    )
    expect(sortAttentionPointsForDisplay(points).map((p) => p.id)).toEqual([
      'high-progress',
      'medium-early',
      'medium-late',
      'medium-nodue',
      'low-real',
      'low',
      'done-high',
    ])
    // Stored order untouched.
    expect(points[0]?.id).toBe('done-high')
  })

  it('isOverdue: false when done or due today, true when due yesterday', () => {
    expect(isOverdue(point('a', { dueDate: '2026-09-27' }), TODAY)).toBe(true)
    expect(isOverdue(point('a', { dueDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdue(point('a', { dueDate: '2026-09-27', status: 'done' }), TODAY)).toBe(false)
    expect(isOverdue(point('a'), TODAY)).toBe(false)
  })

  it('summarizes', () => {
    const summary = summarizeAttentionPoints(
      [
        point('a', { dueDate: '2026-09-01' }),
        point('b', { status: 'in_progress' }),
        point('c'),
        point('d', { status: 'done', dueDate: '2026-01-01' }),
      ],
      TODAY,
    )
    expect(summary).toEqual({ total: 4, open: 3, overdue: 1, done: 1 })
    expect(formatAttentionSummary(summary)).toBe('3 ouverts dont 1 en retard')
    expect(formatAttentionSummary({ total: 1, open: 1, overdue: 0, done: 0 })).toBe('1 ouvert')
    expect(formatAttentionSummary({ total: 2, open: 0, overdue: 0, done: 2 })).toBe(
      'Tous les points sont terminés',
    )
    expect(formatAttentionSummary({ total: 0, open: 0, overdue: 0, done: 0 })).toBe('Aucun point')
  })
})
