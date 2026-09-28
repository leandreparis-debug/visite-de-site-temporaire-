import { useId, useMemo } from 'react'
import { Suggestions } from '@/components/form/DraftFields'
import { useFieldSuggestions } from '@/features/general/useFieldSuggestions'
import { INSURANCES_SECTION_ID, InsurancesSection } from '@/features/insurance/InsurancesSection'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { cn } from '@/lib/utils'
import { useToday } from '@/lib/useToday'
import { DO_CLAIMS_SECTION_ID, DoClaimsSection } from './DoClaimsSection'
import {
  getDoInsuranceOverview,
  getOverviewItems,
  type DoInsuranceOverview,
  type OverviewTone,
} from './doInsuranceOverview'

/** "DO & assurances" tab: summary banner, insurance contracts, DO claims. */
export function DoInsuranceTab({ visit, update }: VisitTabProps) {
  const today = useToday()
  const suggestions = useFieldSuggestions(visit.id)
  const insurersListId = useId()
  const brokersListId = useId()
  const overview = getDoInsuranceOverview(visit, today)

  const doInsurers = useMemo(
    () =>
      unique(visit.insurances.filter((i) => i.type === 'dommages_ouvrage').map((i) => i.insurer)),
    [visit.insurances],
  )
  const knownInsurers = useMemo(
    () =>
      unique([
        ...visit.insurances.map((i) => i.insurer),
        ...visit.doClaims.map((c) => c.insurer ?? ''),
        ...suggestions.insurers,
      ]),
    [visit.insurances, visit.doClaims, suggestions.insurers],
  )
  const brokers = useMemo(
    () => unique([...visit.insurances.map((i) => i.broker ?? ''), ...suggestions.brokers]),
    [visit.insurances, suggestions.brokers],
  )

  return (
    <div className="space-y-6">
      <SummaryBanner overview={overview} />
      <InsurancesSection
        visit={visit}
        update={update}
        today={today}
        insurersListId={insurersListId}
        brokersListId={brokersListId}
      />
      <DoClaimsSection
        visit={visit}
        update={update}
        today={today}
        insurersListId={insurersListId}
        doInsurers={doInsurers}
        knownInsurers={knownInsurers}
      />
      <Suggestions id={insurersListId} values={unique([...doInsurers, ...knownInsurers])} />
      <Suggestions id={brokersListId} values={brokers} />
    </div>
  )
}

/** Case-insensitive deduplication, first spelling kept, blanks dropped. */
function unique(values: readonly string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.trim().toLocaleLowerCase('fr')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const SECTION_IDS = { claims: DO_CLAIMS_SECTION_ID, insurances: INSURANCES_SECTION_ID }

const TONE_CLASSES: Record<OverviewTone, string> = {
  danger: 'font-semibold text-danger',
  warning: 'font-semibold text-warning',
  neutral: 'text-foreground',
}

function SummaryBanner({ overview }: { overview: DoInsuranceOverview }) {
  const items = getOverviewItems(overview)
  return (
    <nav
      aria-label="Synthèse DO et assurances"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-card px-5 py-3 text-sm shadow-card',
        overview.hasAlert && 'border-danger/40',
      )}
    >
      {items.map((item, index) => (
        <span key={item.key} className="flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
          )}
          <button
            type="button"
            data-tone={item.tone}
            className={cn(
              'rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50',
              TONE_CLASSES[item.tone],
            )}
            onClick={() => {
              document
                .getElementById(SECTION_IDS[item.section])
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {item.text}
          </button>
        </span>
      ))}
    </nav>
  )
}
