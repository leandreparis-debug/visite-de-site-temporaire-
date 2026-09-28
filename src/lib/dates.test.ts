import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatDateFr,
  formatDateShortFr,
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
})
