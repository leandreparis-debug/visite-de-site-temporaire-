/**
 * Prepares the images of the report, ONE AT A TIME to keep memory low:
 * annotated plans (`renderAnnotatedPlan`, PNG) and photos re-encoded in JPEG
 * at the size of the chosen quality. Each bitmap is closed and each canvas
 * released before the next image. The event loop is yielded between images
 * so the interface stays responsive and shows the progress.
 */
import { browserCodec, type ImageCodec } from '@/features/photos/processing/codec'
import { computeTargetSize } from '@/features/photos/processing/imageSize'
import { renderAnnotatedPlan } from '@/features/plan/renderAnnotatedPlan'
import type { Photo, Pin, Plan } from '@/types/media'
import { REPORT_IMAGE_SETTINGS } from '../model/estimateReportSize'
import type { ReportModel, ReportQuality } from '../model/reportModel'
import type { ReportAssets, ReportImage } from './renderReportDocx'

export type ReportProgress =
  | { stage: 'plans'; done: number; total: number }
  | { stage: 'photos'; done: number; total: number }
  | { stage: 'assembling' }

export interface PrepareAssetsInput {
  model: ReportModel
  photos: readonly Photo[]
  plans: readonly Plan[]
  pins: readonly Pin[]
  quality: ReportQuality
  /** PNG of the logo (see `rasterizeLogo`). */
  logo: ReportImage
  onProgress?: (progress: ReportProgress) => void
}

export interface AssetDependencies {
  codec: ImageCodec
  annotatePlan: typeof renderAnnotatedPlan
  /** Lets the browser paint between two images. */
  yieldToUi: () => Promise<void>
}

const defaultDependencies: AssetDependencies = {
  codec: browserCodec,
  annotatePlan: renderAnnotatedPlan,
  yieldToUi: () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0)
    }),
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Ids of the plans and photos actually shown by the model. */
export function usedImageIds(model: ReportModel): { planIds: string[]; photoIds: string[] } {
  const planIds: string[] = []
  const photoIds: string[] = []
  for (const section of model.sections) {
    if (section.key === 'plans') planIds.push(...section.plans.map((p) => p.planId))
    if (section.key === 'photos') photoIds.push(...section.photos.map((p) => p.photoId))
  }
  return { planIds, photoIds }
}

/**
 * Builds the report images, sequentially, reporting "plans i / n" then
 * "photos i / n". Only the plans and photos present in the model are
 * processed.
 */
export async function prepareReportAssets(
  input: PrepareAssetsInput,
  dependencies: AssetDependencies = defaultDependencies,
): Promise<ReportAssets> {
  const { codec, annotatePlan, yieldToUi } = dependencies
  const settings = REPORT_IMAGE_SETTINGS[input.quality]
  const { planIds, photoIds } = usedImageIds(input.model)
  const plansById = new Map(input.plans.map((p) => [p.id, p]))
  const photosById = new Map(input.photos.map((p) => [p.id, p]))

  const plans = new Map<string, ReportImage>()
  for (const [index, planId] of planIds.entries()) {
    input.onProgress?.({ stage: 'plans', done: index, total: planIds.length })
    await yieldToUi()
    const plan = plansById.get(planId)
    if (!plan) continue
    const blob = await annotatePlan(
      plan.blob,
      input.pins.filter((pin) => pin.planId === planId),
      photosById,
      { maxLongSide: settings.planMaxSide },
    )
    const size = computeTargetSize(plan.width, plan.height, settings.planMaxSide)
    plans.set(planId, { data: await bytesOf(blob), type: 'png', ...size })
  }

  const photos = new Map<string, ReportImage>()
  for (const [index, photoId] of photoIds.entries()) {
    input.onProgress?.({ stage: 'photos', done: index, total: photoIds.length })
    await yieldToUi()
    const photo = photosById.get(photoId)
    if (!photo) continue
    const image = await codec.decode(photo.blob)
    try {
      const size = computeTargetSize(image.width, image.height, settings.photoMaxSide)
      const blob = await codec.render(image, size.width, size.height, {
        quality: settings.photoJpegQuality,
      })
      photos.set(photoId, { data: await bytesOf(blob), type: 'jpg', ...size })
    } finally {
      image.close()
    }
  }
  if (photoIds.length)
    input.onProgress?.({ stage: 'photos', done: photoIds.length, total: photoIds.length })
  input.onProgress?.({ stage: 'assembling' })
  await yieldToUi()
  return { logo: input.logo, plans, photos }
}

/**
 * Rasterizes the logo (SVG or PNG URL, e.g. the inlined `data:` URI) to a PNG
 * of the given height: Word only needs raster images.
 */
export async function rasterizeLogo(src: string, height = 160): Promise<ReportImage> {
  const img = new Image()
  img.src = src
  await img.decode()
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4
  const width = Math.max(1, Math.round(height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D context unavailable')
  context.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('PNG encoding failed'))
    }, 'image/png')
  })
  canvas.width = 0
  return { data: await bytesOf(blob), type: 'png', width, height }
}
