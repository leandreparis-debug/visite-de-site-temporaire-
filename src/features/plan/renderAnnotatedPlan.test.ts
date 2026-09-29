import { describe, expect, it } from 'vitest'
import {
  annotatedPinDiameter,
  annotatedPlanFileName,
  legendRowsFor,
} from '@/features/plan/renderAnnotatedPlan'

describe('annotated plan helpers', () => {
  it('sizes pins at ~4 % of the long side, 32 px minimum', () => {
    expect(annotatedPinDiameter(3000)).toBe(120)
    expect(annotatedPinDiameter(1000)).toBe(40)
    expect(annotatedPinDiameter(500)).toBe(32)
  })

  it('lists only the categories present in the legend', () => {
    expect(legendRowsFor(['defect', 'other', 'defect']).map((row) => row.categories)).toEqual([
      ['defect'],
      ['general', 'other'],
    ])
    expect(legendRowsFor([])).toEqual([])
  })

  it('builds a Windows-safe file name', () => {
    expect(annotatedPlanFileName('Entrepôt Lyon / Nord', 'RDC: cellule "3"?', '2026-09-28')).toBe(
      'Entrepôt Lyon Nord - RDC cellule 3 - 2026-09-28.png',
    )
  })
})
