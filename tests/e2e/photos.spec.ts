import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href
const fixturesDir = resolve(import.meta.dirname, '../fixtures/photos')
const fixtures = readdirSync(fixturesDir).map((name) => resolve(fixturesDir, name))

function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('[photos] Import failed')) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    if (!/^(file|data|blob):/.test(request.url())) problems.push(`request: ${request.url()}`)
  })
  return problems
}

async function createVisitOnPhotos(page: Page) {
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Visite photos')
  await create.getByLabel('Nom du site').fill('Entrepôt Lyon')
  await create.getByLabel('Nom du site').press('Enter')
  await page.getByRole('tab', { name: /^Photos/ }).click()
}

const grid = (page: Page) => page.getByRole('list', { name: 'Photos' })
const alts = (page: Page) =>
  grid(page)
    .getByRole('img')
    .evaluateAll((images) => images.map((img) => img.getAttribute('alt')))

test('photo import, processing, viewer, caption, rotation, reorder, deletion', async ({ page }) => {
  const problems = watch(page)
  await createVisitOnPhotos(page)

  // 1. Import the 7 fixture files: 5 images are valid, 2 files are refused.
  const started = Date.now()
  await page.getByTestId('photo-input').setInputFiles(fixtures)
  await expect(page.getByText(/5\s+photos importées, 2\s+ignorées/)).toBeVisible()
  const elapsed = Date.now() - started
  test.info().annotations.push({ type: 'import', description: `7 fichiers en ${elapsed} ms` })
  await expect(page.getByRole('tab', { name: 'Photos (5)' })).toBeVisible()

  // 2. Details of the ignored files.
  await page.getByRole('button', { name: 'Détails' }).click()
  const details = page.getByRole('dialog', { name: 'Fichiers ignorés' })
  await expect(details.getByRole('listitem')).toHaveCount(2)
  await expect(details).toContainText('iphone.heic')
  await expect(details).toContainText('Format HEIC (iPhone) non pris en charge')
  await expect(details).toContainText('texte-renomme.jpg')
  await expect(details).toContainText('Image illisible')
  await details.getByRole('button', { name: 'Fermer' }).first().click()

  // Import order: EXIF dates first (MM 2025, II 2026-09-15, orientation 2026-09-16), then names.
  await expect
    .poll(() => alts(page))
    .toEqual(['Photo 1', 'Photo 2', 'Photo 3', 'Photo 4', 'Photo 5'])

  // 3. Orientation = 6: stored landscape, shown portrait.
  const rotated = grid(page).getByRole('img', { name: 'Photo 3' })
  await expect(rotated).toHaveJSProperty('complete', true)
  const size = await rotated.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ])
  expect(size[1]).toBeGreaterThan(size[0] ?? 0)

  // 4. EXIF date shown on the card.
  await expect(page.getByText('Prise le 15/09/2026 à 10h42')).toBeVisible()

  // 5. The 2400×1600 source is stored at 2000 px max.
  await page.getByRole('button', { name: 'Ouvrir : Photo 4' }).click()
  const viewer = page.getByRole('dialog', { name: '4 / 5' })
  await expect(viewer.getByTestId('viewer-dimensions')).toHaveText('2000 × 1333 px')
  await expect(viewer).toContainText('paysage-sans-exif.jpg')
  const main = viewer.getByRole('img', { name: 'Photo 4' })
  await expect(main).toHaveJSProperty('naturalWidth', 2000)
  // Keyboard navigation in the viewer.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: '5 / 5' })).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  // 7. Rotation: dimensions swapped.
  await page
    .getByRole('dialog', { name: '4 / 5' })
    .getByRole('button', { name: 'Pivoter à droite' })
    .click()
  await expect(page.getByTestId('viewer-dimensions')).toHaveText('1333 × 2000 px')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '4 / 5' })).toHaveCount(0)

  // 6. Caption, kept after reload.
  const caption = page.getByRole('textbox', { name: 'Légende de la photo 1' })
  await caption.fill('Vue générale du quai 3')
  await caption.blur()
  await expect(grid(page).getByRole('img', { name: 'Vue générale du quai 3' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Légende de la photo 1' })).toHaveValue(
    'Vue générale du quai 3',
  )

  // 8. Keyboard reorder: Alt+→ moves photo 1 after photo 2.
  await page.getByRole('button', { name: 'Ouvrir : Vue générale du quai 3' }).focus()
  await page.keyboard.press('Alt+ArrowRight')
  await expect
    .poll(() => alts(page))
    .toEqual(['Photo 1', 'Vue générale du quai 3', 'Photo 3', 'Photo 4', 'Photo 5'])
  await expect(page.getByRole('button', { name: 'Ouvrir : Vue générale du quai 3' })).toBeFocused()

  // 9. Delete two photos through the selection.
  await page.getByRole('checkbox', { name: 'Sélectionner la photo 4' }).check()
  await page.getByRole('checkbox', { name: 'Sélectionner la photo 5' }).check()
  await expect(page.getByRole('toolbar')).toContainText('2 sélectionnées')
  await page.getByRole('toolbar').getByRole('button', { name: 'Supprimer' }).click()
  await page
    .getByRole('alertdialog', { name: 'Supprimer 2 photos ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click()
  await expect(page.getByRole('tab', { name: 'Photos (3)' })).toBeVisible()

  // 10. Reload: consistent state.
  await page.reload()
  await expect.poll(() => alts(page)).toEqual(['Photo 1', 'Vue générale du quai 3', 'Photo 3'])
  await expect(page.getByRole('tab', { name: 'Photos (3)' })).toBeVisible()

  expect(problems).toEqual([])
})

test('processing time of realistic 12 MP phone photos', async ({ page }) => {
  test.setTimeout(120_000)
  const problems = watch(page)
  await createVisitOnPhotos(page)
  // 4000×3000 noisy JPEGs (~4-6 MB each), generated in the browser.
  const files = await page.evaluate(async () => {
    const result: { name: string; mimeType: string; base64: string }[] = []
    for (let i = 1; i <= 6; i++) {
      const [width, height] = i % 2 ? [4000, 3000] : [3000, 4000]
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      const image = context.createImageData(width, height)
      for (let p = 0; p < image.data.length; p += 4) {
        const v = (p * 2654435761) % 255
        image.data[p] = v
        image.data[p + 1] = (v * 7) % 255
        image.data[p + 2] = (v * 13) % 255
        image.data[p + 3] = 255
      }
      context.putImageData(image, 0, 0)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let b = 0; b < bytes.length; b += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(b, b + 0x8000))
      result.push({ name: `IMG_${i}.jpg`, mimeType: 'image/jpeg', base64: btoa(binary) })
    }
    return result
  })
  const dir = mkdtempSync(resolve(tmpdir(), 'cp-photos-'))
  const paths = files.map(({ name, base64 }) => {
    const path = resolve(dir, name)
    writeFileSync(path, Buffer.from(base64, 'base64'))
    return path
  })
  const totalMb = files.reduce((sum, f) => sum + (f.base64.length * 3) / 4, 0) / 1024 / 1024
  const started = Date.now()
  await page.getByTestId('photo-input').setInputFiles(paths)
  await expect(page.getByText(/6\s+photos importées/)).toBeVisible({ timeout: 90_000 })
  const perPhoto = Math.round((Date.now() - started) / files.length)
  test.info().annotations.push({
    type: 'performance',
    description: `${perPhoto} ms par photo (6 photos 12 MP, ${totalMb.toFixed(1)} Mo au total)`,
  })
  console.log(`[perf] ${perPhoto} ms per 12 MP photo (${totalMb.toFixed(1)} MB for 6 files)`)
  expect(perPhoto).toBeLessThan(5000)
  await expect(page.getByText(/6\s+photos · /)).toBeVisible()
  expect(problems).toEqual([])
})
