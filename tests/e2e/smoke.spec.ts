import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

// Absolute file:// URL, exactly like a double-click on dist/index.html.
const distIndex = resolve(import.meta.dirname, '../../dist/index.html')
const indexUrl = pathToFileURL(distIndex).href

test.describe('single-file build opened via file://', () => {
  test('shows the shell without console errors or network requests', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const forbiddenRequests: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      const url = request.url()
      if (!url.startsWith('file:') && !url.startsWith('data:')) forbiddenRequests.push(url)
    })

    await page.goto(indexUrl, { waitUntil: 'load' })

    expect(page.url()).toMatch(/^file:\/\//)
    await expect(page).toHaveTitle(/Comptes rendus de visite/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comptes rendus de visite' }),
    ).toBeVisible()

    const logo = page.getByAltText('Carrefour Property')
    await expect(logo).toBeVisible()
    // The image actually decoded (inlined data: URI), not a broken icon.
    expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

    await expect(page.getByText('Aucune visite pour le moment')).toBeVisible()

    await page.waitForLoadState('networkidle')
    expect(consoleErrors, 'console errors').toEqual([])
    expect(pageErrors, 'uncaught page errors').toEqual([])
    expect(forbiddenRequests, 'network requests').toEqual([])
  })
  test('still works when index.html is copied alone to another folder', async ({ page }) => {
    const dir = mkdtempSync(join(tmpdir(), 'cp-compte-rendu-'))
    const copy = join(dir, 'index.html')
    copyFileSync(distIndex, copy)

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(pathToFileURL(copy).href)
    await expect(page.getByAltText('Carrefour Property')).toBeVisible()
    await expect(page.getByText('Aucune visite pour le moment')).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('shell.png'), fullPage: true })
    expect(pageErrors).toEqual([])
  })
})
