/**
 * Pure viewport maths for the plan canvas. The plan image (natural size
 * `imageSize`) is drawn at `translate(tx, ty) scale(scale)` inside a container
 * of `containerSize`. Pins are positioned with `normalizedToScreen`, so they
 * keep a constant size on screen whatever the zoom.
 */

export interface Size {
  width: number
  height: number
}
export interface Point {
  x: number
  y: number
}
export interface View {
  scale: number
  tx: number
  ty: number
}

/** Maximum zoom, relative to the "fit" scale. */
export const MAX_ZOOM_FACTOR = 8

/** View showing the whole image centered in the container. */
export function fitToContainer(image: Size, container: Size): View {
  const scale = Math.min(container.width / image.width, container.height / image.height)
  return {
    scale,
    tx: (container.width - image.width * scale) / 2,
    ty: (container.height - image.height * scale) / 2,
  }
}

/** Zoom limits: from the fit scale to 8× the fit scale. */
export function zoomBounds(image: Size, container: Size): { min: number; max: number } {
  const min = fitToContainer(image, container).scale
  return { min, max: min * MAX_ZOOM_FACTOR }
}

/**
 * Zooms by `factor` keeping `point` (container coordinates, e.g. the cursor)
 * fixed on screen. The scale is clamped to `bounds`.
 */
export function zoomAroundPoint(
  view: View,
  factor: number,
  point: Point,
  bounds: { min: number; max: number },
): View {
  const scale = Math.min(bounds.max, Math.max(bounds.min, view.scale * factor))
  const ratio = scale / view.scale
  return {
    scale,
    tx: point.x - (point.x - view.tx) * ratio,
    ty: point.y - (point.y - view.ty) * ratio,
  }
}

/** Container point → normalized plan coordinates (0–1, not clamped). */
export function screenToNormalized(point: Point, view: View, image: Size): Point {
  return {
    x: (point.x - view.tx) / view.scale / image.width,
    y: (point.y - view.ty) / view.scale / image.height,
  }
}

/** Normalized plan coordinates → container point. */
export function normalizedToScreen(point: Point, view: View, image: Size): Point {
  return {
    x: view.tx + point.x * image.width * view.scale,
    y: view.ty + point.y * image.height * view.scale,
  }
}

/** Minimum visible part of the plan (px) when panning. */
export const MIN_VISIBLE_PX = 80

/**
 * Keeps the plan from leaving the frame: when the plan is smaller than the
 * container it stays centered on that axis, otherwise at least
 * `MIN_VISIBLE_PX` of it remains visible.
 */
export function clampPan(view: View, image: Size, container: Size): View {
  const clampAxis = (t: number, imageSide: number, containerSide: number) => {
    const size = imageSide * view.scale
    if (size <= containerSide) return (containerSide - size) / 2
    const margin = Math.min(MIN_VISIBLE_PX, containerSide / 2)
    return Math.min(containerSide - margin, Math.max(margin - size, t))
  }
  return {
    scale: view.scale,
    tx: clampAxis(view.tx, image.width, container.width),
    ty: clampAxis(view.ty, image.height, container.height),
  }
}
