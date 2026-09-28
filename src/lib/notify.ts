import { toast } from 'sonner'
import { toUserMessage } from '@/lib/errors'

/** Logs an error and shows it as a French toast. Use for every failed user action. */
export function notifyError(error: unknown, title = 'Action impossible'): void {
  console.error(`[ui] ${title}:`, error)
  toast.error(title, { description: toUserMessage(error) })
}

/** French plural helper: `pluralize(2, 'photo')` → "2 photos". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count}\u00a0${count >= 2 ? plural : singular}`
}
