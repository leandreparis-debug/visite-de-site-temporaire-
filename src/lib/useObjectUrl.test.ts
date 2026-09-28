import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REVOKE_DELAY_MS, useObjectUrl } from '@/lib/useObjectUrl'

describe('useObjectUrl', () => {
  let counter = 0
  const createObjectURL = vi.fn(() => `blob:test/${++counter}`)
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    // jsdom does not implement object URLs.
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  it('creates a URL for the blob and revokes it shortly after unmount', () => {
    const blob = new Blob(['a'])
    const { result, unmount } = renderHook(() => useObjectUrl(blob))
    expect(result.current).toMatch(/^blob:test\//)
    expect(createObjectURL).toHaveBeenCalledWith(blob)

    const url = result.current
    unmount()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
  })

  it('revokes the previous URL when the blob changes, returns null without blob', () => {
    const first = new Blob(['a'])
    const second = new Blob(['b'])
    const { result, rerender } = renderHook<string | null, { blob: Blob | null }>(
      ({ blob }) => useObjectUrl(blob),
      { initialProps: { blob: first } },
    )
    const firstUrl = result.current

    rerender({ blob: second })
    vi.advanceTimersByTime(REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl)
    expect(result.current).not.toBe(firstUrl)
    expect(result.current).toMatch(/^blob:test\//)

    const secondUrl = result.current
    rerender({ blob: null })
    expect(result.current).toBeNull()
    vi.advanceTimersByTime(REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledWith(secondUrl)
  })

  it('shares one URL per blob and keeps it when it moves between components', () => {
    const blob = new Blob(['shared'])
    const a = renderHook(() => useObjectUrl(blob))
    const b = renderHook(() => useObjectUrl(blob))
    expect(a.result.current).toBe(b.result.current)
    expect(createObjectURL).toHaveBeenCalledTimes(1)

    a.unmount()
    vi.advanceTimersByTime(REVOKE_DELAY_MS * 2)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    // Released then re-acquired before the delay: not revoked, same URL.
    const url = b.result.current
    b.unmount()
    const c = renderHook(() => useObjectUrl(blob))
    vi.advanceTimersByTime(REVOKE_DELAY_MS * 2)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(c.result.current).toBe(url)
    c.unmount()
    vi.advanceTimersByTime(REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
  })
})
