import type { VisitTabProps } from '@/features/visits/editorTypes'
import { AttentionPointsPanel } from './AttentionPointsPanel'
import { NoteSectionsPanel } from './NoteSectionsPanel'

/** "Notes" tab: notes by area/theme, then attention points and actions. */
export function NotesTab(props: VisitTabProps) {
  return (
    <div className="grid gap-6">
      <NoteSectionsPanel {...props} />
      <AttentionPointsPanel {...props} />
    </div>
  )
}
