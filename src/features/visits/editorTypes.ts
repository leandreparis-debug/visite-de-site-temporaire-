import type { Visit } from '@/types/visit'
import type { VisitDraft } from './useVisitDraft'

/** Props received by every editor tab. */
export interface VisitTabProps {
  visit: Visit
  update: VisitDraft['update']
}
