import { computeTargetSize } from '@/features/photos/processing/imageSize'
import {
  PLAN_JPEG_QUALITY,
  PLAN_MAX_SOURCE_BYTES,
  PLAN_TOO_LARGE_MESSAGE,
  PlanImportError,
  type RenderedPlan,
} from './renderPdfPage'

/** Long side (px) of a plan image. */
export const PLAN_IMAGE_MAX_SIDE = 4096

export const PLAN_FORMAT_MESSAGE =
  'Format non pris en charge. Importez le plan en PDF, PNG ou JPEG (exports d’AutoCAD).'

/** Decoding / resizing / encoding, injectable for tests. */
export interface PlanImageCodec {
  /** Decodes (EXIF orientation applied). */
  decode: (
    blob: Blob,
  ) => Promise<{ width: number; height: number; close: () => void; source: CanvasImageSource }>
  /** Draws at `width × height` (white background for JPEG) and encodes as `type`. */
  resize: (
    image: { source: CanvasImageSource },
    width: number,
    height: number,
    type: 'image/png' | 'image/jpeg',
    quality?: number,
  ) => Promise<Blob>
}

export function planImageType(
  file: Pick<File, 'name' | 'type'>,
): 'image/png' | 'image/jpeg' | null {
  if (file.type === 'image/png' || (!file.type && /\.png$/i.test(file.name))) return 'image/png'
  if (file.type === 'image/jpeg' || (!file.type && /\.jpe?g$/i.test(file.name))) return 'image/jpeg'
  return null
}

/**
 * Prepares a PNG or JPEG plan: at most 4096 px on the long side, format kept
 * (no conversion: Word embeds PNG and JPEG). A plan already small enough is
 * stored as is.
 *
 * @throws {PlanImportError} other formats (WebP, GIF, HEIC…), > 80 MB, undecodable.
 */
export async function processPlanImage(file: File, codec: PlanImageCodec): Promise<RenderedPlan> {
  const type = planImageType(file)
  if (!type)
    throw new PlanImportError(
      PLAN_FORMAT_MESSAGE,
      `Unsupported plan format: ${file.type || file.name}`,
    )
  if (file.size > PLAN_MAX_SOURCE_BYTES) {
    throw new PlanImportError(PLAN_TOO_LARGE_MESSAGE, `Plan too large: ${file.size} bytes`)
  }
  let image: Awaited<ReturnType<PlanImageCodec['decode']>>
  try {
    image = await codec.decode(file)
  } catch (error) {
    throw new PlanImportError(
      'Image illisible : le fichier est endommagé ou son format n’est pas reconnu.',
      `Plan image decoding failed: ${file.name}`,
      { cause: error },
    )
  }
  try {
    const target = computeTargetSize(image.width, image.height, PLAN_IMAGE_MAX_SIDE)
    const unchanged = target.width === image.width && target.height === image.height
    const blob = unchanged
      ? file.slice(0, file.size, type)
      : await codec.resize(
          image,
          target.width,
          target.height,
          type,
          type === 'image/jpeg' ? PLAN_JPEG_QUALITY : undefined,
        )
    return { blob, width: target.width, height: target.height, mimeType: type, degraded: false }
  } finally {
    image.close()
  }
}

/** Browser codec (createImageBitmap + canvas). */
export const browserPlanCodec: PlanImageCodec = {
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
  resize(image, width, height, type, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return Promise.reject(new Error('2D context unavailable'))
    if (type === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }
    context.imageSmoothingQuality = 'high'
    context.drawImage(image.source, 0, 0, width, height)
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Encoding failed'))
        },
        type,
        quality,
      )
    })
  },
}
