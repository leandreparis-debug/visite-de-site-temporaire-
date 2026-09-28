import { describe, expect, it, vi } from 'vitest'
import {
  PLAN_FORMAT_MESSAGE,
  processPlanImage,
  type PlanImageCodec,
} from '@/features/plan/import/processPlanImage'
import { toUserMessage } from '@/lib/errors'

function fakeCodec(width: number, height: number, decodeFails = false) {
  const close = vi.fn()
  const codec: PlanImageCodec = {
    decode: vi.fn(() =>
      decodeFails
        ? Promise.reject(new Error('bad'))
        : Promise.resolve({ width, height, close, source: {} as CanvasImageSource }),
    ),
    resize: vi.fn((_, w: number, h: number, type: string) =>
      Promise.resolve(new Blob([`${w}x${h}`], { type })),
    ),
  }
  return { codec, close }
}
const rejection = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  )

describe('processPlanImage', () => {
  it('reduces large PNG/JPEG plans to 4096 px, keeping the format', async () => {
    const { codec, close } = fakeCodec(8000, 5000)
    const png = await processPlanImage(new File(['x'], 'plan.png', { type: 'image/png' }), codec)
    expect(png).toMatchObject({ width: 4096, height: 2560, mimeType: 'image/png' })
    expect(await png.blob.text()).toBe('4096x2560')
    const jpeg = await processPlanImage(new File(['x'], 'plan.jpg', { type: 'image/jpeg' }), codec)
    expect(jpeg.mimeType).toBe('image/jpeg')
    expect(codec.resize).toHaveBeenLastCalledWith(expect.anything(), 4096, 2560, 'image/jpeg', 0.9)
    expect(close).toHaveBeenCalledTimes(2)
  })

  it('keeps a small plan as is (no re-encoding)', async () => {
    const { codec } = fakeCodec(1600, 1100)
    const result = await processPlanImage(
      new File(['original'], 'plan.png', { type: 'image/png' }),
      codec,
    )
    expect(result).toMatchObject({ width: 1600, height: 1100, mimeType: 'image/png' })
    expect(await result.blob.text()).toBe('original')
    expect(codec.resize).not.toHaveBeenCalled()
  })

  it('refuses other formats (WebP…) with a French message', async () => {
    const { codec } = fakeCodec(10, 10)
    for (const file of [
      new File(['x'], 'p.webp', { type: 'image/webp' }),
      new File(['x'], 'p.gif', { type: 'image/gif' }),
    ]) {
      expect(toUserMessage(await rejection(processPlanImage(file, codec)))).toBe(
        PLAN_FORMAT_MESSAGE,
      )
    }
  })

  it('reports undecodable images and closes decoded ones even on failure', async () => {
    const broken = fakeCodec(10, 10, true)
    expect(
      toUserMessage(
        await rejection(
          processPlanImage(new File(['x'], 'p.png', { type: 'image/png' }), broken.codec),
        ),
      ),
    ).toMatch(/^Image illisible/)
    const failing = fakeCodec(9000, 9000)
    failing.codec.resize = () => Promise.reject(new Error('no canvas'))
    await rejection(
      processPlanImage(new File(['x'], 'p.png', { type: 'image/png' }), failing.codec),
    )
    expect(failing.close).toHaveBeenCalledOnce()
  })
})
