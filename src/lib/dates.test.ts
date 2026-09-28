import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDaysIso,
  daysBetweenIso,
  formatDateFr,
  formatDateShortFr,
  formatRelativeFr,
  isValidIsoDate,
  isValidTime,
  nowIso,
  todayIso,
} from '@/lib/dates'

describe('dates', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats French dates', () => {
    expect(formatDateFr('2026-09-28')).toBe('28 septembre 2026')
    expect(formatDateFr('2026-01-01')).toBe('1 janvier 2026')
    expect(formatDateShortFr('2026-09-28')).toBe('28/09/2026')
    expect(formatDateFr('pas une date')).toBe('pas une date')
  })

  it('validates ISO dates', () => {
    expect(isValidIsoDate('2026-09-28')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2025-02-29')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-9-28')).toBe(false)
    expect(isValidIsoDate('28/09/2026')).toBe(false)
    expect(isValidIsoDate('2026-09-28T10:00:00Z')).toBe(false)
  })

  it('adds days and counts days on pure calendar dates', () => {
    expect(addDaysIso('2026-01-30', 30)).toBe('2026-03-01')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('nope', 3)).toBe('nope')
    expect(daysBetweenIso('2026-03-01', '2026-03-31')).toBe(30)
    expect(daysBetweenIso('2026-03-31', '2026-03-01')).toBe(-30)
    expect(daysBetweenIso('2026-03-01', 'x')).toBeNaN()
  })

  it('validates HH:mm times', () => {
    expect(isValidTime('09:30')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('9:30')).toBe(false)
  })

  it('todayIso uses the local date, not UTC', () => {
    // 23:30 local on Sept 28: in any time zone east of UTC, toISOString() would
    // still say the 28th, and west of UTC it would say the 29th. Local must win.
    const lateEvening = new Date(2026, 8, 28, 23, 30)
    expect(todayIso(lateEvening)).toBe('2026-09-28')
    const earlyMorning = new Date(2026, 8, 28, 0, 15)
    expect(todayIso(earlyMorning)).toBe('2026-09-28')

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 12))
    expect(todayIso()).toBe('2026-01-05')
  })

  it('nowIso returns a full ISO timestamp', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
  it('formats relative times in French', () => {
    const now = Date.parse('2026-09-28T12:00:00.000Z')
    const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString()
    expect(formatRelativeFr(ago(10), now)).toBe('à l’instant')
    expect(formatRelativeFr(ago(5 * 60), now)).toBe('il y a 5 minutes')
    expect(formatRelativeFr(ago(3 * 3600), now)).toBe('il y a 3 heures')
    expect(formatRelativeFr(ago(26 * 3600), now)).toBe('hier')
    expect(formatRelativeFr(ago(3 * 86_400), now)).toBe('il y a 3 jours')
    expect(formatRelativeFr(ago(14 * 86_400), now)).toBe('il y a 2 semaines')
    expect(formatRelativeFr(ago(400 * 86_400), now)).toBe('l’année dernière')
  })
})
