import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, expect, test } from '@playwright/test'
import { createVisit, photoFixture, tab, watch } from './helpers'

const root = resolve(import.meta.dirname, '../..')

/**
 * Updating the tool = replacing the HTML file by a newer one (other folder,
 * other name). IndexedDB is shared by every file:// page of the browser
 * profile: the visits must still be there.
 */
test('a new version of the HTML file finds the existing visits', async () => {
  test.setTimeout(180_000)
  const work = mkdtempSync(join(tmpdir(), 'cp-update-'))
  const profile = join(work, 'profile')
  try {
    // Version 1: the current build, as distributed.
    mkdirSync(join(work, 'v1'))
    const v1 = join(work, 'v1', 'CR-Visites-Carrefour-Property-v1.0.0.html')
    copyFileSync(resolve(root, 'dist/index.html'), v1)
    // Version 2: a real second build, with another version number.
    execFileSync(
      'npx',
      ['vite', 'build', '--outDir', join(work, 'build-v2'), '--logLevel', 'error'],
      {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, APP_VERSION: '1.0.1' },
      },
    )
    mkdirSync(join(work, 'Téléchargements'))
    const v2 = join(work, 'Téléchargements', 'CR-Visites-Carrefour-Property-v1.0.1.html')
    copyFileSync(join(work, 'build-v2', 'index.html'), v2)

    const launch = () =>
      chromium.launchPersistentContext(profile, {
        executablePath: process.env.PW_CHROMIUM_PATH,
        env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' },
      })

    // Version 1: a visit with a photo.
    let context = await launch()
    let page = await context.newPage()
    const problemsV1 = watch(page)
    await page.goto(pathToFileURL(v1).href)
    await expect(page.getByTestId('app-version')).toHaveText(/^v1\.0\.0 — build du /)
    await createVisit(page, 'Visite avant mise à jour', 'Entrepôt Lyon')
    await tab(page, 'Photos').click()
    await page.getByTestId('photo-input').setInputFiles([photoFixture('exif-mm.jpg')])
    await expect(tab(page, 'Photos (1)')).toBeVisible()
    await page.getByRole('link', { name: 'Visites', exact: true }).click()
    expect(problemsV1).toEqual([])
    await context.close()

    // Version 2, another file in another folder, same browser profile.
    context = await launch()
    page = await context.newPage()
    const problemsV2 = watch(page)
    await page.goto(pathToFileURL(v2).href)
    await expect(page.getByTestId('app-version')).toHaveText(/^v1\.0\.1 — build du /)
    await page
      .getByRole('list', { name: 'Visites' })
      .getByRole('link', { name: 'Visite avant mise à jour', exact: true })
      .click()
    await tab(page, 'Photos').click()
    await expect(tab(page, 'Photos (1)')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Photo 1' })).toHaveJSProperty('complete', true)
    expect(problemsV2).toEqual([])
    await context.close()
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
