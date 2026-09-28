import { createEmptyVisit } from '@/features/visits/visitFactory'
import { db } from '@/lib/db/db'
import type { Visit, VisitKind } from '@/types/visit'

/** Stores a visit with explicit timestamps (deterministic ordering in tests). */
export async function seedVisit(
  input: { title: string; siteName: string; kind?: VisitKind; date?: string; updatedAt: string },
  overrides: Partial<Visit> = {},
): Promise<Visit> {
  const visit = {
    ...createEmptyVisit(
      {
        kind: input.kind ?? 'technical_visit',
        title: input.title,
        date: input.date ?? '2026-09-28',
        siteName: input.siteName,
      },
      input.updatedAt,
    ),
    ...overrides,
  }
  await db.visits.add(visit)
  return visit
}
