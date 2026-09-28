/**
 * Minimal hash router.
 *
 * Why the hash: the app is a single `index.html` opened via `file://`, where
 * the History API cannot map paths to a file. `#/…` works in `file://`,
 * survives reloads, and needs no server nor dependency.
 *
 * Routes:
 * - `#/`                    → visit list
 * - `#/visits/:id`          → redirected to `#/visits/:id/general`
 * - `#/visits/:id/:tab`     → visit editor on a tab
 * Unknown tabs redirect to `general`, unknown routes to `#/`.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'

export const VISIT_TABS = [
  'general',
  'notes',
  'photos',
  'plan',
  'do-insurance',
  'projects-costs',
  'report',
] as const
export type VisitTab = (typeof VISIT_TABS)[number]

export const DEFAULT_VISIT_TAB: VisitTab = 'general'

/** Typed application route (discriminated union on `name`). */
export type Route = { name: 'visits' } | { name: 'visit'; visitId: string; tab: VisitTab }

export function isVisitTab(value: string): value is VisitTab {
  return (VISIT_TABS as readonly string[]).includes(value)
}

/** Canonical hash of a route, e.g. `#/visits/abc/notes`. */
export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'visits':
      return '#/'
    case 'visit':
      return `#/visits/${encodeURIComponent(route.visitId)}/${route.tab}`
  }
}

/**
 * Parses a location hash into a route. Never fails: unknown routes give the
 * visit list, unknown or missing tabs give `general`. Compare
 * `routeToHash(result)` with the input to know whether to redirect.
 */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const segments = path.split('/').filter(Boolean)
  if (segments[0] === 'visits' && segments.length >= 2 && segments.length <= 3) {
    let visitId: string
    try {
      visitId = decodeURIComponent(segments[1] ?? '')
    } catch {
      return { name: 'visits' }
    }
    const tab = segments[2] ?? DEFAULT_VISIT_TAB
    return { name: 'visit', visitId, tab: isVisitTab(tab) ? tab : DEFAULT_VISIT_TAB }
  }
  return { name: 'visits' }
}

// ─── Store over window.location.hash ─────────────────────────────────────────

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('hashchange', emit)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('hashchange', emit)
  }
}

function getHash(): string {
  return window.location.hash
}

/**
 * Navigates to a route (adds a history entry, so the browser Back button
 * works). With `replace`, the current entry is replaced instead.
 */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = routeToHash(route)
  if (options.replace) {
    if (window.location.hash === hash) return
    window.history.replaceState(window.history.state, '', hash)
    emit()
  } else {
    window.location.hash = hash
  }
}

/**
 * Current route, re-rendering on hash changes. Non-canonical hashes
 * (unknown route or tab, `#/visits/:id` without tab, empty hash) are
 * replaced by their canonical form.
 */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  const route = useMemo(() => parseHash(hash), [hash])
  const canonical = routeToHash(route)

  useEffect(() => {
    if (hash !== canonical) navigate(route, { replace: true })
  }, [hash, canonical, route])

  return route
}
