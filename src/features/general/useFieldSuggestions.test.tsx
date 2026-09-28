import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { computeFieldSuggestions, DEFAULT_AUTHORS } from '@/features/general/fieldSuggestions'
import { useFieldSuggestions } from '@/features/general/useFieldSuggestions'
import { seedVisit } from '@/test/seed'
import { makeFullVisit } from '@/test/fixtures'

describe('field suggestions', () => {
  it('always includes the default authors', () => {
    expect(computeFieldSuggestions([]).authors).toEqual(
      [...DEFAULT_AUTHORS].sort((a, b) => a.localeCompare(b, 'fr')),
    )
  })

  it('dedupes case-insensitively, trims, sorts by frequency then alphabetically', () => {
    const visits = [
      makeFullVisit({
        id: 'v1',
        author: 'Zoé Petit',
        site: { name: 'Entrepôt Lyon', city: ' lyon ' },
      }),
      makeFullVisit({
        id: 'v2',
        author: 'zoé petit ',
        site: { name: 'ENTREPÔT LYON', city: 'Lille' },
      }),
      makeFullVisit({ id: 'v3', author: 'Emre Akagunduz', site: { name: 'Arras', city: 'Lyon' } }),
    ]
    const suggestions = computeFieldSuggestions(visits)
    expect(suggestions.authors).toEqual([
      'Zoé Petit',
      'Emre Akagunduz',
      'Arnaud Montigny',
      'Jean-Christophe Bains',
    ])
    expect(suggestions.siteNames).toEqual(['Entrepôt Lyon', 'Arras'])
    expect(suggestions.cities).toEqual(['lyon', 'Lille'])
    expect(suggestions.participantNames).toEqual(['Jeanne Martin', 'Paul Durand'])
    expect(suggestions.roles).toEqual(['Property Manager'])
    expect(suggestions.companies).toEqual(['Carrefour Property'])
  })

  it('skips the visit being edited', () => {
    const visits = [makeFullVisit({ id: 'current', author: 'Moi' }), makeFullVisit({ id: 'other' })]
    expect(computeFieldSuggestions(visits, 'current').authors).not.toContain('Moi')
  })

  it('useFieldSuggestions reads the stored visits reactively', async () => {
    const { result } = renderHook(() => useFieldSuggestions())
    expect(result.current.authors).toHaveLength(3)
    await seedVisit(
      { title: 'V', siteName: 'Site Nord', updatedAt: '2026-09-28T08:00:00.000Z' },
      { author: 'Nouvelle Personne' },
    )
    await waitFor(() => {
      expect(result.current.authors).toContain('Nouvelle Personne')
    })
    expect(result.current.siteNames).toEqual(['Site Nord'])
  })
})
