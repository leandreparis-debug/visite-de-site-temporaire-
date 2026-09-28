import { describe, expect, it } from 'vitest'
import {
  type AppError,
  GENERIC_ERROR_MESSAGE,
  NotFoundError,
  StorageQuotaError,
  StorageUnavailableError,
  toAppError,
  toUserMessage,
  withStorageErrors,
} from '@/lib/errors'

const QUOTA_MESSAGE =
  'Espace de stockage du navigateur insuffisant. Générez les rapports Word puis supprimez d’anciennes visites.'

describe('errors', () => {
  it('maps a QuotaExceededError DOMException to StorageQuotaError', () => {
    const domError = new DOMException('Quota exceeded', 'QuotaExceededError')
    const mapped = toAppError(domError)
    expect(mapped).toBeInstanceOf(StorageQuotaError)
    expect((mapped as StorageQuotaError).cause).toBe(domError)
    expect(toUserMessage(domError)).toBe(QUOTA_MESSAGE)
  })

  it('maps a quota error wrapped by Dexie (inner)', () => {
    const dexieLike = Object.assign(new Error('AbortError'), {
      name: 'AbortError',
      inner: new DOMException('Quota exceeded', 'QuotaExceededError'),
    })
    expect(toAppError(dexieLike)).toBeInstanceOf(StorageQuotaError)
  })

  it('maps missing / blocked IndexedDB to StorageUnavailableError', () => {
    const missing = Object.assign(new Error('IndexedDB API missing'), { name: 'MissingAPIError' })
    const mapped = toAppError(missing)
    expect(mapped).toBeInstanceOf(StorageUnavailableError)
    expect(toUserMessage(missing)).toMatch(/stockage local du navigateur est indisponible/)
    expect((mapped as AppError).message).toContain('MissingAPIError')
  })

  it('keeps AppErrors and unknown errors unchanged', () => {
    const notFound = new NotFoundError('visit', 'abc')
    expect(toAppError(notFound)).toBe(notFound)
    expect(notFound.name).toBe('NotFoundError')
    expect(notFound.message).toBe('visit not found: abc')
    expect(toUserMessage(notFound)).toBe('Visite introuvable. Elle a peut-être été supprimée.')

    const other = new TypeError('boom')
    expect(toAppError(other)).toBe(other)
    expect(toUserMessage(other)).toBe(GENERIC_ERROR_MESSAGE)
    expect(toUserMessage('text')).toBe(GENERIC_ERROR_MESSAGE)
  })

  it('unwraps an AppError wrapped by Dexie', () => {
    const original = new NotFoundError('photo', 'x')
    const wrapped = Object.assign(new Error('wrapped'), { name: 'NotFoundError', inner: original })
    expect(toAppError(wrapped)).toBe(original)
  })

  it('withStorageErrors converts storage failures', async () => {
    await expect(
      withStorageErrors(() => Promise.reject(new DOMException('full', 'QuotaExceededError'))),
    ).rejects.toBeInstanceOf(StorageQuotaError)
    await expect(withStorageErrors(() => Promise.resolve(3))).resolves.toBe(3)
  })
})
