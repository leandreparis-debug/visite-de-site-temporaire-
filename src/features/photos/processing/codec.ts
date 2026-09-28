/**
 * Browser image codec: decoding with `createImageBitmap` (applies the EXIF
 * orientation), encoding with `OffscreenCanvas` (or `<canvas>` as a fallback).
 * Behind an interface so the processing logic can be tested without canvas.
 */

/** A decoded image, to be closed once used. */
export interface DecodedImage {
  width: number
  height: number
  source: CanvasImageSource
  close: () => void
}

export interface RenderOptions {
  /** JPEG quality, 0–1. */
  quality: number
  /** Clockwise rotation applied while drawing. Output size is given already rotated. */
  rotate?: 0 | 90 | -90
}

export interface ImageCodec {
  decode: (blob: Blob) => Promise<DecodedImage>
  /** Draws the image at `width × height` on a white background and encodes it as JPEG. */
  render: (
    image: DecodedImage,
    width: number,
    height: number,
    options: RenderOptions,
  ) => Promise<Blob>
}

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

function draw(
  context: Context2D,
  image: DecodedImage,
  width: number,
  height: number,
  rotate: 0 | 90 | -90,
): void {
  // White background: transparent PNG/WebP areas would turn black in JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (rotate === 90) {
    context.translate(width, 0)
    context.rotate(Math.PI / 2)
    context.drawImage(image.source, 0, 0, height, width)
  } else if (rotate === -90) {
    context.translate(0, height)
    context.rotate(-Math.PI / 2)
    context.drawImage(image.source, 0, 0, height, width)
  } else {
    context.drawImage(image.source, 0, 0, width, height)
  }
}

export const browserCodec: ImageCodec = {
  async decode(blob) {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => {
        bitmap.close()
      },
    }
  },

  async render(image, width, height, { quality, rotate = 0 }) {
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('2D context unavailable')
      draw(context, image, width, height, rotate)
      return canvas.convertToBlob({ type: 'image/jpeg', quality })
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D context unavailable')
    draw(context, image, width, height, rotate)
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('JPEG encoding failed'))
        },
        'image/jpeg',
        quality,
      )
    })
  },
}
