import type { VisitKind } from '@/types/visit'

/** Typical warehouse areas: suggested section titles and "visite technique" template. */
export const WAREHOUSE_ZONES = [
  'Toiture et étanchéité',
  'Façades et bardage',
  'Quais et portes sectionnelles',
  'Cellules de stockage',
  'Sprinklage et RIA',
  'Désenfumage',
  'Électricité et TGBT',
  'Chauffage et CVC',
  'Voiries et parkings',
  'Clôtures et accès',
  'Réseaux EU/EP',
  'Bureaux et locaux sociaux',
  'Sécurité incendie',
  'Environnement et ICPE',
] as const

export const MEETING_SECTIONS = ['Ordre du jour', 'Points abordés', 'Décisions', 'Divers'] as const

export interface NoteTemplate {
  id: VisitKind
  label: string
  titles: readonly string[]
}

export const NOTE_TEMPLATES: Record<VisitKind, NoteTemplate> = {
  technical_visit: {
    id: 'technical_visit',
    label: 'Trame visite technique',
    titles: WAREHOUSE_ZONES,
  },
  meeting: { id: 'meeting', label: 'Trame réunion', titles: MEETING_SECTIONS },
}

/** Templates ordered with the one matching the visit kind first. */
export function templatesFor(kind: VisitKind): NoteTemplate[] {
  const first = NOTE_TEMPLATES[kind]
  return [first, ...Object.values(NOTE_TEMPLATES).filter((t) => t.id !== kind)]
}
