import { CalendarDays, Camera, FileCheck2, MapPin, MapPinned } from 'lucide-react'
import { Link } from '@/app/Link'
import { navigate } from '@/app/router'
import { formatDateFr, formatRelativeFr } from '@/lib/dates'
import { formatReportGenerated } from '@/features/report/reportMeta'
import { pluralize } from '@/lib/notify'
import type { VisitSummary } from '@/types/visit'
import { VisitActionsMenu } from './VisitActionsMenu'
import type { VisitAction } from './VisitActionDialogs'
import { VisitKindBadge } from './VisitKindBadge'

export interface VisitCardProps {
  visit: VisitSummary
  onAction: (action: VisitAction) => void
  now: number
  /** Timestamp of the last Word report of this visit, if any. */
  reportGeneratedAt?: string
}

/**
 * Visit card of the list. The title link covers the whole card (click anywhere
 * opens the visit); the actions menu sits above it.
 */
export function VisitCard({ visit, onAction, now, reportGeneratedAt }: VisitCardProps) {
  const target = { id: visit.id, title: visit.title }
  const route = { name: 'visit', visitId: visit.id, tab: 'general' } as const
  return (
    <article className="group relative flex flex-col rounded-xl border bg-card p-4 shadow-card transition-shadow hover:border-brand/30 hover:shadow-md has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50">
      <div className="flex items-start justify-between gap-2">
        <VisitKindBadge kind={visit.kind} />
        <VisitActionsMenu
          visitTitle={visit.title}
          className="relative z-10 -mt-1 -mr-2"
          onOpen={() => {
            navigate(route)
          }}
          onDuplicate={() => {
            onAction({ type: 'duplicate', visit: target })
          }}
          onDelete={() => {
            onAction({ type: 'delete', visit: target })
          }}
        />
      </div>
      <h3 className="mt-2 line-clamp-2 leading-snug font-semibold">
        <Link
          to={route}
          className="outline-none group-hover:text-brand after:absolute after:inset-0 after:rounded-xl"
        >
          {visit.title}
        </Link>
      </h3>
      <dl className="mt-2 grid gap-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt>
            <MapPin className="size-3.5" aria-label="Site" />
          </dt>
          <dd className="truncate">{visit.siteName}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>
            <CalendarDays className="size-3.5" aria-label="Date" />
          </dt>
          <dd>{formatDateFr(visit.date)}</dd>
        </div>
        {reportGeneratedAt && (
          <div className="flex items-center gap-1.5 text-success">
            <dt>
              <FileCheck2 className="size-3.5" aria-label="Rapport Word" />
            </dt>
            <dd>{formatReportGenerated(reportGeneratedAt)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>Modifiée {formatRelativeFr(visit.updatedAt, now)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1" title={pluralize(visit.photoCount, 'photo')}>
            <Camera className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{pluralize(visit.photoCount, 'photo')}</span>
            <span aria-hidden="true">{visit.photoCount}</span>
          </span>
          <span className="flex items-center gap-1" title={pluralize(visit.pinCount, 'repère')}>
            <MapPinned className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{pluralize(visit.pinCount, 'repère')}</span>
            <span aria-hidden="true">{visit.pinCount}</span>
          </span>
        </span>
      </div>
    </article>
  )
}
