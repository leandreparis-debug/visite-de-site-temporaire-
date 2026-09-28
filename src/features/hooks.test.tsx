import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addPhoto, deletePhoto } from '@/features/photos/photosRepo'
import { usePhotos } from '@/features/photos/usePhotos'
import { addPlan, renamePlan } from '@/features/plan/plansRepo'
import { usePlans } from '@/features/plan/usePlans'
import { useVisit, useVisitSummaries } from '@/features/visits/useVisits'
import { createVisit, updateVisit } from '@/features/visits/visitsRepo'
import { NotFoundError } from '@/lib/errors'
import { makePhotoInput, makePlanInput } from '@/test/fixtures'

const newVisit = (title = 'Visite') =>
  createVisit({ kind: 'technical_visit', title, date: '2026-09-28', siteName: 'Site' })

describe('reactive hooks', () => {
  it('useVisitSummaries starts loading, then reacts to changes', async () => {
    const { result } = renderHook(() => useVisitSummaries())
    expect(result.current).toEqual({ data: undefined, isLoading: true, error: undefined })

    await waitFor(() => {
      expect(result.current.data).toEqual([])
    })
    expect(result.current.isLoading).toBe(false)

    await act(() => newVisit('Nouvelle'))
    await waitFor(() => {
      expect(result.current.data?.map((s) => s.title)).toEqual(['Nouvelle'])
    })
  })

  it('useVisit distinguishes loading from not found, and follows updates', async () => {
    const visit = await newVisit()
    const { result, rerender } = renderHook(({ id }) => useVisit(id), {
      initialProps: { id: visit.id },
    })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => {
      expect(result.current.data?.title).toBe('Visite')
    })

    await act(() => updateVisit(visit.id, (v) => ({ ...v, title: 'Titre modifié' })))
    await waitFor(() => {
      expect(result.current.data?.title).toBe('Titre modifié')
    })

    rerender({ id: 'missing' })
    // Never returns the previous visit for a new id.
    expect(result.current.data).toBeUndefined()
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeInstanceOf(NotFoundError)
  })

  it('usePhotos and usePlans react to repository changes', async () => {
    const visit = await newVisit()
    const photos = renderHook(() => usePhotos(visit.id))
    const plans = renderHook(() => usePlans(visit.id))
    await waitFor(() => {
      expect(photos.result.current.data).toEqual([])
      expect(plans.result.current.data).toEqual([])
    })

    const photo = await act(() => addPhoto(makePhotoInput(visit.id)))
    const plan = await act(() => addPlan(makePlanInput(visit.id, { name: 'RDC' })))
    await waitFor(() => {
      expect(photos.result.current.data?.map((p) => p.id)).toEqual([photo.id])
      expect(plans.result.current.data?.map((p) => p.name)).toEqual(['RDC'])
    })

    await act(() => renamePlan(plan.id, 'R+1'))
    await act(() => deletePhoto(photo.id))
    await waitFor(() => {
      expect(photos.result.current.data).toEqual([])
      expect(plans.result.current.data?.map((p) => p.name)).toEqual(['R+1'])
    })
  })
})
