import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_DELAY_MS, useVisitDraft } from '@/features/visits/useVisitDraft'
import { createVisit, getVisit, updateVisit } from '@/features/visits/visitsRepo'
import { NotFoundError, ValidationError } from '@/lib/errors'
import type * as VisitsRepo from '@/features/visits/visitsRepo'
import type { Visit } from '@/types/visit'

// Spy on the repository while keeping its real behavior.
vi.mock('@/features/visits/visitsRepo', async (importOriginal) => {
  const original = await importOriginal<typeof VisitsRepo>()
  return { ...original, updateVisit: vi.fn(original.updateVisit) }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const setTitle = (title: string) => (v: Visit) => ({ ...v, title })

/**
 * `waitFor` for fake timers: Dexie schedules its live queries with
 * `setTimeout(…, 0)` (faked here) while fake-indexeddb runs on the real
 * `setImmediate`. Flush both, without moving the fake clock forward.
 */
async function settle(check: () => unknown): Promise<void> {
  let lastError: unknown
  for (let i = 0; i < 200; i++) {
    try {
      await check()
      return
    } catch (error) {
      lastError = error
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
  throw lastError
}

/** Awaits a promise while pumping timers and IndexedDB (see `settle`). */
async function pump<T>(promise: Promise<T>): Promise<T> {
  let settled = false
  const tracked = promise.finally(() => {
    settled = true
  })
  await settle(() => {
    if (!settled) throw new Error('Promise still pending')
  })
  return tracked
}

async function setup() {
  const visit = await createVisit({
    kind: 'technical_visit',
    title: 'Titre initial',
    date: '2026-09-28',
    siteName: 'Site',
  })
  // Only timers used by the debounce are faked: IndexedDB (setImmediate) keeps running.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const hook = renderHook(() => useVisitDraft(visit.id))
  await settle(() => {
    expect(hook.result.current.draft?.title).toBe('Titre initial')
  })
  vi.mocked(updateVisit).mockClear()
  return { visit, ...hook }
}

describe('useVisitDraft', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('saves once, 800 ms after several quick updates, going dirty → saving → saved', async () => {
    const { visit, result } = await setup()
    expect(result.current.status).toBe('idle')

    act(() => {
      result.current.update(setTitle('A'))
    })
    expect(result.current.status).toBe('dirty')
    expect(result.current.draft?.title).toBe('A')
    act(() => {
      vi.advanceTimersByTime(500)
      result.current.update(setTitle('AB'))
    })
    act(() => {
      vi.advanceTimersByTime(500)
      result.current.update(setTitle('ABC'))
    })
    expect(updateVisit).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    })
    expect(updateVisit).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.status).toBe('saving')
    await settle(() => {
      expect(result.current.status).toBe('saved')
    })
    expect(updateVisit).toHaveBeenCalledTimes(1)
    expect((await getVisit(visit.id)).title).toBe('ABC')
    expect(result.current.draft?.title).toBe('ABC')
  })

  it('flush saves immediately', async () => {
    const { visit, result } = await setup()
    act(() => {
      result.current.update(setTitle('Tout de suite'))
    })
    await pump(result.current.flush())
    expect(updateVisit).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('saved')
    expect((await getVisit(visit.id)).title).toBe('Tout de suite')
    // Nothing pending: no second save when the timer would have fired.
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2)
    })
    expect(updateVisit).toHaveBeenCalledTimes(1)
  })

  it('saves on unmount', async () => {
    const { visit, result, unmount } = await setup()
    act(() => {
      result.current.update(setTitle('Avant de partir'))
    })
    unmount()
    await settle(async () => {
      expect((await getVisit(visit.id)).title).toBe('Avant de partir')
    })
    expect(updateVisit).toHaveBeenCalledTimes(1)
  })

  it('saves when the page is hidden', async () => {
    const { visit, result } = await setup()
    act(() => {
      result.current.update(setTitle('Onglet caché'))
    })
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await settle(() => {
      expect(result.current.status).toBe('saved')
    })
    expect((await getVisit(visit.id)).title).toBe('Onglet caché')
  })

  it('does not overwrite a dirty draft with database changes, and resyncs when clean', async () => {
    const { visit, result } = await setup()
    act(() => {
      result.current.update(setTitle('Saisie en cours'))
    })
    // Another action changes the visit in the database meanwhile.
    await pump(
      updateVisit(visit.id, (v) => ({ ...v, title: 'Autre', site: { name: 'Nouveau site' } })),
    )
    await settle(() => {
      expect(result.current.draft?.site.name).toBe('Nouveau site')
    })
    expect(result.current.draft?.title).toBe('Saisie en cours')
    expect(result.current.status).toBe('dirty')

    await pump(result.current.flush())
    // Both changes are kept: the local one replayed on the fresher data.
    expect(await getVisit(visit.id)).toMatchObject({
      title: 'Saisie en cours',
      site: { name: 'Nouveau site' },
    })

    // Clean draft: follows the database.
    await pump(updateVisit(visit.id, (v) => ({ ...v, title: 'Changé ailleurs' })))
    await settle(() => {
      expect(result.current.draft?.title).toBe('Changé ailleurs')
    })
  })

  it('keeps changes made while a save is running and saves them afterwards', async () => {
    const { visit, result } = await setup()
    const actual = await vi.importActual<typeof VisitsRepo>('@/features/visits/visitsRepo')
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    vi.mocked(updateVisit).mockImplementationOnce(async (...args) => {
      await gate
      return actual.updateVisit(...args)
    })

    act(() => {
      result.current.update(setTitle('Premier'))
    })
    const flushing = result.current.flush()
    await settle(() => {
      expect(updateVisit).toHaveBeenCalledTimes(1)
    })
    expect(result.current.status).toBe('saving')
    // Typed while the first save is still running.
    act(() => {
      result.current.update((v) => ({ ...v, site: { name: 'Pendant la sauvegarde' } }))
    })
    release()
    await pump(flushing)
    expect(result.current.draft).toMatchObject({
      title: 'Premier',
      site: { name: 'Pendant la sauvegarde' },
    })
    expect(result.current.status).toBe('dirty')
    expect((await getVisit(visit.id)).site.name).toBe('Site')

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    })
    await settle(() => {
      expect(result.current.status).toBe('saved')
    })
    expect(updateVisit).toHaveBeenCalledTimes(2)
    expect(await getVisit(visit.id)).toMatchObject({
      title: 'Premier',
      site: { name: 'Pendant la sauvegarde' },
    })
  })

  it('a ValidationError sets status error, keeps the draft and does not retry by itself', async () => {
    const { visit, result } = await setup()
    act(() => {
      result.current.update(setTitle(''))
    })
    await pump(result.current.flush())
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeInstanceOf(ValidationError)
    expect(result.current.draft?.title).toBe('')
    expect((await getVisit(visit.id)).title).toBe('Titre initial')
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith(
      'Erreur d’enregistrement',
      expect.objectContaining({
        description: expect.stringContaining('Le titre est obligatoire') as string,
      }),
    )

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 5)
    })
    expect(updateVisit).toHaveBeenCalledTimes(1)

    // The user fixes the field: saving resumes.
    act(() => {
      result.current.update(setTitle('Corrigé'))
    })
    expect(result.current.status).toBe('dirty')
    await pump(result.current.flush())
    expect(result.current.status).toBe('saved')
    expect(result.current.error).toBeUndefined()
    expect((await getVisit(visit.id)).title).toBe('Corrigé')
  })

  it('coalesces consecutive updates with the same key (one pending update per field)', async () => {
    const { visit, result } = await setup()
    const calls: string[] = []
    const setTitleTracked = (title: string) => (v: Visit) => {
      calls.push(title)
      return { ...v, title }
    }
    act(() => {
      result.current.update(setTitleTracked('A'), { coalesceKey: 'title' })
      result.current.update(setTitleTracked('AB'), { coalesceKey: 'title' })
      result.current.update(setTitleTracked('ABC'), { coalesceKey: 'title' })
    })
    expect(result.current.draft?.title).toBe('ABC')
    calls.length = 0
    await pump(result.current.flush())
    // Only the last updater of the run is replayed on save.
    expect(calls).toEqual(['ABC'])
    expect((await getVisit(visit.id)).title).toBe('ABC')

    // A different key in between breaks the run: both are kept, in order.
    act(() => {
      result.current.update(setTitleTracked('X'), { coalesceKey: 'title' })
      result.current.update((v) => ({ ...v, site: { name: 'S2' } }), { coalesceKey: 'site' })
      result.current.update(setTitleTracked('Y'), { coalesceKey: 'title' })
    })
    calls.length = 0
    await pump(result.current.flush())
    expect(calls).toEqual(['X', 'Y'])
    expect(await getVisit(visit.id)).toMatchObject({ title: 'Y', site: { name: 'S2' } })
  })

  it('reports an unknown visit as not found (not loading)', async () => {
    const { result } = renderHook(() => useVisitDraft('missing'))
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.draft).toBeUndefined()
    expect(result.current.error).toBeInstanceOf(NotFoundError)
  })
})
