import {
  ArrowLeft,
  CalendarDays,
  Construction,
  FileSearch,
  MapPin,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from '@/app/Link'
import { navigate, type VisitTab } from '@/app/router'
import { EmptyState } from '@/components/layout/EmptyState'
import { getDoInsuranceOverview } from '@/features/do/doInsuranceOverview'
import { DoInsuranceTab } from '@/features/do/DoInsuranceTab'
import { GeneralTab } from '@/features/general/GeneralTab'
import { NotesTab } from '@/features/notes/NotesTab'
import { countPhotos } from '@/features/photos/photosRepo'
import { PhotosTab } from '@/features/photos/PhotosTab'
import { PlanTab } from '@/features/plan/PlanTab'
import { useLiveResult } from '@/lib/db/useLiveResult'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateFr } from '@/lib/dates'
import { NotFoundError, toUserMessage } from '@/lib/errors'
import { useToday } from '@/lib/useToday'
import { InlineEditableTitle } from './InlineEditableTitle'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import { useVisitDraft } from './useVisitDraft'
import { VisitActionDialogs, type VisitAction } from './VisitActionDialogs'
import { VisitActionsMenu } from './VisitActionsMenu'
import { VisitKindBadge } from './VisitKindBadge'

const TAB_LABELS: Record<VisitTab, string> = {
  general: 'Informations générales',
  notes: 'Notes',
  photos: 'Photos',
  plan: 'Plan',
  'do-insurance': 'DO & assurances',
  'projects-costs': 'Projets & coûts',
  report: 'Rapport',
}
const TABS = Object.keys(TAB_LABELS) as VisitTab[]

export interface VisitEditorPageProps {
  visitId: string
  tab: VisitTab
}

/**
 * Editing screen of one visit: header (inline title, save status, actions) and
 * tabs synchronized with the URL. Render with `key={visitId}`.
 */
export function VisitEditorPage({ visitId, tab }: VisitEditorPageProps) {
  const { draft, isLoading, update, status, error, flush, discard } = useVisitDraft(visitId)
  const [action, setAction] = useState<VisitAction | null>(null)
  const { data: photoCount } = useLiveResult(() => countPhotos(visitId), `photo-count-${visitId}`)
  const today = useToday()

  if (isLoading) return <EditorSkeleton />
  if (!draft) {
    const notFound = error instanceof NotFoundError
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          icon={FileSearch}
          title={notFound ? 'Visite introuvable' : 'Impossible d’ouvrir la visite'}
          description={
            notFound ? 'Cette visite n’existe pas ou a été supprimée.' : toUserMessage(error)
          }
          action={
            <Link
              to={{ name: 'visits' }}
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Retour à la liste des visites
            </Link>
          }
        />
      </div>
    )
  }

  const target = { id: draft.id, title: draft.title }
  const doOverview = getDoInsuranceOverview(draft, today)

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink onNavigate={() => void flush()} />
        <div className="flex items-start justify-between gap-4">
          <InlineEditableTitle
            value={draft.title}
            onCommit={(title) => {
              update((visit) => ({ ...visit, title }))
            }}
          />
          <div className="flex shrink-0 items-center gap-2">
            <SaveStatusIndicator status={status} onRetry={() => void flush()} />
            <VisitActionsMenu
              visitTitle={draft.title}
              onDuplicate={() => {
                setAction({ type: 'duplicate', visit: target })
              }}
              onDelete={() => {
                setAction({ type: 'delete', visit: target })
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <VisitKindBadge kind={draft.kind} />
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateFr(draft.date)}
            {draft.startTime && ` à ${draft.startTime.replace(':', 'h')}`}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {draft.site.name}
          </span>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          void flush()
          navigate({ name: 'visit', visitId, tab: value as VisitTab })
        }}
      >
        <TabsList className="h-auto! w-full flex-wrap justify-start">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="flex-none px-3">
              {value === 'photos' && photoCount !== undefined
                ? `${TAB_LABELS[value]} (${photoCount})`
                : value === 'plan'
                  ? `${TAB_LABELS[value]} (${draft.pins.length})`
                  : value === 'do-insurance'
                    ? `${TAB_LABELS[value]} (${doOverview.tabCount})`
                    : TAB_LABELS[value]}
              {value === 'do-insurance' && doOverview.hasAlert && (
                <>
                  <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                  <span className="sr-only">— alerte</span>
                </>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((value) => (
          <TabsContent key={value} value={value} className="pt-2">
            {value === 'general' ? (
              <GeneralTab visit={draft} update={update} />
            ) : value === 'notes' ? (
              <NotesTab visit={draft} update={update} />
            ) : value === 'photos' ? (
              <PhotosTab visit={draft} />
            ) : value === 'plan' ? (
              <PlanTab visit={draft} update={update} />
            ) : value === 'do-insurance' ? (
              <DoInsuranceTab visit={draft} update={update} />
            ) : (
              <ComingSoon icon={Construction} label={TAB_LABELS[value]} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <VisitActionDialogs
        action={action}
        onClose={() => {
          setAction(null)
        }}
        beforeAction={async (type) => {
          if (type === 'delete') {
            // The visit is going away: drop unsaved changes instead of saving them.
            discard()
            return true
          }
          // Duplicate the latest version, including unsaved changes.
          return flush()
        }}
        onDeleted={() => {
          navigate({ name: 'visits' })
        }}
      />
    </div>
  )
}

function BackLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to={{ name: 'visits' }}
      onClick={onNavigate}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Visites
    </Link>
  )
}

function ComingSoon({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <EmptyState
      icon={icon}
      title="Bientôt disponible"
      description={`L’onglet « ${label} » arrive dans une prochaine étape.`}
    />
  )
}

function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement de la visite">
      <Skeleton className="h-4 w-20 bg-muted" />
      <Skeleton className="h-8 w-2/3 bg-muted" />
      <Skeleton className="h-4 w-1/2 bg-muted" />
      <Skeleton className="h-10 w-full bg-muted" />
      <Skeleton className="h-64 w-full rounded-xl bg-muted" />
    </div>
  )
}
