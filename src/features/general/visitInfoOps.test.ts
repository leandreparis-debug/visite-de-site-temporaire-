import { describe, expect, it } from 'vitest'
import { setVisitInfo } from '@/features/general/visitInfoOps'
import { visitSchema } from '@/types/visit'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'

describe('setVisitInfo', () => {
  it('never mutates and is deterministic', () => {
    const visit = deepFreeze(makeFullVisit())
    const op = () =>
      setVisitInfo(visit, { kind: 'meeting', author: ' A ', site: { name: ' N ', city: '' } })
    expect(op).not.toThrow()
    expect(op()).toEqual(op())
  })

  it('trims strings and turns empty optional fields into undefined (key removed)', () => {
    const visit = deepFreeze(makeFullVisit())
    const next = setVisitInfo(visit, {
      author: '  Arnaud Montigny ',
      purpose: '   ',
      startTime: '',
      site: { name: '  Entrepôt Sud ', code: ' ', address: ' 2 rue X ', city: '' },
    })
    expect(next.author).toBe('Arnaud Montigny')
    expect('purpose' in next).toBe(false)
    expect('startTime' in next).toBe(false)
    expect(next.site).toEqual({ name: 'Entrepôt Sud', address: '2 rue X' })
    expect(visitSchema.safeParse(next).success).toBe(true)
  })

  it('refuses an empty site name and an invalid date: visit unchanged', () => {
    const visit = deepFreeze(makeFullVisit())
    expect(setVisitInfo(visit, { site: { name: '   ' } })).toBe(visit)
    expect(setVisitInfo(visit, { date: '' })).toBe(visit)
    expect(setVisitInfo(visit, { date: '2026-02-30' })).toBe(visit)
    expect(setVisitInfo(visit, { startTime: '25:00' })).toBe(visit)
    // Other fields of the same patch still apply.
    const next = setVisitInfo(visit, { site: { name: '', city: 'Lille' } })
    expect(next.site).toEqual({ ...visit.site, city: 'Lille' })
  })

  it('sets kind, date and time', () => {
    const next = setVisitInfo(deepFreeze(makeFullVisit()), {
      kind: 'meeting',
      date: '2026-10-01',
      startTime: '14:30',
    })
    expect(next).toMatchObject({ kind: 'meeting', date: '2026-10-01', startTime: '14:30' })
  })
})
