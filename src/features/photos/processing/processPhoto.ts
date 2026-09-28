import { AppError } from '@/lib/errors'
import { browserCodec, type DecodedImage, type ImageCodec } from './codec'
import { EXIF_READ_BYTES, readDateTimeOriginal } from './exif'
import { computeTargetSize } from './imageSize'

/** Main image: long side (px) and JPEG quality. Readable in an A4 report, ~300–600 KB. */
export const MAIN_MAX_SIDE = 2000
export const MAIN_QUALITY = 0.82
/** Thumbnail for the gallery. */
export const THUMB_MAX_SIDE = 480
export const THUMB_QUALITY = 0.7
/** Larger source files are refused. */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024

export const HEIC_MESSAGE =
  'Format HEIC (iPhone) non pris en charge. Sur l’iPhone : Réglages › Appareil photo › Formats › « Le plus compatible », ou exportez la photo en JPEG.'

/** A file that cannot become a photo (French message for the user). */
export class UnsupportedImageError extends AppError {}

export interface ProcessedPhoto {
  blob: Blob
  thumbnailBlob: Blob
  width: number
  height: number
  mimeType: 'image/jpeg'
  takenAt?: string
  originalName: string
}

const IMAGE_EXTENSIONS = /\.(jpe?g|jfif|png|webp|gif|bmp|avif)$/i
const HEIC_EXTENSIONS = /\.(heic|heif)$/i

export function isHeic(file: Pick<File, 'name' | 'type'>): boolean {
  return /^image\/hei[cf]/i.test(file.type) || HEIC_EXTENSIONS.test(file.name)
}

function isImage(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('image/') || (!file.type && IMAGE_EXTENSIONS.test(file.name))
}

/** Main image + thumbnail from a decoded image (rotation optional). */
export async function renderVariants(
  image: DecodedImage,
  codec: ImageCodec,
  rotate: 0 | 90 | -90 = 0,
): Promise<{ blob: Blob; thumbnailBlob: Blob; width: number; height: number }> {
  const [sourceWidth, sourceHeight] =
    rotate === 0 ? [image.width, image.height] : [image.height, image.width]
  const main = computeTargetSize(sourceWidth, sourceHeight, MAIN_MAX_SIDE)
  const thumb = computeTargetSize(sourceWidth, sourceHeight, THUMB_MAX_SIDE)
  const blob = await codec.render(image, main.width, main.height, { quality: MAIN_QUALITY, rotate })
  const thumbnailBlob = await codec.render(image, thumb.width, thumb.height, {
    quality: THUMB_QUALITY,
    rotate,
  })
  return { blob, thumbnailBlob, width: main.width, height: main.height }
}

/**
 * Turns an image file into a stored photo: EXIF orientation applied, resized
 * to 2000 px (JPEG 0.82), 480 px thumbnail (JPEG 0.7), PNG/WebP flattened on
 * white, EXIF `DateTimeOriginal` read. The original file is not kept.
 *
 * @throws {UnsupportedImageError} HEIC/HEIF (type or extension), not an image,
 *   larger than 40 MB, or undecodable.
 */
export async function processPhoto(
  file: File,
  codec: ImageCodec = browserCodec,
): Promise<ProcessedPhoto> {
  if (isHeic(file)) {
    throw new UnsupportedImageError(HEIC_MESSAGE, `HEIC/HEIF not supported: ${file.name}`)
  }
  if (!isImage(file)) {
    throw new UnsupportedImageError(
      'Ce fichier n’est pas une image (formats acceptés : JPEG, PNG, WebP).',
      `Not an image: ${file.name} (${file.type || 'unknown type'})`,
    )
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new UnsupportedImageError(
      'Fichier trop volumineux (plus de 40 Mo).',
      `File too large: ${file.name} (${file.size} bytes)`,
    )
  }

  const takenAt = readDateTimeOriginal(await file.slice(0, EXIF_READ_BYTES).arrayBuffer())

  let image: DecodedImage
  try {
    image = await codec.decode(file)
  } catch (error) {
    throw new UnsupportedImageError(
      'Image illisible : le fichier est endommagé ou son format n’est pas reconnu.',
      `Decoding failed: ${file.name}`,
      { cause: error },
    )
  }
  try {
    const variants = await renderVariants(image, codec)
    return {
      ...variants,
      mimeType: 'image/jpeg',
      ...(takenAt && { takenAt }),
      originalName: file.name,
    }
  } catch (error) {
    throw new UnsupportedImageError(
      'Impossible de convertir cette image.',
      `Encoding failed: ${file.name}`,
      { cause: error },
    )
  } finally {
    image.close()
  }
}
