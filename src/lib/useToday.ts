import { todayIso } from '@/lib/dates'
import { useNow } from '@/lib/useNow'

/** Today's local date (`YYYY-MM-DD`), computed at render time and refreshed every minute. */
export function useToday(): string {
  return todayIso(new Date(useNow()))
}
