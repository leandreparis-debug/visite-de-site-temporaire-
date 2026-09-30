import * as z from 'zod/mini'
import { nowIso } from '@/lib/dates'
import { createId } from '@/lib/id'
import { isoDateSchema, requiredText } from '@/types/common'
import { VISIT_SCHEMA_VERSION, visitKindSchema, type Visit, type VisitKind } from '@/types/visit'

/** Minimal data needed to create a visit. */
export interface NewVisitInput {
  kind: VisitKind
  title: string
  /** `YYYY-MM-DD` */
  date: string
  siteName: string
}

/** Validation of the creation form (French messages). */
export const newVisitInputSchema = z.object({
  kind: visitKindSchema,
  title: requiredText('Le titre', 200),
  date: isoDateSchema,
  siteName: requiredText('Le nom du site'),
})

/** Builds a new, empty visit (not validated, not saved). */
export function createEmptyVisit(input: NewVisitInput, now: string = nowIso()): Visit {
  return {
    id: createId(),
    schemaVersion: VISIT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    kind: input.kind,
    title: input.title,
    date: input.date,
    site: { name: input.siteName },
    participants: [],
    noteSections: [],
    attentionPoints: [],
    doClaims: [],
    insurances: [],
    projects: [],
    costs: [],
    pins: [],
    nextPinNumber: 1,
  }
}

/** Choices offered when duplicating a visit. */
export interface DuplicateOptions {
  /** Copy the notes by area (text only, without their photos). */
  keepNotes?: boolean
}

const TITLE_MAX = 200
const COPY_PREFIX = 'Copie — '

/**
 * Builds the data of a follow-up visit from an existing one ("reprendre le suivi").
 *
 * Kept: site, participants (reset to absent), DO claims, insurances, projects,
 * costs, attention points not `done`, and the note sections when
 * `options.keepNotes` is set (text only: their links to photos are dropped).
 * Dropped: pins, cover photo (and photos, which live in another table). Every
 * sub-object gets a new id and `cost.projectId` is remapped to the new
 * project ids.
 *
 * Plans are copied separately by `duplicateVisit` (they live in their own table).
 */
export function duplicateVisitData(
  source: Visit,
  today: string,
  now: string = nowIso(),
  options: DuplicateOptions = {},
): Visit {
  const projectIdMap = new Map<string, string>()
  const projects = source.projects.map((project) => {
    const id = createId()
    projectIdMap.set(project.id, id)
    return { ...project, id }
  })

  return {
    id: createId(),
    schemaVersion: VISIT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    kind: source.kind,
    title: `${COPY_PREFIX}${source.title}`.slice(0, TITLE_MAX),
    date: today,
    ...(source.startTime !== undefined && { startTime: source.startTime }),
    site: { ...source.site },
    participants: source.participants.map((p) => ({ ...p, id: createId(), present: false })),
    noteSections: options.keepNotes
      ? source.noteSections.map(({ photoIds: _photos, ...section }) => ({
          ...section,
          id: createId(),
        }))
      : [],
    attentionPoints: source.attentionPoints
      .filter((point) => point.status !== 'done')
      .map((point) => ({ ...point, id: createId() })),
    doClaims: source.doClaims.map((claim) => ({
      ...claim,
      id: createId(),
      steps: claim.steps.map((step) => ({ ...step, id: createId() })),
    })),
    insurances: source.insurances.map((insurance) => ({ ...insurance, id: createId() })),
    projects,
    costs: source.costs.map((cost) => {
      const { projectId, ...rest } = cost
      const newProjectId = projectId === undefined ? undefined : projectIdMap.get(projectId)
      return {
        ...rest,
        id: createId(),
        ...(newProjectId !== undefined && { projectId: newProjectId }),
      }
    }),
    pins: [],
    nextPinNumber: 1,
  }
}
