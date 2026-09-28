import { browserCodec, type ImageCodec } from './codec'
import { renderVariants } from './processPhoto'

/**
 * Rotates a stored photo by 90° and regenerates the main image and the
 * thumbnail (width and height are swapped).
 *
 * @param direction `'left'` (counter-clockwise) or `'right'` (clockwise).
 */
export async function rotateBlob90(
  blob: Blob,
  direction: 'left' | 'right',
  codec: ImageCodec = browserCodec,
): Promise<{ blob: Blob; thumbnailBlob: Blob; width: number; height: number }> {
  const image = await codec.decode(blob)
  try {
    return await renderVariants(image, codec, direction === 'right' ? 90 : -90)
  } finally {
    image.close()
  }
}
