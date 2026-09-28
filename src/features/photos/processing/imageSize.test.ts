import { describe, expect, it } from 'vitest'
import { computeTargetSize } from '@/features/photos/processing/imageSize'

describe('computeTargetSize', () => {
  it('reduces landscape and portrait images on their long side, keeping the ratio', () => {
    expect(computeTargetSize(4032, 3024, 2000)).toEqual({ width: 2000, height: 1500 })
    expect(computeTargetSize(3024, 4032, 2000)).toEqual({ width: 1500, height: 2000 })
    expect(computeTargetSize(4000, 2250, 480)).toEqual({ width: 480, height: 270 })
    expect(computeTargetSize(2400, 1601, 2000)).toEqual({ width: 2000, height: 1334 })
  })

  it('never enlarges', () => {
    expect(computeTargetSize(800, 600, 2000)).toEqual({ width: 800, height: 600 })
    expect(computeTargetSize(2000, 1000, 2000)).toEqual({ width: 2000, height: 1000 })
  })

  it('handles squares and extreme ratios', () => {
    expect(computeTargetSize(3000, 3000, 2000)).toEqual({ width: 2000, height: 2000 })
    expect(computeTargetSize(10000, 10, 480)).toEqual({ width: 480, height: 1 })
  })
})
