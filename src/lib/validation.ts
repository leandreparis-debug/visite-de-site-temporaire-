import * as z from 'zod/mini'
import { ValidationError } from '@/lib/errors'

/**
 * Parses `data` with `schema`; throws a French `ValidationError` on failure.
 * Returns the parsed (normalized) value.
 */
export function parseOrThrow<S extends z.ZodMiniType>(schema: S, data: unknown): z.output<S> {
  const result = z.safeParse(schema, data)
  if (!result.success) throw ValidationError.fromZod(result.error)
  return result.data
}
