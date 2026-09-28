/**
 * Typed application errors.
 *
 * Every error carries:
 * - `userMessage`: French text that can be shown as-is in the UI;
 * - `message`: English technical detail for logs and debugging.
 */
import type { core } from 'zod/mini'
import { FIELD_LABELS } from '@/types/labels'

/** Base class of all typed application errors. */
export class AppError extends Error {
  readonly userMessage: string

  constructor(userMessage: string, technicalMessage: string, options?: ErrorOptions) {
    super(technicalMessage, options)
    this.name = new.target.name
    this.userMessage = userMessage
  }
}

/** Kinds of stored entities, used in `NotFoundError`. */
export type EntityKind = 'visit' | 'photo' | 'plan'

const ENTITY_NOT_FOUND: Record<EntityKind, string> = {
  visit: 'Visite introuvable. Elle a peut-être été supprimée.',
  photo: 'Photo introuvable. Elle a peut-être été supprimée.',
  plan: 'Plan introuvable. Il a peut-être été supprimé.',
}

/** The requested entity does not exist (anymore). */
export class NotFoundError extends AppError {
  readonly entity: EntityKind
  readonly id: string

  constructor(entity: EntityKind, id: string) {
    super(ENTITY_NOT_FOUND[entity], `${entity} not found: ${id}`)
    this.entity = entity
    this.id = id
  }
}

/** One invalid field, described in French. */
export interface FieldIssue {
  /** Technical path, e.g. `costs.1.amountHtCents`. */
  path: string
  /** French field label, e.g. `Coûts n°2 › Montant HT`. */
  field: string
  /** French message, e.g. `Le montant doit être un nombre entier de centimes`. */
  message: string
}

/** Data rejected by a schema. Lists the invalid fields in French. */
export class ValidationError extends AppError {
  readonly issues: readonly FieldIssue[]

  constructor(issues: readonly FieldIssue[], options?: ErrorOptions) {
    const details = issues.map((i) => (i.field ? `${i.field} : ${i.message}` : i.message))
    super(
      `Certaines informations sont invalides :\n- ${details.join('\n- ')}`,
      `Validation failed: ${issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ')}`,
      options,
    )
    this.issues = issues
  }

  /** Builds a `ValidationError` from a Zod error, translating field paths to French labels. */
  static fromZod(error: core.$ZodError): ValidationError {
    return new ValidationError(
      error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        field: formatFieldPath(issue.path),
        message: issue.message,
      })),
      { cause: error },
    )
  }
}

/** Not enough browser storage space left (IndexedDB `QuotaExceededError`). */
export class StorageQuotaError extends AppError {
  constructor(options?: ErrorOptions) {
    super(
      'Espace de stockage du navigateur insuffisant. Générez les rapports Word puis supprimez d’anciennes visites.',
      'Storage quota exceeded',
      options,
    )
  }
}

/** IndexedDB cannot be used (private browsing, disabled storage, blocked database…). */
export class StorageUnavailableError extends AppError {
  constructor(technicalMessage = 'IndexedDB is unavailable', options?: ErrorOptions) {
    super(
      'Le stockage local du navigateur est indisponible (navigation privée ou stockage désactivé ?). ' +
        'Ouvrez l’outil dans une fenêtre normale de Chrome ou Edge.',
      technicalMessage,
      options,
    )
  }
}

/**
 * Turns a Zod path into a French label.
 * @example formatFieldPath(['costs', 1, 'amountHtCents']) // "Coûts n°2 › Montant HT"
 */
export function formatFieldPath(path: readonly PropertyKey[]): string {
  const parts: string[] = []
  for (const segment of path) {
    if (typeof segment === 'number') {
      const last = parts.pop()
      parts.push(`${last ?? 'Élément'} n°${segment + 1}`)
    } else {
      const key = String(segment)
      parts.push(FIELD_LABELS[key] ?? key)
    }
  }
  return parts.join(' › ')
}

/** Dexie / DOM error names meaning that IndexedDB cannot be used at all. */
const UNAVAILABLE_ERROR_NAMES = new Set([
  'MissingAPIError',
  'OpenFailedError',
  'DatabaseClosedError',
  'InvalidStateError',
  'SecurityError',
  'UnknownError',
])

function errorName(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'name' in value) {
    const name = value.name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

/** Walks an error and its wrapped causes (`inner` for Dexie, `cause` for standard errors). */
function* errorChain(err: unknown): Generator {
  let current: unknown = err
  for (let depth = 0; current != null && depth < 5; depth++) {
    yield current
    if (typeof current !== 'object') return
    const next = current as { inner?: unknown; cause?: unknown }
    current = next.inner ?? next.cause
  }
}

/**
 * Normalizes any thrown value into an `AppError` when it can be recognized:
 * - `AppError` (possibly wrapped by Dexie) → returned as-is;
 * - `QuotaExceededError` (DOMException or wrapped by Dexie) → `StorageQuotaError`;
 * - missing/blocked IndexedDB → `StorageUnavailableError`.
 *
 * Other errors are returned unchanged.
 */
export function toAppError(err: unknown): unknown {
  for (const link of errorChain(err)) {
    // Dexie may wrap our errors (e.g. `NotFoundError` shares a DOMException
    // name), keeping the original in `inner`: unwrap it.
    if (link instanceof AppError) return link
    const name = errorName(link)
    if (name === 'QuotaExceededError') return new StorageQuotaError({ cause: err })
    if (name && UNAVAILABLE_ERROR_NAMES.has(name)) {
      const detail = link instanceof Error ? link.message : name
      return new StorageUnavailableError(`IndexedDB unavailable (${name}): ${detail}`, {
        cause: err,
      })
    }
  }
  return err
}

/** Generic French message for unrecognized errors. */
export const GENERIC_ERROR_MESSAGE = 'Une erreur inattendue est survenue.'

/**
 * French message to display for any thrown value.
 * Typed errors give their `userMessage`; unknown errors a generic message.
 */
export function toUserMessage(err: unknown): string {
  const appError = toAppError(err)
  return appError instanceof AppError ? appError.userMessage : GENERIC_ERROR_MESSAGE
}

/**
 * Runs a storage operation and converts low-level errors (quota, unavailable
 * IndexedDB) into typed `AppError`s.
 */
export async function withStorageErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    throw toAppError(err)
  }
}
