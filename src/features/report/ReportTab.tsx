import { AlertTriangle, FileDown, Loader2, RotateCcw } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link } from '@/app/Link'
import { SectionCard } from '@/components/form/DraftFields'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { Button } from '@/components/ui/button'
import { setCoverPhoto } from '@/features/photos/photoRefsOps'
import { usePhotos } from '@/features/photos/usePhotos'
import { CoverPhotoCard } from './CoverPhotoCard'
import { usePlans } from '@/features/plan/usePlans'
import type { VisitDraft } from '@/features/visits/useVisitDraft'
import type { Visit } from '@/types/visit'
import { toUserMessage } from '@/lib/errors'
import { useToday } from '@/lib/useToday'
import { cn } from '@/lib/utils'
import { buildReportModel } from './model/buildReportModel'
import { estimateReportSize, formatFileSize } from './model/estimateReportSize'
import { getReportChecks, getReportContents } from './model/reportContents'
import {
  DEFAULT_REPORT_OPTIONS,
  REPORT_SECTION_KEYS,
  REPORT_SECTION_TITLES,
  reportImageIds,
  type PhotosPerPage,
  type ReportOptions,
  type ReportQuality,
} from './model/reportModel'
import { formatReportGenerated, useReportDates } from './reportMeta'
import { formatReportProgress, useReportGeneration } from './useReportGeneration'

const PER_PAGE_OPTIONS = [
  { value: '6', label: '6 par page' },
  { value: '4', label: '4 par page' },
  { value: '2', label: '2 par page' },
] as const
type PerPageValue = (typeof PER_PAGE_OPTIONS)[number]['value']
const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'light', label: 'Allégée' },
] as const

export interface ReportTabProps {
  visit: Visit
  /** Edits the visit (cover photo). */
  update: VisitDraft['update']
  /** Saves the pending changes of the editor (called before generating). */
  flush: () => Promise<boolean>
}

/**
 * "Rapport" tab: choice of the sections (with a preview of their content),
 * photo and image options, estimated size, points to check, then generation
 * of the Word report with its progress.
 */
export function ReportTab({ visit, update, flush }: ReportTabProps) {
  const today = useToday()
  const { data: photos = [] } = usePhotos(visit.id)
  const { data: plans = [] } = usePlans(visit.id)
  const reportDates = useReportDates()
  const [options, setOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS)
  const { state, generate } = useReportGeneration(visit.id, flush)
  const onlyPinnedId = useId()

  const contents = useMemo(
    () => getReportContents({ visit, photos, plans, options, todayIso: today }),
    [visit, photos, plans, options, today],
  )
  const checks = useMemo(() => getReportChecks(visit, photos), [visit, photos])
  /** Sections actually generated: checked and not empty. */
  const effectiveSections = useMemo(
    () =>
      Object.fromEntries(
        REPORT_SECTION_KEYS.map((key) => [key, options.sections[key] && !contents[key].empty]),
      ) as ReportOptions['sections'],
    [options.sections, contents],
  )
  const effectiveOptions: ReportOptions = { ...options, sections: effectiveSections }
  const estimate = useMemo(() => {
    // Images of the report as it would be generated (cover, notes, plans, photo sheet).
    const { planIds, photoIds } = reportImageIds(
      buildReportModel({
        visit,
        photos,
        plans,
        options: { ...options, sections: effectiveSections },
        todayIso: today,
        generatedAt: `${today}T00:00`,
      }),
    )
    const shownPhotos = new Set(photoIds)
    const shownPlans = new Set(planIds)
    return estimateReportSize({
      photos: photos
        .filter((p) => shownPhotos.has(p.id))
        .map((p) => ({ bytes: p.blob.size, width: p.width, height: p.height })),
      plans: plans.filter((p) => shownPlans.has(p.id)),
      quality: options.quality,
    })
  }, [visit, photos, plans, options, effectiveSections, today])
  const nothingSelected = REPORT_SECTION_KEYS.every((key) => !effectiveOptions.sections[key])
  const running = state.status === 'running'
  const lastReport = reportDates[visit.id]

  const toggleSection = (key: (typeof REPORT_SECTION_KEYS)[number], checked: boolean) => {
    setOptions((o) => ({ ...o, sections: { ...o.sections, [key]: checked } }))
  }

  return (
    <div className="grid grid-cols-[1fr_22rem] items-start gap-6">
      <div className="space-y-6">
        <SectionCard
          title="Contenu du rapport"
          headingId="report-contents"
          description="Les rubriques vides sont automatiquement omises."
        >
          <ul className="divide-y">
            {REPORT_SECTION_KEYS.map((key, index) => {
              const content = contents[key]
              const inputId = `report-section-${key}`
              return (
                <li key={key} className="flex items-center gap-3 py-2.5">
                  <input
                    id={inputId}
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={effectiveOptions.sections[key]}
                    disabled={content.empty || running}
                    onChange={(event) => {
                      toggleSection(key, event.target.checked)
                    }}
                  />
                  <label
                    htmlFor={inputId}
                    className={cn(
                      'flex flex-1 flex-wrap items-baseline gap-x-2 text-sm',
                      content.empty && 'text-muted-foreground',
                    )}
                  >
                    <span className="font-medium">
                      {index + 1}. {REPORT_SECTION_TITLES[key]}
                    </span>
                    <span className={cn('text-muted-foreground', content.empty && 'italic')}>
                      — {content.preview}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </SectionCard>

        {checks.length > 0 && (
          <section
            aria-labelledby="report-checks"
            className="rounded-xl border border-warning/40 bg-warning/5 p-5"
          >
            <h3 id="report-checks" className="flex items-center gap-2 font-semibold text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Points à vérifier
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Rien de bloquant : le rapport peut être généré tel quel.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {checks.map((check) => (
                <li key={check.id}>
                  <Link
                    to={{ name: 'visit', visitId: visit.id, tab: check.tab }}
                    className="text-warning underline-offset-4 hover:underline"
                  >
                    {check.text}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="space-y-6">
        <CoverPhotoCard
          photos={photos}
          coverPhotoId={visit.coverPhotoId}
          disabled={running}
          onChange={(photoId) => {
            update((v) => setCoverPhoto(v, photoId))
          }}
        />
        <SectionCard title="Options" headingId="report-options">
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium">Planche photos</p>
              <SegmentedControl<PerPageValue>
                label="Photos par page"
                options={PER_PAGE_OPTIONS}
                value={String(options.photosPerPage) as PerPageValue}
                onChange={(value) => {
                  setOptions((o) => ({ ...o, photosPerPage: Number(value) as PhotosPerPage }))
                }}
              />
            </div>
            <label htmlFor={onlyPinnedId} className="flex cursor-pointer items-center gap-2">
              <input
                id={onlyPinnedId}
                type="checkbox"
                className="size-4 accent-brand"
                checked={options.onlyPinnedPhotos}
                onChange={(event) => {
                  setOptions((o) => ({ ...o, onlyPinnedPhotos: event.target.checked }))
                }}
              />
              Uniquement les photos placées sur un plan
            </label>
            <div className="space-y-1.5">
              <p className="font-medium">Qualité des images</p>
              <SegmentedControl<ReportQuality>
                label="Qualité des images"
                options={QUALITY_OPTIONS}
                value={options.quality}
                onChange={(quality) => {
                  setOptions((o) => ({ ...o, quality }))
                }}
              />
              <p className="text-xs text-muted-foreground">
                « Allégée » réduit les photos pour un envoi par mail.
              </p>
            </div>
            <p className="rounded-lg bg-muted px-3 py-2" aria-live="polite">
              Taille estimée : <strong>environ {formatFileSize(estimate)}</strong>
            </p>
          </div>
        </SectionCard>

        <div className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
          <Button
            className="w-full"
            size="lg"
            disabled={running || nothingSelected}
            onClick={() => void generate(effectiveOptions)}
          >
            {running ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <FileDown aria-hidden="true" />
            )}
            Générer le rapport Word
          </Button>
          <div role="status" aria-live="polite" className="text-sm">
            {state.status === 'running' && (
              <p className="flex items-center gap-2 text-brand">
                {formatReportProgress(state.progress)}
              </p>
            )}
          </div>
          {state.status === 'error' && (
            <div role="alert" className="space-y-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
              <p>
                <strong>Génération impossible.</strong> {toUserMessage(state.error)}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="bg-surface"
                onClick={() => void generate(effectiveOptions)}
              >
                <RotateCcw aria-hidden="true" />
                Réessayer
              </Button>
            </div>
          )}
          {lastReport && (
            <p className="text-xs text-muted-foreground">{formatReportGenerated(lastReport)}.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Le rapport Word est la seule copie durable de la visite : conservez-le.
          </p>
        </div>
      </aside>
    </div>
  )
}
