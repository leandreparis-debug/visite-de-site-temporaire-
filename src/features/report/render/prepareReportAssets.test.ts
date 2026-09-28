import { describe, expect, it, vi } from 'vitest'
import { buildReportModel } from '@/features/report/model/buildReportModel'
import {
  prepareReportAssets,
  type AssetDependencies,
  type ReportProgress,
} from '@/features/report/render/prepareReportAssets'
import { makeBlob } from '@/test/fixtures'
import { makeReportInput, REPORT_PHOTOS, REPORT_PLANS } from '@/test/reportFixtures'
import type { Photo, Plan } from '@/types/media'

const photos: Photo[] = REPORT_PHOTOS.map((p) => ({
  ...p,
  visitId: 'v',
  blob: makeBlob(`photo-${p.id}`),
  thumbnailBlob: makeBlob('thumb'),
  mimeType: 'image/jpeg',
  width: 2000,
  height: 1500,
  createdAt: '2026-09-28T08:00:00.000Z',
}))
const plans: Plan[] = REPORT_PLANS.map((p) => ({
  ...p,
  visitId: 'v',
  blob: makeBlob(`plan-${p.id}`, 'image/png'),
  mimeType: 'image/png',
  width: 4096,
  height: 2896,
  sourceType: 'pdf',
  createdAt: '2026-09-28T08:00:00.000Z',
}))

function fakeDependencies() {
  const events: string[] = []
  const dependencies: AssetDependencies = {
    codec: {
      decode: vi.fn((blob: Blob) => {
        events.push(`decode ${blob.size}`)
        return Promise.resolve({
          width: 2000,
          height: 1500,
          source: {} as CanvasImageSource,
          close: () => events.push('close'),
        })
      }),
      render: vi.fn((_image, width: number, height: number, options: { quality: number }) => {
        events.push(`render ${width}x${height} q${options.quality}`)
        return Promise.resolve(makeBlob('jpeg'))
      }),
    },
    annotatePlan: vi.fn(
      (
        _blob: Blob,
        pins: readonly unknown[],
        _photos: unknown,
        options?: { maxLongSide?: number },
      ) => {
        events.push(`plan ${pins.length} pins ${options?.maxLongSide}`)
        return Promise.resolve(makeBlob('png', 'image/png'))
      },
    ),
    yieldToUi: () => Promise.resolve(),
  }
  return { events, dependencies }
}

const logo = { data: new Uint8Array([1]), type: 'png' as const, width: 4, height: 1 }

describe('prepareReportAssets', () => {
  it('processes the images one by one, closing each bitmap, with progress', async () => {
    const input = makeReportInput()
    const model = buildReportModel(input)
    const { events, dependencies } = fakeDependencies()
    const progress: ReportProgress[] = []
    const assets = await prepareReportAssets(
      {
        model,
        photos,
        plans,
        pins: input.visit.pins,
        quality: 'standard',
        logo,
        onProgress: (p) => progress.push(p),
      },
      dependencies,
    )
    expect(events.slice(0, 5)).toEqual([
      'plan 3 pins 3000',
      'plan 0 pins 3000',
      expect.stringMatching(/^decode/),
      'render 1600x1200 q0.8',
      'close',
    ])
    expect(events.filter((e) => e === 'close')).toHaveLength(5)
    expect([...assets.plans.keys()]).toEqual(['plan-1', 'plan-2'])
    expect(assets.plans.get('plan-1')).toMatchObject({ type: 'png', width: 3000, height: 2121 })
    expect([...assets.photos.keys()]).toEqual(['ph-1', 'ph-2', 'ph-3', 'ph-4', 'ph-5'])
    expect(assets.photos.get('ph-1')).toMatchObject({ type: 'jpg', width: 1600, height: 1200 })
    expect(progress[0]).toEqual({ stage: 'plans', done: 0, total: 2 })
    expect(progress).toContainEqual({ stage: 'photos', done: 5, total: 5 })
    expect(progress.at(-1)).toEqual({ stage: 'assembling' })
  })

  it('uses the "Allégée" sizes and only the images shown', async () => {
    const input = makeReportInput({ options: { onlyPinnedPhotos: true, quality: 'light' } })
    const { events, dependencies } = fakeDependencies()
    const assets = await prepareReportAssets(
      {
        model: buildReportModel(input),
        photos,
        plans,
        pins: input.visit.pins,
        quality: 'light',
        logo,
      },
      dependencies,
    )
    expect(events).toContain('plan 3 pins 2000')
    expect(events).toContain('render 1000x750 q0.75')
    expect([...assets.photos.keys()]).toEqual(['ph-1', 'ph-2', 'ph-3'])
  })
})
