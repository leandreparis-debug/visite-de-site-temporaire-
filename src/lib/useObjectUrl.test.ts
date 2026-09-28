import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useObjectUrl } from '@/lib/useObjectUrl'

describe('useObjectUrl', () => {
  let counter = 0
  const createObjectURL = vi.fn(() => `blob:test/${++counter}`)
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    // jsdom does not implement object URLs.
    Object.assign(URL, { createObjectURL, revokeObjectURL })
  })
  afterEach(() => {
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  it('creates a URL for the blob and revokes it on unmount', () => {
    const blob = new Blob(['a'])
    const { result, unmount } = renderHook(() => useObjectUrl(blob))
    expect(result.current).toMatch(/^blob:test\//)
    expect(createObjectURL).toHaveBeenCalledWith(blob)

    const url = result.current
    unmount()
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
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl)
    expect(result.current).not.toBe(firstUrl)
    expect(result.current).toMatch(/^blob:test\//)

    const secondUrl = result.current
    rerender({ blob: null })
    expect(result.current).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith(secondUrl)
  })
})
