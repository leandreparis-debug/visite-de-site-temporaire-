import { describe, expect, it, vi } from 'vitest'
import type { DecodedImage, ImageCodec, RenderOptions } from '@/features/photos/processing/codec'
import {
  HEIC_MESSAGE,
  processPhoto,
  UnsupportedImageError,
} from '@/features/photos/processing/processPhoto'
import { rotateBlob90 } from '@/features/photos/processing/rotatePhoto'
import { toUserMessage } from '@/lib/errors'
import { fixtureFile } from '@/test/photoFixtures'

function fakeCodec(width: number, height: number, overrides: Partial<ImageCodec> = {}) {
  const close = vi.fn()
  const render = vi.fn((_: DecodedImage, w: number, h: number, _options: RenderOptions) =>
    Promise.resolve(new Blob([`${w}x${h}`], { type: 'image/jpeg' })),
  )
  const codec: ImageCodec = {
    decode: vi.fn(() => Promise.resolve({ width, height, source: {} as CanvasImageSource, close })),
    render,
    ...overrides,
  }
  return { codec, close, render }
}

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

describe('processPhoto', () => {
  it('produces a 2000 px main image (q 0.82) and a 480 px thumbnail (q 0.7), with EXIF date', async () => {
    const { codec, close, render } = fakeCodec(4032, 3024)
    const result = await processPhoto(fixtureFile('exif-ii.jpg'), codec)
    expect(result).toMatchObject({
      width: 2000,
      height: 1500,
      mimeType: 'image/jpeg',
      takenAt: '2026-09-15T10:42:07',
      originalName: 'exif-ii.jpg',
    })
    expect(render.mock.calls.map(([, w, h, options]) => [w, h, options.quality])).toEqual([
      [2000, 1500, 0.82],
      [480, 360, 0.7],
    ])
    expect(await result.thumbnailBlob.text()).toBe('480x360')
    expect(close).toHaveBeenCalledOnce()
  })

  it('omits takenAt without EXIF and does not enlarge small images', async () => {
    const { codec } = fakeCodec(400, 300)
    const result = await processPhoto(fixtureFile('transparent.png'), codec)
    expect(result).toMatchObject({ width: 400, height: 300 })
    expect('takenAt' in result).toBe(false)
  })

  it('refuses HEIC by MIME type and by extension, with the French message', async () => {
    const { codec } = fakeCodec(10, 10)
    const byExtension = await rejection(processPhoto(new File(['x'], 'IMG_0001.HEIC'), codec))
    const byType = await rejection(
      processPhoto(new File(['x'], 'photo', { type: 'image/heic' }), codec),
    )
    const heif = await rejection(processPhoto(new File(['x'], 'a.heif', { type: '' }), codec))
    for (const error of [byExtension, byType, heif]) {
      expect(error).toBeInstanceOf(UnsupportedImageError)
      expect(toUserMessage(error)).toBe(HEIC_MESSAGE)
    }
    expect(HEIC_MESSAGE).toContain('Réglages › Appareil photo › Formats › « Le plus compatible »')
    expect(codec.decode).not.toHaveBeenCalled()
  })

  it('refuses non-image files and files over 40 MB', async () => {
    const { codec } = fakeCodec(10, 10)
    const text = await rejection(
      processPhoto(new File(['x'], 'notes.txt', { type: 'text/plain' }), codec),
    )
    expect(toUserMessage(text)).toBe(
      'Ce fichier n’est pas une image (formats acceptés : JPEG, PNG, WebP).',
    )

    const big = new File(['x'], 'huge.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 40 * 1024 * 1024 + 1 })
    expect(toUserMessage(await rejection(processPhoto(big, codec)))).toBe(
      'Fichier trop volumineux (plus de 40 Mo).',
    )
    expect(codec.decode).not.toHaveBeenCalled()
  })

  it('reports undecodable images', async () => {
    const { codec } = fakeCodec(10, 10, { decode: () => Promise.reject(new Error('bad data')) })
    const error = await rejection(processPhoto(fixtureFile('texte-renomme.jpg'), codec))
    expect(error).toBeInstanceOf(UnsupportedImageError)
    expect(toUserMessage(error)).toMatch(/^Image illisible/)
  })

  it('closes the decoded image even when encoding fails', async () => {
    const { codec, close } = fakeCodec(100, 100, {
      render: () => Promise.reject(new Error('no canvas')),
    })
    const error = await rejection(processPhoto(fixtureFile('exif-mm.jpg'), codec))
    expect(error).toBeInstanceOf(UnsupportedImageError)
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('rotateBlob90', () => {
  it('swaps width and height, rotates in the requested direction and closes the image', async () => {
    const { codec, close, render } = fakeCodec(2000, 1500)
    const result = await rotateBlob90(new Blob(['x']), 'right', codec)
    expect(result).toMatchObject({ width: 1500, height: 2000 })
    expect(render.mock.calls[0]?.[3]).toEqual({ quality: 0.82, rotate: 90 })
    expect(render.mock.calls[1]?.slice(1, 3)).toEqual([360, 480])
    await rotateBlob90(new Blob(['x']), 'left', codec)
    expect(render.mock.calls[2]?.[3]?.rotate).toBe(-90)
    expect(close).toHaveBeenCalledTimes(2)
  })
})
