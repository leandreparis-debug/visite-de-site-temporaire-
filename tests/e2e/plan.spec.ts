import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href
const photo = (name: string) => resolve(import.meta.dirname, '../fixtures/photos', name)
const planFile = (name: string) => resolve(import.meta.dirname, '../fixtures/plans', name)

function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('[plan] Import failed'))
      problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) problems.push(`request: ${r.url()}`)
  })
  page.on('worker', (w) => problems.push(`worker: ${w.url()}`))
  return problems
}

/** Position of a pin, normalized to the plan image (read from the screen). */
function pinPosition(page: Page, number: number) {
  return page.evaluate((n) => {
    const image = document.querySelector('[data-testid="plan-image"]')!.getBoundingClientRect()
    const pin = document.querySelector(`[data-pin-number="${n}"]`)!.getBoundingClientRect()
    return {
      x: (pin.x + pin.width / 2 - image.x) / image.width,
      y: (pin.y + pin.height / 2 - image.y) / image.height,
    }
  }, number)
}

const canvas = (page: Page) => page.getByTestId('plan-canvas')
const panel = (page: Page) => page.getByRole('list', { name: 'Photos à placer' })
const pin = (page: Page, n: number) => page.locator(`[data-pin-number="${n}"]`)

async function setupVisitWithPhotos(page: Page) {
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Visite plan')
  await create.getByLabel('Nom du site').fill('Entrepôt Lyon')
  await create.getByLabel('Nom du site').press('Enter')
  await page.getByRole('tab', { name: /^Photos/ }).click()
  await page
    .getByTestId('photo-input')
    .setInputFiles([photo('exif-mm.jpg'), photo('exif-ii.jpg'), photo('paysage-sans-exif.jpg')])
  await expect(page.getByRole('tab', { name: 'Photos (3)' })).toBeVisible()
}

test('plan: PDF import, placement, moves, reload, cascade, second plan, download, errors', async ({
  page,
}) => {
  const problems = watch(page)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await setupVisitWithPhotos(page)
  // Photo 1 is a "Désordre" (red pin).
  await page.getByRole('combobox', { name: 'Catégorie de la photo 1' }).selectOption('defect')

  // 1. Import the PDF, page 2.
  await page.getByRole('tab', { name: /^Plan/ }).click()
  await expect(page.getByText('Importez le plan de l’entrepôt (PDF ou image)')).toBeVisible()
  await page.getByRole('button', { name: /Importez le plan/ }).click()
  await page.getByTestId('plan-input').setInputFiles(planFile('entrepot-2-pages.pdf'))
  await expect(page.getByRole('radio', { name: 'Page 1' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Page 2' }).click()
  await expect(page.getByLabel('Nom du plan')).toHaveValue('entrepot-2-pages – p. 2')
  const renderStart = Date.now()
  await page.getByRole('button', { name: 'Importer le plan' }).click()
  await expect(page.getByTestId('plan-image')).toBeVisible()
  const renderMs = Date.now() - renderStart
  console.log(`[perf] PDF page render + save: ${renderMs} ms`)
  test.info().annotations.push({
    type: 'performance',
    description: `Rendu page PDF + enregistrement : ${renderMs} ms`,
  })
  await expect(page.getByTestId('plan-image')).toHaveJSProperty('naturalWidth', 4096)
  await expect(page).toHaveURL(/\/plan\?p=[\w-]+$/)
  await expect(
    page.getByRole('button', { name: 'entrepot-2-pages – p. 2', exact: true }),
  ).toBeVisible()

  // 2. Place photo 1 by drag and drop, photo 2 in click mode.
  await panel(page)
    .getByRole('button')
    .first()
    .dragTo(canvas(page), { targetPosition: { x: 300, y: 250 } })
  await expect(page.getByText('Repère n°1 ajouté')).toBeVisible()
  await panel(page).getByRole('button').first().click()
  await expect(page.getByText(/Cliquez sur le plan pour placer la photo n°2/)).toBeVisible()
  await canvas(page).click({ position: { x: 500, y: 320 } })
  await expect(page.getByText('Repère n°2 ajouté')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Plan (2)' })).toBeVisible()

  // 3. Move pin 1 with the mouse, pin 2 with the keyboard.
  const before1 = await pinPosition(page, 1)
  const box = (await pin(page, 1).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 })
  await page.mouse.up()
  const after1 = await pinPosition(page, 1)
  expect(after1.x).toBeGreaterThan(before1.x + 0.05)
  const before2 = await pinPosition(page, 2)
  await pin(page, 2).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  const after2 = await pinPosition(page, 2)
  expect(after2.x - before2.x).toBeCloseTo(0.005, 3)
  expect(after2.y - before2.y).toBeCloseTo(0.05, 3)

  // 4. Placing an already placed photo moves it, number unchanged.
  await page.getByRole('radio', { name: 'Placées', exact: true }).check({ force: true })
  await panel(page)
    .getByRole('button', { name: /repère n°1/ })
    .click()
  await canvas(page).click({ position: { x: 650, y: 200 } })
  await expect(page.getByText('Repère n°1 déplacé')).toBeVisible()
  await expect(pin(page, 1)).toHaveCount(1)
  await expect(page.getByRole('tab', { name: 'Plan (2)' })).toBeVisible()
  const final1 = await pinPosition(page, 1)
  const final2 = await pinPosition(page, 2)
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible()

  // 5. Reload: positions kept (± 0.5 %).
  await page.reload()
  await expect(pin(page, 2)).toBeVisible()
  for (const [n, expected] of [
    [1, final1],
    [2, final2],
  ] as const) {
    const actual = await pinPosition(page, n)
    expect(Math.abs(actual.x - expected.x)).toBeLessThan(0.005)
    expect(Math.abs(actual.y - expected.y)).toBeLessThan(0.005)
  }

  // 6. Deleting a placed photo in the Photos tab removes its pin.
  await page.getByRole('tab', { name: /^Photos/ }).click()
  const card = page.getByRole('article').filter({ hasText: 'Plan n°2' })
  await card.getByRole('button', { name: /^Actions pour la photo/ }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('1 repère sera retiré du plan (n°2)')
  await confirm.getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('tab', { name: /^Plan/ }).click()
  await expect(pin(page, 1)).toBeVisible()
  await expect(pin(page, 2)).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Plan (1)' })).toBeVisible()

  // 7. Second plan (PNG) and move pin 1 onto it.
  await page.getByRole('button', { name: 'Ajouter un plan' }).click()
  await page.getByTestId('plan-input').setInputFiles(planFile('plan-rdc.png'))
  await expect(page.getByLabel('Nom du plan')).toHaveValue('plan-rdc')
  await page.getByRole('button', { name: 'Importer le plan' }).click()
  await expect(page.getByRole('button', { name: 'plan-rdc', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('plan-image')).toHaveJSProperty('naturalWidth', 1600)
  await expect(pin(page, 1)).toHaveCount(0)
  await page.getByRole('radio', { name: 'Placées', exact: true }).check({ force: true })
  await panel(page)
    .getByRole('button', { name: /repère n°1/ })
    .click()
  await canvas(page).click({ position: { x: 400, y: 300 } })
  await expect(page.getByText('Repère n°1 déplacé')).toBeVisible()
  await expect(pin(page, 1)).toBeVisible()
  await expect(panel(page)).toContainText('plan-rdc')
  const onPng = await pinPosition(page, 1)

  // 8. Download the annotated plan.
  await page.getByRole('button', { name: 'Plan « plan-rdc »' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Télécharger le plan annoté (PNG)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(
    /^Entrepôt Lyon - plan-rdc - \d{4}-\d{2}-\d{2}\.png$/,
  )
  const bytes = readFileSync(await download.path())
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  expect([width, height]).toEqual([1600, 1100])
  const color = await page.evaluate(
    async ({ base64, x, y }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      context.drawImage(bitmap, 0, 0)
      // 24 px pin: sample left of the number, inside the colored disc.
      const data = context.getImageData(
        Math.round(x * bitmap.width - 6),
        Math.round(y * bitmap.height),
        1,
        1,
      ).data
      return [data[0], data[1], data[2]]
    },
    { base64: bytes.toString('base64'), x: onPng.x, y: onPng.y },
  )
  const red = [0xe1, 0x00, 0x0f]
  color.forEach((channel, i) => {
    expect(Math.abs((channel ?? 0) - (red[i] ?? 0))).toBeLessThan(40)
  })

  // 9. Corrupted and protected PDFs: French messages, no crash.
  await page.getByRole('button', { name: 'Ajouter un plan' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ajouter un plan' })
  await page.getByTestId('plan-input').setInputFiles(planFile('corrompu.pdf'))
  await expect(dialog.getByRole('alert')).toHaveText(
    'Ce PDF est endommagé ou illisible. Exportez-le de nouveau depuis AutoCAD (PDF ou PNG).',
  )
  await page.getByTestId('plan-input').setInputFiles(planFile('protege.pdf'))
  await expect(dialog.getByRole('alert')).toHaveText(
    'Ce PDF est protégé par un mot de passe. Exportez-le sans protection ou en PNG.',
  )
  await expect(dialog.getByRole('button', { name: 'Importer le plan' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(pin(page, 1)).toBeVisible()

  expect(problems).toEqual([])
})

test('zoom stays fluid with 30 pins and never updates the visit', async ({ page }) => {
  const problems = watch(page)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Zoom')
  await create.getByLabel('Nom du site').fill('Site')
  await create.getByLabel('Nom du site').press('Enter')
  await page.getByRole('tab', { name: /^Photos/ }).click()
  // 30 small generated photos.
  const files = await page.evaluate(async () => {
    const result: { name: string; mimeType: string; base64: string }[] = []
    for (let i = 1; i <= 30; i++) {
      const canvas = new OffscreenCanvas(64, 48)
      const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      context.fillStyle = `hsl(${i * 12} 70% 50%)`
      context.fillRect(0, 0, 64, 48)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg' })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      result.push({
        name: `P_${i}.jpg`,
        mimeType: 'image/jpeg',
        base64: btoa(String.fromCharCode(...bytes)),
      })
    }
    return result
  })
  await page
    .getByTestId('photo-input')
    .setInputFiles(files.map((f) => ({ ...f, buffer: Buffer.from(f.base64, 'base64') })))
  await expect(page.getByRole('tab', { name: 'Photos (30)' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: /^Plan/ }).click()
  await page.getByRole('button', { name: /Importez le plan/ }).click()
  await page.getByTestId('plan-input').setInputFiles(planFile('plan-rdc.png'))
  await page.getByRole('button', { name: 'Importer le plan' }).click()
  await expect(page.getByTestId('plan-image')).toBeVisible()
  for (let i = 0; i < 30; i++) {
    await panel(page).getByRole('button').first().click()
    await canvas(page).click({
      position: { x: 60 + (i % 10) * 70, y: 160 + Math.floor(i / 10) * 120 },
    })
  }
  await expect(page.getByRole('tab', { name: 'Plan (30)' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible()

  // 40 wheel steps: measure the time and the frames, check that nothing is saved.
  const box = (await canvas(page).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const frames = await page.evaluate(() => {
    ;(window as unknown as { __frames: number }).__frames = 0
    const tick = () => {
      ;(window as unknown as { __frames: number }).__frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return 0
  })
  expect(frames).toBe(0)
  const started = Date.now()
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, i < 20 ? -120 : 120)
  const elapsed = Date.now() - started
  const counted = await page.evaluate(() => (window as unknown as { __frames: number }).__frames)
  const fps = Math.round((counted * 1000) / elapsed)
  console.log(`[perf] 40 wheel zooms with 30 pins: ${elapsed} ms, ~${fps} fps`)
  test.info().annotations.push({
    type: 'performance',
    description: `Zoom, 30 repères : 40 crans en ${elapsed} ms, ~${fps} images/s`,
  })
  expect(Number(await canvas(page).getAttribute('data-zoom'))).toBeGreaterThanOrEqual(100)
  // No update during the zoom: the save status did not change.
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible()
  await expect(page.getByText('Modifications en cours…')).toHaveCount(0)
  expect(problems).toEqual([])
})
