import { useLiveResult, type LiveResult } from '@/lib/db/useLiveResult'
import type { Photo } from '@/types/media'
import { listPhotos } from './photosRepo'

/** Reactive photos of a visit, sorted by `order`. Use `useObjectUrl` to display blobs. */
export function usePhotos(visitId: string): LiveResult<Photo[]> {
  return useLiveResult(() => listPhotos(visitId), visitId)
}
