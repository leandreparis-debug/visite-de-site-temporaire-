import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { expect, test, type Page } from '@playwright/test'
import { createVisit, fillCompleteVisit, indexUrl, isoInDays, tab, watch } from './helpers'

/** Generates the Word report of the open visit and returns its document.xml. */
async function generateReport(page: Page) {
  await tab(page, 'Rapport').click()
  const downloading = page.waitForEvent('download', { timeout: 120_000 })
  await page.getByRole('button', { name: 'Générer le rapport Word' }).click()
  const download = await downloading
  const zip = await JSZip.loadAsync(readFileSync(await download.path()))
  return {
    name: download.suggestedFilename(),
    xml: (await zip.file('word/document.xml')?.async('string')) ?? '',
  }
}

/**
 * The whole life of a site follow-up, like a Property Manager: create and
 * fill a visit, generate its report, duplicate it for the next visit, move a
 * DO claim forward, generate the second report, delete the original.
 */
test('full journey: visit, report, follow-up visit, second report, deletion', async ({ page }) => {
  test.setTimeout(300_000)
  const problems = watch(page)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(indexUrl)

  // 1-2. Create the visit and fill every tab.
  await createVisit(page, 'Visite annuelle Lyon', 'Entrepôt Lyon Nord')
  await fillCompleteVisit(page)

  // 3. First report: the insurer's position is overdue.
  const first = await generateReport(page)
  expect(first.name).toBe(`CR - Entrepôt Lyon Nord - ${isoInDays(0)}.docx`)
  expect(first.xml).toContain('En cours : Déclaration du sinistre — 0 / 10 étapes')
  expect(first.xml).toMatch(/Position sur la garantie attendue avant le [\d/]+ — dépassé de 10/)
  await expect(page.getByText(/^Rapport généré le /).first()).toBeVisible()

  // 4. Duplicate for the next visit.
  await page.getByRole('button', { name: 'Actions pour « Visite annuelle Lyon »' }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await page
    .getByRole('dialog', { name: 'Dupliquer la visite' })
    .getByRole('button', { name: 'Dupliquer' })
    .click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Copie — Visite annuelle Lyon' }),
  ).toBeVisible()
  // No report yet for the copy.
  await expect(page.getByText(/^Rapport généré le /)).toHaveCount(0)

  // 5. Move the claim forward on the copy.
  await tab(page, 'DO & assurances').click()
  const claim = page.getByRole('article', { name: 'DO-2026-014' })
  for (const step of [
    'Déclaration du sinistre',
    'Accusé de réception de l’assureur',
    'Position de l’assureur sur la garantie',
  ]) {
    await claim.getByLabel(`Statut : ${step}`).selectOption('done')
  }
  await expect(claim.getByText('3 / 10 étapes')).toBeVisible()
  await expect(claim.locator('[data-deadline="coverage_decision"]')).toHaveAttribute(
    'data-state',
    'done',
  )

  // 6. Second report, with the new state of the claim.
  const second = await generateReport(page)
  expect(second.xml).toContain('Copie — Visite annuelle Lyon')
  expect(second.xml).toContain('En cours : Désignation de l’expert — 3 / 10 étapes')
  expect(second.xml).toMatch(/Position sur la garantie attendue avant le [\d/]+ — étape terminée/)
  // Notes are kept (default choice), photos and pins are not: no photo sheet.
  expect(second.xml).toContain('Observations par zone')
  expect(second.xml).not.toContain('Planche photos')

  // 7. Delete the original: its report was generated, no warning.
  await page.getByRole('link', { name: 'Visites', exact: true }).click()
  await page.getByRole('button', { name: 'Actions pour « Visite annuelle Lyon »' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Supprimer la visite ?' })
  await expect(dialog).toContainText('Générez le rapport Word avant')
  await expect(dialog).not.toContainText('Aucun rapport n’a été généré')
  await dialog.getByRole('button', { name: 'Supprimer' }).click()
  const cards = page.getByRole('list', { name: 'Visites' }).getByRole('heading', { level: 3 })
  await expect(cards).toHaveText(['Copie — Visite annuelle Lyon'])
  await expect(page.getByText(/^Rapport généré le /)).toBeVisible()

  expect(problems).toEqual([])
})
