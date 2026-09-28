import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { logoSrc } from '@/components/brand/logoSource'
import { listPhotos } from '@/features/photos/photosRepo'
import { listPlans } from '@/features/plan/plansRepo'
import { getVisit } from '@/features/visits/visitsRepo'
import { nowIso, todayIso } from '@/lib/dates'
import { downloadBlob } from '@/lib/download'
import { AppError } from '@/lib/errors'
import { buildReportModel } from './model/buildReportModel'
import { formatFileSize } from './model/estimateReportSize'
import type { ReportOptions } from './model/reportModel'
import type { ReportProgress } from './render/prepareReportAssets'
import { recordReportGenerated } from './reportMeta'

export type ReportGenerationState =
  | { status: 'idle' }
  | { status: 'running'; progress: ReportProgress | { stage: 'saving' } }
  | { status: 'done'; fileName: string; bytes: number }
  | { status: 'error'; error: unknown }

/** Local time `YYYY-MM-DDTHH:mm` of "now", for "Généré le …". */
function localNow(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${todayIso(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** Progress text: "Préparation des plans…", "Photos 12 / 42…", "Assemblage du document…". */
export function formatReportProgress(progress: ReportProgress | { stage: 'saving' }): string {
  switch (progress.stage) {
    case 'saving':
      return 'Enregistrement des dernières modifications…'
    case 'plans':
      return progress.total > 1
        ? `Préparation des plans (${progress.done + 1} / ${progress.total})…`
        : 'Préparation des plans…'
    case 'photos':
      return `Photos ${Math.min(progress.done + 1, progress.total)} / ${progress.total}…`
    case 'assembling':
      return 'Assemblage du document…'
  }
}

/**
 * Generates and downloads the Word report of a visit.
 *
 * Steps: save pending changes (`flush`), read the visit, its photos and plans,
 * build the model (pure), prepare the images one by one, assemble the .docx
 * (`docx`, loaded at the first generation), download it, record the date.
 * The work yields between images: the interface never freezes.
 *
 * @param flush saves the pending changes of the editor; generation stops if it fails.
 */
export function useReportGeneration(visitId: string, flush: () => Promise<boolean>) {
  const [state, setState] = useState<ReportGenerationState>({ status: 'idle' })
  const running = useRef(false)

  const generate = useCallback(
    async (options: ReportOptions) => {
      if (running.current) return
      running.current = true
      setState({ status: 'running', progress: { stage: 'saving' } })
      try {
        if (!(await flush())) {
          throw new AppError(
            'Les dernières modifications n’ont pas pu être enregistrées. Corrigez-les puis réessayez.',
            'flush failed before report generation',
          )
        }
        const [visit, photos, plans] = await Promise.all([
          getVisit(visitId),
          listPhotos(visitId),
          listPlans(visitId),
        ])
        const model = buildReportModel({
          visit,
          photos,
          plans,
          options,
          todayIso: todayIso(),
          generatedAt: localNow(),
        })
        const onProgress = (progress: ReportProgress) => {
          setState({ status: 'running', progress })
        }
        onProgress({ stage: 'plans', done: 0, total: 0 })
        // Evaluated at the first generation only (inlined in the single file).
        const [{ prepareReportAssets, rasterizeLogo }, { renderReportDocx }] = await Promise.all([
          import('./render/prepareReportAssets'),
          import('./render/renderReportDocx'),
        ])
        if (!logoSrc) throw new Error('Logo missing from the build')
        const assets = await prepareReportAssets({
          model,
          photos,
          plans,
          pins: visit.pins,
          quality: options.quality,
          logo: await rasterizeLogo(logoSrc),
          onProgress,
        })
        const blob = await renderReportDocx(model, assets)
        downloadBlob(blob, model.fileName)
        await recordReportGenerated(visitId, nowIso())
        toast.success(`Rapport généré (${formatFileSize(blob.size)})`, {
          description: model.fileName,
        })
        setState({ status: 'done', fileName: model.fileName, bytes: blob.size })
      } catch (error) {
        console.error('[report] generation failed:', error)
        setState({ status: 'error', error })
      } finally {
        running.current = false
      }
    },
    [visitId, flush],
  )

  return { state, generate }
}
