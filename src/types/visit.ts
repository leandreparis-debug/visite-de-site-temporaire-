/**
 * Visit domain model. Zod schemas are the single source of truth: every
 * TypeScript type is inferred with `z.infer`.
 *
 * Rules: amounts in integer cents, VAT in basis points, business dates as
 * `YYYY-MM-DD`, timestamps as full ISO 8601. Binary files (photos, plans)
 * live in separate tables, never inside the visit.
 */
import * as z from 'zod/mini'
import { formatEuros } from '@/lib/money'
import {
  centsSchema,
  dateRangeCheck,
  idSchema,
  isoDateSchema,
  LONG_TEXT_MAX,
  optionalText,
  orderSchema,
  requiredText,
  timeSchema,
  timestampSchema,
  vatRateBpSchema,
} from '@/types/common'
import { pinSchema } from '@/types/media'

/** Current version of the stored visit format (see migrations / import). */
export const VISIT_SCHEMA_VERSION = 1

// ─── Enumerations ────────────────────────────────────────────────────────────

export const VISIT_KINDS = ['technical_visit', 'meeting'] as const
export const visitKindSchema = z.enum(VISIT_KINDS)
export type VisitKind = z.infer<typeof visitKindSchema>

export const PRIORITIES = ['low', 'medium', 'high'] as const
export const prioritySchema = z.enum(PRIORITIES)
export type Priority = z.infer<typeof prioritySchema>

export const ATTENTION_STATUSES = ['open', 'in_progress', 'done'] as const
export const attentionStatusSchema = z.enum(ATTENTION_STATUSES)
export type AttentionStatus = z.infer<typeof attentionStatusSchema>

export const DO_STEP_TYPES = [
  'declaration',
  'acknowledgment',
  'expert_appointed',
  'expertise',
  'preliminary_report',
  'coverage_decision',
  'compensation_offer',
  'compensation_paid',
  'repair_works',
  'closed',
] as const
export const doStepTypeSchema = z.enum(DO_STEP_TYPES)
export type DoStepType = z.infer<typeof doStepTypeSchema>

export const DO_STEP_STATUSES = ['todo', 'in_progress', 'done'] as const
export const doStepStatusSchema = z.enum(DO_STEP_STATUSES)
export type DoStepStatus = z.infer<typeof doStepStatusSchema>

export const INSURANCE_TYPES = [
  'dommages_ouvrage',
  'multirisque',
  'responsabilite_civile',
  'tous_risques_chantier',
  'other',
] as const
export const insuranceTypeSchema = z.enum(INSURANCE_TYPES)
export type InsuranceType = z.infer<typeof insuranceTypeSchema>

export const PROJECT_STATUSES = ['identified', 'planned', 'in_progress', 'on_hold', 'done'] as const
export const projectStatusSchema = z.enum(PROJECT_STATUSES)
export type ProjectStatus = z.infer<typeof projectStatusSchema>

export const COST_CATEGORIES = ['works', 'maintenance', 'study', 'insurance', 'other'] as const
export const costCategorySchema = z.enum(COST_CATEGORIES)
export type CostCategory = z.infer<typeof costCategorySchema>

export const COST_STATUSES = ['estimate', 'quote', 'committed', 'invoiced'] as const
export const costStatusSchema = z.enum(COST_STATUSES)
export type CostStatus = z.infer<typeof costStatusSchema>

// ─── Sub-objects ─────────────────────────────────────────────────────────────

export const siteSchema = z.object({
  name: requiredText('Le nom du site'),
  code: optionalText(50),
  address: optionalText(300),
  city: optionalText(120),
})
export type Site = z.infer<typeof siteSchema>

export const participantSchema = z.object({
  id: idSchema,
  name: requiredText('Le nom du participant', 120),
  role: optionalText(120),
  company: optionalText(120),
  present: z.boolean(),
})
export type Participant = z.infer<typeof participantSchema>

/** A free-text notes block for one area or theme ("Toiture", "Quais", "Sprinklage"…). */
export const noteSectionSchema = z.object({
  id: idSchema,
  title: requiredText('Le titre de la section', 120),
  /** Plain multi-line text. */
  content: z.string().check(z.maxLength(LONG_TEXT_MAX)),
  order: orderSchema,
})
export type NoteSection = z.infer<typeof noteSectionSchema>

export const attentionPointSchema = z.object({
  id: idSchema,
  text: requiredText('Le point d’attention', 1000),
  priority: prioritySchema,
  owner: optionalText(120),
  dueDate: z.optional(isoDateSchema),
  status: attentionStatusSchema,
})
export type AttentionPoint = z.infer<typeof attentionPointSchema>

/** One step of a Dommages-Ouvrage claim process. */
export const doStepSchema = z.object({
  id: idSchema,
  type: doStepTypeSchema,
  status: doStepStatusSchema,
  date: z.optional(isoDateSchema),
  comment: optionalText(2000),
})
export type DoStep = z.infer<typeof doStepSchema>

/** A Dommages-Ouvrage (DO) claim. */
export const doClaimSchema = z.object({
  id: idSchema,
  reference: optionalText(100),
  insurer: optionalText(120),
  description: requiredText('La description du sinistre', 2000),
  location: optionalText(200),
  declaredAt: z.optional(isoDateSchema),
  claimedAmountCents: z.optional(centsSchema),
  /** May exceed the claimed amount: this is only a warning, see `getVisitWarnings`. */
  compensatedAmountCents: z.optional(centsSchema),
  steps: z.array(doStepSchema),
  comment: optionalText(LONG_TEXT_MAX),
})
export type DoClaim = z.infer<typeof doClaimSchema>

export const insuranceSchema = z
  .object({
    id: idSchema,
    type: insuranceTypeSchema,
    insurer: requiredText('L’assureur', 120),
    policyNumber: optionalText(100),
    broker: optionalText(120),
    startDate: z.optional(isoDateSchema),
    endDate: z.optional(isoDateSchema),
    comment: optionalText(LONG_TEXT_MAX),
  })
  .check(dateRangeCheck)
export type Insurance = z.infer<typeof insuranceSchema>

export const projectSchema = z
  .object({
    id: idSchema,
    name: requiredText('Le nom du projet'),
    description: optionalText(LONG_TEXT_MAX),
    status: projectStatusSchema,
    owner: optionalText(120),
    startDate: z.optional(isoDateSchema),
    endDate: z.optional(isoDateSchema),
    comment: optionalText(LONG_TEXT_MAX),
  })
  .check(dateRangeCheck)
export type Project = z.infer<typeof projectSchema>

export const costSchema = z.object({
  id: idSchema,
  label: requiredText('Le libellé du coût'),
  category: costCategorySchema,
  /** Optional link to a project of the same visit. */
  projectId: z.optional(idSchema),
  amountHtCents: centsSchema,
  vatRateBp: z._default(vatRateBpSchema, 2000),
  status: costStatusSchema,
  supplier: optionalText(120),
  comment: optionalText(LONG_TEXT_MAX),
})
export type Cost = z.infer<typeof costSchema>

// ─── Visit ───────────────────────────────────────────────────────────────────

export const visitSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(VISIT_SCHEMA_VERSION),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    kind: visitKindSchema,
    title: requiredText('Le titre', 200),
    date: isoDateSchema,
    startTime: z.optional(timeSchema),
    site: siteSchema,
    participants: z.array(participantSchema),
    noteSections: z.array(noteSectionSchema),
    attentionPoints: z.array(attentionPointSchema),
    doClaims: z.array(doClaimSchema),
    insurances: z.array(insuranceSchema),
    projects: z.array(projectSchema),
    costs: z.array(costSchema),
    /** Pins are light: they stay in the visit (photos / plans do not). */
    pins: z.array(pinSchema),
  })
  .check(
    z.superRefine((visit, ctx) => {
      // A cost can only reference a project of the same visit.
      const projectIds = new Set(visit.projects.map((p) => p.id))
      visit.costs.forEach((cost, index) => {
        if (cost.projectId !== undefined && !projectIds.has(cost.projectId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['costs', index, 'projectId'],
            message: 'Le projet associé est introuvable dans cette visite',
            input: cost.projectId,
          })
        }
      })
      // Pin numbers are unique within a visit.
      const seen = new Set<number>()
      visit.pins.forEach((pin, index) => {
        if (seen.has(pin.number)) {
          ctx.addIssue({
            code: 'custom',
            path: ['pins', index, 'number'],
            message: `Le numéro de repère ${pin.number} est déjà utilisé`,
            input: pin.number,
          })
        }
        seen.add(pin.number)
      })
    }),
  )
export type Visit = z.infer<typeof visitSchema>

/** Row displayed in the visit list (no heavy data). */
export interface VisitSummary {
  id: string
  title: string
  kind: VisitKind
  date: string
  siteName: string
  updatedAt: string
  photoCount: number
  pinCount: number
}

/**
 * Non-blocking consistency warnings, in French (the visit remains valid).
 * Currently: compensated amount greater than the claimed amount on a DO claim.
 */
export function getVisitWarnings(visit: Pick<Visit, 'doClaims'>): string[] {
  const warnings: string[] = []
  for (const claim of visit.doClaims) {
    const { claimedAmountCents: claimed, compensatedAmountCents: compensated } = claim
    if (claimed !== undefined && compensated !== undefined && compensated > claimed) {
      const name = claim.reference ? `« ${claim.reference} »` : `« ${claim.description} »`
      warnings.push(
        `Sinistre DO ${name} : le montant indemnisé (${formatEuros(compensated)}) ` +
          `dépasse le montant réclamé (${formatEuros(claimed)}).`,
      )
    }
  }
  return warnings
}
