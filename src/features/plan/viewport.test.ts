import { describe, expect, it } from 'vitest'
import {
  clampPan,
  fitToContainer,
  MIN_VISIBLE_PX,
  normalizedToScreen,
  screenToNormalized,
  zoomAroundPoint,
  zoomBounds,
} from '@/features/plan/viewport'

const container = { width: 1000, height: 600 }

describe('viewport', () => {
  it('fits landscape and portrait images, centered', () => {
    expect(fitToContainer({ width: 4000, height: 2000 }, container)).toEqual({
      scale: 0.25,
      tx: 0,
      ty: 50,
    })
    expect(fitToContainer({ width: 2000, height: 4000 }, container)).toEqual({
      scale: 0.15,
      tx: 350,
      ty: 0,
    })
  })

  it('zooms around a point that stays fixed (± 1 px)', () => {
    const image = { width: 4000, height: 2000 }
    const bounds = zoomBounds(image, container)
    const view = fitToContainer(image, container)
    const cursor = { x: 730, y: 210 }
    const before = screenToNormalized(cursor, view, image)
    let zoomed = view
    for (const factor of [1.25, 1.25, 1.6, 0.8, 1.1]) {
      zoomed = zoomAroundPoint(zoomed, factor, cursor, bounds)
      const after = normalizedToScreen(before, zoomed, image)
      expect(Math.abs(after.x - cursor.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(after.y - cursor.y)).toBeLessThanOrEqual(1)
    }
  })

  it('respects the zoom bounds (fit → 8× fit)', () => {
    const image = { width: 4000, height: 2000 }
    const bounds = zoomBounds(image, container)
    expect(bounds).toEqual({ min: 0.25, max: 2 })
    const view = fitToContainer(image, container)
    expect(zoomAroundPoint(view, 100, { x: 0, y: 0 }, bounds).scale).toBe(2)
    expect(zoomAroundPoint(view, 0.01, { x: 0, y: 0 }, bounds).scale).toBe(0.25)
  })

  it('round-trips screen ↔ normalized coordinates', () => {
    const image = { width: 3000, height: 2000 }
    const view = { scale: 0.73, tx: -120.5, ty: 44 }
    for (const point of [
      { x: 0, y: 0 },
      { x: 512.3, y: 88.8 },
      { x: 999, y: 599 },
    ]) {
      const back = normalizedToScreen(screenToNormalized(point, view, image), view, image)
      expect(back.x).toBeCloseTo(point.x, 6)
      expect(back.y).toBeCloseTo(point.y, 6)
    }
    expect(
      screenToNormalized(
        { x: 0, y: 50 },
        fitToContainer({ width: 4000, height: 2000 }, container),
        { width: 4000, height: 2000 },
      ),
    ).toEqual({ x: 0, y: 0 })
  })

  it('clampPan keeps the plan in the frame', () => {
    const image = { width: 4000, height: 2000 }
    // Zoomed in (8000 × 4000 on screen): cannot be pushed out.
    const far = clampPan({ scale: 2, tx: 5000, ty: -9000 }, image, container)
    expect(far.tx).toBe(container.width - MIN_VISIBLE_PX)
    expect(far.ty).toBe(MIN_VISIBLE_PX - 4000)
    // Smaller than the container on an axis: centered on it.
    const small = clampPan({ scale: 0.2, tx: 999, ty: 999 }, image, container)
    expect(small).toEqual({ scale: 0.2, tx: 100, ty: 100 })
    // Inside the bounds: unchanged.
    expect(clampPan({ scale: 1, tx: -100, ty: -50 }, image, container)).toEqual({
      scale: 1,
      tx: -100,
      ty: -50,
    })
  })
})
