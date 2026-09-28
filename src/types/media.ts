/**
 * Media schemas: photos and plans (binary data, stored in their own Dexie
 * tables) and pins (lightweight, stored inside the visit).
 */
import * as z from 'zod/mini'
import { idSchema, optionalText, orderSchema, requiredText, timestampSchema } from '@/types/common'

export const PHOTO_CATEGORIES = [
  'general',
  'defect',
  'equipment',
  'safety',
  'works',
  'other',
] as const
export const photoCategorySchema = z.enum(PHOTO_CATEGORIES)
export type PhotoCategory = z.infer<typeof photoCategorySchema>

export const PLAN_SOURCE_TYPES = ['image', 'pdf'] as const
export const planSourceTypeSchema = z.enum(PLAN_SOURCE_TYPES)
export type PlanSourceType = z.infer<typeof planSourceTypeSchema>

// `Blob` is resolved at validation time (not captured at module load).
const blobSchema = z.custom<Blob>((value) => value instanceof Blob, { error: 'Fichier invalide' })
const pixelSizeSchema = z
  .int({ error: 'Dimension invalide' })
  .check(z.positive({ error: 'Dimension invalide' }))

/** A photo of a visit. `blob` is already resized; `thumbnailBlob` is a small preview. */
export const photoSchema = z.object({
  id: idSchema,
  visitId: idSchema,
  blob: blobSchema,
  thumbnailBlob: blobSchema,
  mimeType: z.string().check(z.minLength(1)),
  width: pixelSizeSchema,
  height: pixelSizeSchema,
  caption: z
    .string()
    .check(z.maxLength(1000, { error: 'La légende ne doit pas dépasser 1000 caractères' })),
  category: photoCategorySchema,
  order: orderSchema,
  /**
   * When the picture was taken (EXIF DateTimeOriginal), if known. Local time
   * without offset (`YYYY-MM-DDTHH:mm:ss`): EXIF does not store a time zone.
   */
  takenAt: z.optional(
    z.iso.datetime({ local: true, offset: true, error: 'Date de prise de vue invalide' }),
  ),
  /** Name of the source file (hint, and to find a photo again). */
  originalName: optionalText(255),
  createdAt: timestampSchema,
})
export type Photo = z.infer<typeof photoSchema>

/** A site plan (one visit may have several: buildings, cells…). PDFs are rendered to an image. */
export const planSchema = z.object({
  id: idSchema,
  visitId: idSchema,
  name: requiredText('Le nom du plan', 120),
  blob: blobSchema,
  mimeType: z.string().check(z.minLength(1)),
  width: pixelSizeSchema,
  height: pixelSizeSchema,
  sourceType: planSourceTypeSchema,
  order: orderSchema,
  createdAt: timestampSchema,
})
export type Plan = z.infer<typeof planSchema>

const coordinateMessage = 'La coordonnée doit être comprise entre 0 et 1'
const normalizedCoordinate = z
  .number({ error: 'Coordonnée invalide' })
  .check(z.gte(0, { error: coordinateMessage }), z.lte(1, { error: coordinateMessage }))

/**
 * A numbered marker linking a photo to a position on a plan.
 * `x` / `y` are normalized (0–1) relative to the plan's width / height.
 * `number` is unique within a visit and never reassigned after a deletion.
 */
export const pinSchema = z.object({
  id: idSchema,
  planId: idSchema,
  photoId: idSchema,
  x: normalizedCoordinate,
  y: normalizedCoordinate,
  number: z
    .int({ error: 'Numéro de repère invalide' })
    .check(z.gte(1, { error: 'Le numéro du repère doit être ≥ 1' })),
  label: optionalText(200),
})
export type Pin = z.infer<typeof pinSchema>
