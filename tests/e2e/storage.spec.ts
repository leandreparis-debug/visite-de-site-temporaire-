import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href
const DB_NAME = 'cp-compte-rendu'

/** Opens the app database with raw IndexedDB (no version: uses the one created by the app). */
function readMeta(page: Page, key: string) {
  return page.evaluate(
    ({ dbName, metaKey }) =>
      new Promise<unknown>((resolvePromise, reject) => {
        const request = indexedDB.open(dbName)
        request.onerror = () => {
          reject(new Error(request.error?.message ?? 'open failed'))
        }
        request.onsuccess = () => {
          const database = request.result
          const get = database.transaction('meta', 'readonly').objectStore('meta').get(metaKey)
          get.onsuccess = () => {
            database.close()
            resolvePromise(get.result)
          }
          get.onerror = () => {
            reject(new Error(get.error?.message ?? 'get failed'))
          }
        }
      }),
    { dbName: DB_NAME, metaKey: key },
  )
}

test('IndexedDB persists data (including a Blob) across reloads in file://', async ({ page }) => {
  const consoleErrors: string[] = []
  const forbiddenRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith('file:') && !url.startsWith('data:')) forbiddenRequests.push(url)
  })

  await page.goto(indexUrl)
  await expect(page.getByAltText('Carrefour Property')).toBeVisible()

  // 1. The app itself opened its Dexie database and wrote a Zod-validated entry at startup.
  await expect
    .poll(() => readMeta(page, 'lastOpenedAt'))
    .toMatchObject({ key: 'lastOpenedAt', value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })

  // 2. Write a Blob into the app database, then read it back.
  const written = await page.evaluate(
    (dbName) =>
      new Promise<string>((resolvePromise, reject) => {
        const request = indexedDB.open(dbName)
        request.onerror = () => {
          reject(new Error('open failed'))
        }
        request.onsuccess = () => {
          const database = request.result
          const tx = database.transaction('meta', 'readwrite')
          tx.objectStore('meta').put({
            key: 'e2e-blob',
            value: new Blob(['Contenu binaire é€'], { type: 'text/plain' }),
          })
          tx.oncomplete = () => {
            database.close()
            resolvePromise('ok')
          }
          tx.onerror = () => {
            reject(new Error(tx.error?.message ?? 'write failed'))
          }
        }
      }),
    DB_NAME,
  )
  expect(written).toBe('ok')

  // 3. Reload, 4. the Blob is still there with its content.
  await page.reload()
  await expect(page.getByAltText('Carrefour Property')).toBeVisible()
  const persisted = await page.evaluate(
    (dbName) =>
      new Promise<{ type: string; text: string }>((resolvePromise, reject) => {
        const request = indexedDB.open(dbName)
        request.onerror = () => {
          reject(new Error('open failed'))
        }
        request.onsuccess = () => {
          const database = request.result
          const get = database.transaction('meta', 'readonly').objectStore('meta').get('e2e-blob')
          get.onsuccess = () => {
            const entry = get.result as { value: Blob } | undefined
            database.close()
            if (!entry) {
              reject(new Error('blob entry missing after reload'))
              return
            }
            void entry.value.text().then((text) => {
              resolvePromise({ type: entry.value.type, text })
            })
          }
        }
      }),
    DB_NAME,
  )
  expect(persisted).toEqual({ type: 'text/plain', text: 'Contenu binaire é€' })

  // 5. Still no console error (validates Zod `jitless` under the CSP) and no network.
  await page.waitForLoadState('networkidle')
  expect(consoleErrors, 'console errors').toEqual([])
  expect(forbiddenRequests, 'network requests').toEqual([])
})
