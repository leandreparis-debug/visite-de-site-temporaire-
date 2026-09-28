/**
 * French display labels for every enumeration of the data model.
 * Maps are typed `Record<Enum, string>`: a missing label is a compile error.
 */
import type { PhotoCategory, PlanSourceType } from '@/types/media'
import type {
  AttentionStatus,
  CostCategory,
  CostStatus,
  DoStepStatus,
  DoStepType,
  InsuranceType,
  Priority,
  ProjectStatus,
  VisitKind,
} from '@/types/visit'

export const VISIT_KIND_LABELS: Record<VisitKind, string> = {
  technical_visit: 'Visite technique',
  meeting: 'Réunion',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
}

export const ATTENTION_STATUS_LABELS: Record<AttentionStatus, string> = {
  open: 'À traiter',
  in_progress: 'En cours',
  done: 'Terminé',
}

export const DO_STEP_TYPE_LABELS: Record<DoStepType, string> = {
  declaration: 'Déclaration du sinistre',
  acknowledgment: 'Accusé de réception de l’assureur',
  expert_appointed: 'Désignation de l’expert',
  expertise: 'Expertise',
  preliminary_report: 'Rapport préliminaire',
  coverage_decision: 'Position de l’assureur sur la garantie',
  compensation_offer: 'Proposition d’indemnité',
  compensation_paid: 'Versement de l’indemnité',
  repair_works: 'Travaux de réparation',
  closed: 'Clôture du dossier',
}

export const DO_STEP_STATUS_LABELS: Record<DoStepStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
}

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  dommages_ouvrage: 'Dommages-Ouvrage',
  multirisque: 'Multirisque',
  responsabilite_civile: 'Responsabilité civile',
  tous_risques_chantier: 'Tous risques chantier',
  other: 'Autre',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  identified: 'Identifié',
  planned: 'Planifié',
  in_progress: 'En cours',
  on_hold: 'Suspendu',
  done: 'Terminé',
}

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  works: 'Travaux',
  maintenance: 'Maintenance',
  study: 'Étude',
  insurance: 'Assurance',
  other: 'Autre',
}

export const COST_STATUS_LABELS: Record<CostStatus, string> = {
  estimate: 'Estimation',
  quote: 'Devis reçu',
  committed: 'Engagé',
  invoiced: 'Facturé',
}

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  general: 'Vue générale',
  defect: 'Désordre',
  equipment: 'Équipement',
  safety: 'Sécurité',
  works: 'Travaux',
  other: 'Autre',
}

export const PLAN_SOURCE_TYPE_LABELS: Record<PlanSourceType, string> = {
  image: 'Image',
  pdf: 'PDF',
}

/** All enumeration labels, grouped (handy for generic selects). */
export const LABELS = {
  kind: VISIT_KIND_LABELS,
  priority: PRIORITY_LABELS,
  attentionStatus: ATTENTION_STATUS_LABELS,
  doStepType: DO_STEP_TYPE_LABELS,
  doStepStatus: DO_STEP_STATUS_LABELS,
  insuranceType: INSURANCE_TYPE_LABELS,
  projectStatus: PROJECT_STATUS_LABELS,
  costCategory: COST_CATEGORY_LABELS,
  costStatus: COST_STATUS_LABELS,
  photoCategory: PHOTO_CATEGORY_LABELS,
  planSourceType: PLAN_SOURCE_TYPE_LABELS,
} as const

/**
 * French labels of data-model fields, used to describe validation errors
 * (e.g. `costs.1.amountHtCents` → "Coûts n°2 › Montant HT").
 */
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  // Visit
  id: 'Identifiant',
  schemaVersion: 'Version du format',
  createdAt: 'Date de création',
  updatedAt: 'Date de modification',
  kind: 'Type',
  title: 'Titre',
  date: 'Date',
  startTime: 'Heure de début',
  author: 'Rédacteur',
  purpose: 'Objet',
  site: 'Site',
  participants: 'Participants',
  noteSections: 'Notes',
  attentionPoints: 'Points d’attention',
  doClaims: 'Sinistres DO',
  insurances: 'Assurances',
  projects: 'Projets',
  costs: 'Coûts',
  pins: 'Repères',
  // Common sub-fields
  name: 'Nom',
  code: 'Code',
  address: 'Adresse',
  city: 'Ville',
  role: 'Fonction',
  company: 'Société',
  present: 'Présent',
  content: 'Contenu',
  order: 'Ordre',
  text: 'Texte',
  priority: 'Priorité',
  owner: 'Responsable',
  dueDate: 'Échéance',
  status: 'Statut',
  reference: 'Référence',
  insurer: 'Assureur',
  description: 'Description',
  location: 'Localisation',
  declaredAt: 'Date de déclaration',
  claimedAmountCents: 'Montant réclamé',
  compensatedAmountCents: 'Montant indemnisé',
  steps: 'Étapes',
  comment: 'Commentaire',
  type: 'Type',
  policyNumber: 'N° de police',
  broker: 'Courtier',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  label: 'Libellé',
  category: 'Catégorie',
  projectId: 'Projet',
  amountHtCents: 'Montant HT',
  vatRateBp: 'Taux de TVA',
  supplier: 'Fournisseur',
  // Media
  visitId: 'Visite',
  planId: 'Plan',
  photoId: 'Photo',
  blob: 'Fichier',
  thumbnailBlob: 'Miniature',
  mimeType: 'Type de fichier',
  width: 'Largeur',
  height: 'Hauteur',
  caption: 'Légende',
  takenAt: 'Date de prise de vue',
  originalName: 'Nom du fichier',
  sourceType: 'Source',
  x: 'Position horizontale',
  y: 'Position verticale',
  number: 'Numéro',
}
