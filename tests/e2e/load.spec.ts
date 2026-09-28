import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createVisit, indexUrl, isoInDays, planFixture, tab, watch } from './helpers'

/**
 * Load test of a realistic big visit: 60 photos of 12 Mpx, 2 PDF plans,
 * 40 pins, 10 note sections, 3 DO claims, 15 costs. Measures the photo
 * import, the fluidity of the gallery and the plan, the report generation
 * (Standard and Allégée) and the storage used. Results: docs/PERFORMANCE.md.
 */
const PHOTO_COUNT = 60
const PIN_COUNT = 40

const results: Record<string, string | number> = {}
function record(key: string, value: string | number) {
  results[key] = value
  console.log(`[load] ${key}: ${value}`)
  test.info().annotations.push({ type: 'performance', description: `${key} : ${value}` })
}

/** 12 Mpx JPEGs (4000×3000, gradient + noise, ~3-5 MB), all different. */
async function generatePhotos(
  page: Page,
  dir: string,
): Promise<{ paths: string[]; bytes: number }> {
  const paths: string[] = []
  let bytes = 0
  for (let start = 0; start < PHOTO_COUNT; start += 5) {
    const batch = await page.evaluate(async (first) => {
      const out: string[] = []
      for (let i = first; i < first + 5; i++) {
        const [width, height] = i % 3 ? [4000, 3000] : [3000, 4000]
        const canvas = new OffscreenCanvas(width, height)
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        const gradient = context.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, `hsl(${(i * 37) % 360} 45% 55%)`)
        gradient.addColorStop(1, `hsl(${(i * 37 + 120) % 360} 40% 35%)`)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
        const image = context.getImageData(0, 0, width, height)
        let seed = i * 7919 + 1
        for (let p = 0; p < image.data.length; p += 4) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff
          const noise = (seed % 48) - 24
          image.data[p] = (image.data[p] ?? 0) + noise
          image.data[p + 1] = (image.data[p + 1] ?? 0) + noise
          image.data[p + 2] = (image.data[p + 2] ?? 0) + noise
        }
        context.putImageData(image, 0, 0)
        context.fillStyle = '#ffffff'
        context.font = 'bold 240px sans-serif'
        context.fillText(`Photo ${i + 1}`, 200, 400)
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
        const data = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (let b = 0; b < data.length; b += 0x8000)
          binary += String.fromCharCode(...data.subarray(b, b + 0x8000))
        out.push(btoa(binary))
      }
      return out
    }, start)
    batch.forEach((base64, offset) => {
      const path = join(dir, `IMG_${String(start + offset + 1).padStart(4, '0')}.jpg`)
      const buffer = Buffer.from(base64, 'base64')
      bytes += buffer.length
      writeFileSync(path, buffer)
      paths.push(path)
    })
  }
  return { paths, bytes }
}

/** Frames per second while `action` runs (requestAnimationFrame count). */
async function measureFps(page: Page, action: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const state = { frames: 0, running: true }
    ;(window as unknown as { __fps: typeof state }).__fps = state
    const tick = () => {
      state.frames++
      if (state.running) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const started = Date.now()
  await action()
  const frames = await page.evaluate(() => {
    const state = (window as unknown as { __fps: { frames: number; running: boolean } }).__fps
    state.running = false
    return state.frames
  })
  return Math.round((frames * 1000) / (Date.now() - started))
}

async function generateReport(page: Page, dir: string, name: string) {
  const started = Date.now()
  const downloading = page.waitForEvent('download', { timeout: 180_000 })
  await page.getByRole('button', { name: 'Générer le rapport Word' }).click()
  const download = await downloading
  const path = join(dir, name)
  await download.saveAs(path)
  const seconds = (Date.now() - started) / 1000
  await expect(page.getByText(/^Rapport généré \(/).first()).toBeVisible()
  return { seconds, bytes: readFileSync(path).length }
}

test('load: 60 photos of 12 Mpx, 2 PDF plans, 40 pins, report in less than 60 s', async ({
  page,
}) => {
  test.setTimeout(20 * 60_000)
  const problems = watch(page)
  const dir = mkdtempSync(join(tmpdir(), 'cp-load-'))
  try {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.goto(indexUrl)
    await createVisit(page, 'Visite de charge', 'Entrepôt Lyon Nord')
    await page.getByLabel('Rédacteur').fill('Arnaud Montigny')

    // 10 note sections.
    await tab(page, 'Notes').click()
    for (let i = 1; i <= 10; i++) {
      await page.getByRole('button', { name: 'Ajouter une section' }).click()
      await page.getByRole('combobox', { name: `Titre de la section ${i}` }).fill(`Zone ${i}`)
      await page
        .getByRole('textbox', { name: `Notes : Zone ${i}` })
        .fill(`Constat de la zone ${i} :\n- point A\n- point B\n\nÀ suivre.`)
    }

    // 60 photos of 12 Mpx.
    const { paths, bytes } = await generatePhotos(page, dir)
    record('Photos importées', `${PHOTO_COUNT} × 12 Mpx (${(bytes / 1024 / 1024).toFixed(0)} Mo)`)
    await tab(page, 'Photos').click()
    const started = Date.now()
    await page.getByTestId('photo-input').setInputFiles(paths)
    await expect(page.getByText(new RegExp(`${PHOTO_COUNT}\\s+photos importées`))).toBeVisible({
      timeout: 10 * 60_000,
    })
    const importSeconds = (Date.now() - started) / 1000
    record(
      'Import des photos',
      `${importSeconds.toFixed(1)} s (${((importSeconds * 1000) / PHOTO_COUNT).toFixed(0)} ms par photo)`,
    )
    await expect(tab(page, `Photos (${PHOTO_COUNT})`)).toBeVisible()

    // Gallery fluidity: scroll the whole grid.
    const galleryFps = await measureFps(page, async () => {
      for (let i = 0; i < 30; i++) {
        await page.mouse.move(700, 600)
        await page.mouse.wheel(0, i < 15 ? 400 : -400)
        await page.waitForTimeout(30)
      }
    })
    record('Galerie : défilement', `~${galleryFps} images/s`)

    // 2 PDF plans (pages 1 and 2), 20 pins each (click mode).
    await tab(page, 'Plan').click()
    for (const pageNumber of [1, 2]) {
      if (pageNumber === 1) await page.getByRole('button', { name: /Importez le plan/ }).click()
      else await page.getByRole('button', { name: 'Ajouter un plan' }).click()
      await page.getByTestId('plan-input').setInputFiles(planFixture('entrepot-2-pages.pdf'))
      await page.getByRole('radio', { name: `Page ${pageNumber}` }).click()
      await page.getByRole('button', { name: 'Importer le plan' }).click()
      await expect(page).toHaveURL(/\/plan\?p=/)
      await expect(page.getByTestId('plan-image')).toBeVisible({ timeout: 30_000 })
      const canvas = page.getByTestId('plan-canvas')
      const panel = page.getByRole('list', { name: 'Photos à placer' })
      for (let i = 0; i < PIN_COUNT / 2; i++) {
        await panel.getByRole('button').first().click()
        await canvas.click({
          position: { x: 150 + (i % 5) * 110, y: 180 + Math.floor(i / 5) * 70 },
        })
        const number = (pageNumber - 1) * (PIN_COUNT / 2) + i + 1
        await expect(page.locator(`[data-pin-number="${number}"]`)).toBeVisible()
      }
    }
    await expect(tab(page, `Plan (${PIN_COUNT})`)).toBeVisible()

    // Plan fluidity: 40 wheel zooms with 20 pins.
    const planFps = await measureFps(page, async () => {
      const box = (await page.getByTestId('plan-canvas').boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      for (let i = 0; i < 40; i++) {
        await page.mouse.wheel(0, i < 20 ? -120 : 120)
        await page.waitForTimeout(25)
      }
    })
    record('Plan : zoom avec 20 repères', `~${planFps} images/s`)

    // 3 DO claims.
    await tab(page, 'DO & assurances').click()
    for (const [index, days] of [70, 30, 400].entries()) {
      await page.getByRole('button', { name: 'Déclarer un sinistre' }).click()
      const declare = page.getByRole('dialog', { name: 'Déclarer un sinistre DO' })
      await declare.getByLabel('Description du sinistre').fill(`Sinistre ${index + 1}`)
      await declare.getByLabel('Référence').fill(`DO-2026-${index + 1}`)
      await declare.getByLabel('Date de déclaration').fill(isoInDays(-days))
      await declare.getByRole('button', { name: 'Déclarer' }).click()
      await expect(declare).toBeHidden()
    }

    // 15 costs.
    await tab(page, 'Projets & coûts').click()
    const projectForm = page.getByRole('form', { name: 'Ajouter un projet' })
    await projectForm.getByLabel('Nom du projet').fill('Réfection toiture')
    await projectForm.getByLabel('Nom du projet').press('Enter')
    const costForm = page.getByRole('form', { name: 'Ajouter un coût' })
    for (let i = 1; i <= 15; i++) {
      await costForm.getByLabel('Libellé').fill(`Ligne de coût ${i}`)
      await costForm.getByLabel('Montant HT').fill(`${i * 1234},50`)
      if (i % 2) await costForm.getByLabel('Projet').selectOption({ label: 'Réfection toiture' })
      await costForm.getByLabel('Libellé').press('Enter')
      await expect(page.getByLabel(`Libellé : Ligne de coût ${i}`)).toBeVisible()
    }
    await expect(page.getByText('Modifications en cours…')).toHaveCount(0, { timeout: 10_000 })

    // Reports: Standard, then Allégée.
    await tab(page, 'Rapport').click()
    await expect(page.getByRole('region', { name: 'Contenu du rapport' })).toContainText(
      `${PHOTO_COUNT} photos`,
    )
    const estimateStandard = await page.getByText(/^Taille estimée/).textContent()
    const standard = await generateReport(page, dir, 'standard.docx')
    record(
      'Rapport Standard',
      `${standard.seconds.toFixed(1)} s, ${(standard.bytes / 1024 / 1024).toFixed(1)} Mo (${estimateStandard?.replace('Taille estimée : ', 'estimation ')})`,
    )
    await page.getByRole('radiogroup', { name: 'Qualité des images' }).getByText('Allégée').click()
    const estimateLight = await page.getByText(/^Taille estimée/).textContent()
    const light = await generateReport(page, dir, 'light.docx')
    record(
      'Rapport Allégée',
      `${light.seconds.toFixed(1)} s, ${(light.bytes / 1024 / 1024).toFixed(1)} Mo (${estimateLight?.replace('Taille estimée : ', 'estimation ')})`,
    )

    const usage = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0)
    record('Stockage utilisé', `${(usage / 1024 / 1024).toFixed(0)} Mo`)

    mkdirSync(test.info().outputDir, { recursive: true })
    writeFileSync(
      join(test.info().outputDir, 'load-results.json'),
      JSON.stringify(results, null, 2),
    )
    // The estimate shown before generating is in the right range.
    const toBytes = (text: string | null) => {
      const match = /environ ([\d,]+) (Ko|Mo)/.exec(text ?? '')
      const value = Number((match?.[1] ?? '0').replace(',', '.'))
      return value * (match?.[2] === 'Mo' ? 1024 * 1024 : 1024)
    }
    for (const [estimate, actual] of [
      [toBytes(estimateStandard), standard.bytes],
      [toBytes(estimateLight), light.bytes],
    ] as const) {
      expect(estimate).toBeGreaterThan(actual / 2)
      expect(estimate).toBeLessThan(actual * 2)
    }
    expect(standard.seconds).toBeLessThan(60)
    expect(light.bytes).toBeLessThan(standard.bytes)
    expect(problems).toEqual([])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
