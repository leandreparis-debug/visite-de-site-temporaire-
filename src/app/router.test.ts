import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { navigate, parseHash, routeToHash, useRoute, VISIT_TABS } from '@/app/router'

describe('router', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
  })

  it('parses every route', () => {
    expect(parseHash('#/')).toEqual({ name: 'visits' })
    expect(parseHash('')).toEqual({ name: 'visits' })
    expect(parseHash('#/visits/abc')).toEqual({ name: 'visit', visitId: 'abc', tab: 'general' })
    for (const tab of VISIT_TABS) {
      expect(parseHash(`#/visits/abc/${tab}`)).toEqual({ name: 'visit', visitId: 'abc', tab })
    }
    expect(parseHash('#/visits/a%20b/notes')).toEqual({
      name: 'visit',
      visitId: 'a b',
      tab: 'notes',
    })
  })

  it('keeps the active plan (?p=) on the plan tab only, backward compatible', () => {
    expect(parseHash('#/visits/v1/plan?p=abc')).toEqual({
      name: 'visit',
      visitId: 'v1',
      tab: 'plan',
      planId: 'abc',
    })
    expect(parseHash('#/visits/v1/plan')).toEqual({ name: 'visit', visitId: 'v1', tab: 'plan' })
    expect(parseHash('#/visits/v1/notes?p=abc')).toEqual({
      name: 'visit',
      visitId: 'v1',
      tab: 'notes',
    })
    expect(routeToHash({ name: 'visit', visitId: 'v1', tab: 'plan', planId: 'a b' })).toBe(
      '#/visits/v1/plan?p=a%20b',
    )
    expect(routeToHash({ name: 'visit', visitId: 'v1', tab: 'notes', planId: 'x' })).toBe(
      '#/visits/v1/notes',
    )
    expect(
      parseHash(routeToHash({ name: 'visit', visitId: 'v1', tab: 'plan', planId: 'a b' })),
    ).toEqual({
      name: 'visit',
      visitId: 'v1',
      tab: 'plan',
      planId: 'a b',
    })
  })

  it('redirects unknown tabs to general and unknown routes to the list', () => {
    expect(parseHash('#/visits/abc/unknown')).toEqual({
      name: 'visit',
      visitId: 'abc',
      tab: 'general',
    })
    for (const hash of [
      '#/unknown',
      '#/visits',
      '#/visits/a/b/c',
      '#visits',
      '#/visits/%E0%A4%A/notes',
    ]) {
      expect(parseHash(hash)).toEqual({ name: 'visits' })
    }
  })

  it('round-trips routes to canonical hashes', () => {
    expect(routeToHash({ name: 'visits' })).toBe('#/')
    const route = { name: 'visit', visitId: 'x/y', tab: 'plan' } as const
    expect(routeToHash(route)).toBe('#/visits/x%2Fy/plan')
    expect(parseHash(routeToHash(route))).toEqual(route)
  })

  it('navigate changes the hash and useRoute follows it', () => {
    const { result } = renderHook(() => useRoute())
    expect(result.current).toEqual({ name: 'visits' })

    act(() => {
      navigate({ name: 'visit', visitId: 'v1', tab: 'photos' })
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(window.location.hash).toBe('#/visits/v1/photos')
    expect(result.current).toEqual({ name: 'visit', visitId: 'v1', tab: 'photos' })
  })

  it('useRoute canonicalizes the hash (replace, no new history entry)', () => {
    window.history.replaceState(null, '', '#/visits/v1/unknown')
    const historyLength = window.history.length
    const { result } = renderHook(() => useRoute())
    expect(result.current).toEqual({ name: 'visit', visitId: 'v1', tab: 'general' })
    expect(window.location.hash).toBe('#/visits/v1/general')
    expect(window.history.length).toBe(historyLength)

    act(() => {
      window.history.replaceState(null, '', '#/nowhere')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(window.location.hash).toBe('#/')
    expect(result.current).toEqual({ name: 'visits' })
  })
})
