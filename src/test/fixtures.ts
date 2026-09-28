/** Test data builders. */
import type { NewPhotoInput } from '@/features/photos/photosRepo'
import type { NewPlanInput } from '@/features/plan/plansRepo'
import { createEmptyVisit } from '@/features/visits/visitFactory'
import type { Visit } from '@/types/visit'

export function makeBlob(content = 'image-data', type = 'image/jpeg'): Blob {
  return new Blob([content], { type })
}

/** A valid visit with every collection filled. */
export function makeFullVisit(overrides: Partial<Visit> = {}): Visit {
  const base = createEmptyVisit(
    {
      kind: 'technical_visit',
      title: 'Visite entrepôt Lyon',
      date: '2026-09-28',
      siteName: 'Entrepôt Lyon Nord',
    },
    '2026-09-28T08:00:00.000Z',
  )
  return {
    ...base,
    startTime: '09:30',
    site: { name: 'Entrepôt Lyon Nord', code: 'LYN-01', address: '1 rue du Quai', city: 'Lyon' },
    participants: [
      {
        id: 'part-1',
        name: 'Jeanne Martin',
        role: 'Property Manager',
        company: 'Carrefour Property',
        present: true,
      },
      { id: 'part-2', name: 'Paul Durand', present: false },
    ],
    noteSections: [{ id: 'note-1', title: 'Toiture', content: 'Infiltrations\nzone B', order: 0 }],
    attentionPoints: [
      {
        id: 'ap-1',
        text: 'Reprendre l’étanchéité',
        priority: 'high',
        status: 'open',
        dueDate: '2026-10-15',
      },
      { id: 'ap-2', text: 'Nettoyer les chéneaux', priority: 'low', status: 'done' },
      {
        id: 'ap-3',
        text: 'Vérifier les sprinklers',
        priority: 'medium',
        status: 'in_progress',
        owner: 'Mainteneur',
      },
    ],
    doClaims: [
      {
        id: 'do-1',
        reference: 'DO-2026-001',
        insurer: 'Assureur SA',
        description: 'Infiltration toiture cellule 3',
        declaredAt: '2026-05-02',
        claimedAmountCents: 1_500_000,
        compensatedAmountCents: 1_200_000,
        steps: [
          { id: 'step-1', type: 'declaration', status: 'done', date: '2026-05-02' },
          { id: 'step-2', type: 'expertise', status: 'in_progress' },
        ],
      },
    ],
    insurances: [
      {
        id: 'ins-1',
        type: 'dommages_ouvrage',
        insurer: 'Assureur SA',
        startDate: '2024-01-01',
        endDate: '2034-01-01',
      },
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'Réfection toiture',
        status: 'planned',
        startDate: '2026-11-01',
        endDate: '2027-02-01',
      },
      { id: 'proj-2', name: 'Mise aux normes quais', status: 'identified' },
    ],
    costs: [
      {
        id: 'cost-1',
        label: 'Devis couvreur',
        category: 'works',
        projectId: 'proj-1',
        amountHtCents: 4_500_000,
        vatRateBp: 2000,
        status: 'quote',
      },
      {
        id: 'cost-2',
        label: 'Étude structure',
        category: 'study',
        amountHtCents: 350_000,
        vatRateBp: 2000,
        status: 'estimate',
      },
    ],
    pins: [{ id: 'pin-1', planId: 'plan-x', photoId: 'photo-x', x: 0.25, y: 0.5, number: 1 }],
    nextPinNumber: 2,
    ...overrides,
  }
}

export function makePhotoInput(
  visitId: string,
  overrides: Partial<NewPhotoInput> = {},
): NewPhotoInput {
  return {
    visitId,
    blob: makeBlob('photo'),
    thumbnailBlob: makeBlob('thumb'),
    mimeType: 'image/jpeg',
    width: 1600,
    height: 1200,
    caption: '',
    category: 'general',
    ...overrides,
  }
}

export function makePlanInput(
  visitId: string,
  overrides: Partial<NewPlanInput> = {},
): NewPlanInput {
  return {
    visitId,
    name: 'Plan RDC',
    blob: makeBlob('plan', 'image/png'),
    mimeType: 'image/png',
    width: 2000,
    height: 1000,
    sourceType: 'image',
    ...overrides,
  }
}
