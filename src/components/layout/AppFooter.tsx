import { AlertTriangle, HardDrive } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  formatStorageSize,
  getStorageEstimate,
  onStorageChange,
  type StorageEstimate,
} from '@/lib/db/storage'
import { cn } from '@/lib/utils'

/** Usage ratio above which the user is asked to free some space. */
export const STORAGE_WARNING_PERCENT = 80

/**
 * Footer showing the browser storage used by the tool. Refreshed on mount and
 * after each deletion. Renders nothing if the browser cannot tell.
 */
export function AppFooter() {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => {
      void getStorageEstimate().then((value) => {
        if (active) setEstimate(value)
      })
    }
    refresh()
    const unsubscribe = onStorageChange(refresh)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (!estimate) return null
  const almostFull = estimate.percent > STORAGE_WARNING_PERCENT

  return (
    <footer className="border-t bg-surface/60">
      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center gap-2 px-6 py-3 text-xs',
          almostFull ? 'font-medium text-warning' : 'text-muted-foreground',
        )}
      >
        {almostFull ? (
          <AlertTriangle className="size-3.5" aria-hidden="true" />
        ) : (
          <HardDrive className="size-3.5" aria-hidden="true" />
        )}
        <span>{formatStorageSize(estimate.usedBytes)} utilisés dans ce navigateur</span>
        {almostFull && (
          <span>— Espace bientôt plein — exportez puis supprimez d’anciennes visites</span>
        )}
      </div>
    </footer>
  )
}
