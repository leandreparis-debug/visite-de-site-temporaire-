import { describe, expect, it } from 'vitest'
import { estimateReportSize, formatFileSize } from '@/features/report/model/estimateReportSize'

const photo = { bytes: 600_000, width: 2000, height: 1500 }
const plan = { width: 4096, height: 2895 }

describe('estimateReportSize', () => {
  it('is lighter in "Allégée" than in "Standard"', () => {
    const input = { photos: [photo, photo, photo], plans: [plan] }
    const standard = estimateReportSize({ ...input, quality: 'standard' })
    const light = estimateReportSize({ ...input, quality: 'light' })
    expect(light).toBeLessThan(standard)
    // Photos: 1000 px vs 1600 px, i.e. well under half the pixels.
    expect(light).toBeLessThan(standard * 0.6)
  })

  it('grows linearly with the number of photos', () => {
    const size = (count: number) =>
      estimateReportSize({ photos: Array(count).fill(photo), plans: [], quality: 'standard' })
    expect(size(0)).toBe(60_000)
    const one = size(1) - size(0)
    expect(one).toBeGreaterThan(300_000)
    expect(one).toBeLessThan(600_000)
    expect(size(10) - size(0)).toBeCloseTo(10 * one, -1)
  })

  it('never enlarges small images', () => {
    const small = { bytes: 100_000, width: 800, height: 600 }
    const standard = estimateReportSize({ photos: [small], plans: [], quality: 'standard' })
    expect(standard - 60_000).toBeLessThanOrEqual(small.bytes)
  })

  it('formats sizes in French', () => {
    expect(formatFileSize(850 * 1024)).toBe('850 Ko')
    expect(formatFileSize(4.2 * 1024 * 1024)).toBe('4,2 Mo')
    expect(formatFileSize(12)).toBe('1 Ko')
  })
})
