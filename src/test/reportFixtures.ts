/** A complete visit for the report tests (model and rendering). */
import type {
  BuildReportInput,
  ReportPhotoInput,
  ReportPlanInput,
} from '@/features/report/model/buildReportModel'
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from '@/features/report/model/reportModel'
import type { Visit } from '@/types/visit'
import { makeFullVisit } from './fixtures'

export const REPORT_TODAY = '2026-09-28'
export const REPORT_GENERATED_AT = '2026-09-28T14:05'

export function makeReportVisit(overrides: Partial<Visit> = {}): Visit {
  return makeFullVisit({
    author: 'Jeanne Martin',
    purpose: 'Visite annuelle de la toiture et des quais',
    participants: [
      {
        id: 'part-1',
        name: 'Jeanne Martin',
        role: 'Property Manager',
        company: 'Carrefour Property',
        present: true,
      },
      { id: 'part-2', name: 'Paul Durand', role: 'Mainteneur', present: false },
      { id: 'part-3', name: 'Luc Petit', company: 'Couverture SA', present: true },
    ],
    noteSections: [
      { id: 'n2', title: 'Quais', content: '  ', order: 1 },
      {
        id: 'n1',
        title: 'Toiture',
        content: 'Infiltrations visibles :\n- cellule 3\n- chéneau nord\n\nÀ suivre.',
        order: 0,
      },
      { id: 'n3', title: 'Sprinklage', content: 'RAS', order: 2 },
    ],
    pins: [
      {
        id: 'pin-c',
        planId: 'plan-1',
        photoId: 'ph-3',
        x: 0.7,
        y: 0.2,
        number: 3,
        label: 'Descente EP',
      },
      { id: 'pin-a', planId: 'plan-1', photoId: 'ph-1', x: 0.2, y: 0.3, number: 1 },
      { id: 'pin-b', planId: 'plan-1', photoId: 'ph-2', x: 0.5, y: 0.6, number: 2 },
    ],
    nextPinNumber: 4,
    ...overrides,
  })
}

export const REPORT_PHOTOS: ReportPhotoInput[] = [
  {
    id: 'ph-2',
    caption: 'Chéneau bouché',
    category: 'defect',
    order: 1,
    takenAt: '2026-09-15T10:42:00',
  },
  { id: 'ph-1', caption: 'Vue générale toiture', category: 'general', order: 0 },
  { id: 'ph-4', caption: '', category: 'equipment', order: 3 },
  { id: 'ph-3', caption: 'Descente d’eau pluviale', category: 'safety', order: 2 },
  { id: 'ph-5', caption: 'Quai 3', category: 'works', order: 4 },
]

export const REPORT_PLANS: ReportPlanInput[] = [
  { id: 'plan-2', name: 'R+1', order: 1 },
  { id: 'plan-1', name: 'RDC', order: 0 },
]

export function makeReportInput(
  overrides: Partial<Omit<BuildReportInput, 'options'>> & { options?: Partial<ReportOptions> } = {},
): BuildReportInput {
  const { options, ...rest } = overrides
  return {
    visit: makeReportVisit(),
    photos: REPORT_PHOTOS,
    plans: REPORT_PLANS,
    todayIso: REPORT_TODAY,
    generatedAt: REPORT_GENERATED_AT,
    ...rest,
    options: { ...DEFAULT_REPORT_OPTIONS, ...options },
  }
}
