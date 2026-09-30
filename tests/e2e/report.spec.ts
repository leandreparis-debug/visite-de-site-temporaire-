import { readFileSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'
import { expect, test, type Page } from '@playwright/test'
import { createVisit, fillCompleteVisit, indexUrl, isoInDays, tab, watch } from './helpers'

const screenshots = process.env.E2E_SCREENSHOTS

/** Clicks "Générer le rapport Word" and returns the downloaded file. */
async function generate(page: Page) {
  const started = Date.now()
  const downloading = page.waitForEvent('download', { timeout: 120_000 })
  await page.getByRole('button', { name: 'Générer le rapport Word' }).click()
  const download = await downloading
  const bytes = readFileSync(await download.path())
  const ms = Date.now() - started
  await expect(page.getByText(/^Rapport généré \(/).first()).toBeVisible()
  return { name: download.suggestedFilename(), bytes, ms }
}

test('Word report of a complete visit in file://', async ({ page }) => {
  test.setTimeout(240_000)
  const problems = watch(page)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(indexUrl)

  // 1. A complete visit.
  await createVisit(page, 'Visite annuelle Lyon', 'Entrepôt Lyon / Nord')
  await fillCompleteVisit(page)

  // Photos 2 and 3 illustrate the "Toiture" area of the notes.
  await tab(page, 'Notes').click()
  await page.getByRole('button', { name: 'Lier des photos : Toiture' }).click()
  const picker = page.getByRole('dialog', { name: 'Photos de la zone « Toiture »' })
  await picker.getByRole('button', { name: /^Photo n°2( :|$)/ }).click()
  await picker.getByRole('button', { name: /^Photo n°3( :|$)/ }).click()
  await expect(picker).toContainText('2 photos sélectionnées')
  await picker.getByRole('button', { name: 'Valider' }).click()
  await expect(
    page.getByRole('list', { name: 'Photos liées : Toiture' }).getByRole('listitem'),
  ).toHaveCount(2)

  // 2. The Report tab: previews, points to check, estimate, cover photo.
  await tab(page, 'Rapport').click()
  const contents = page.getByRole('region', { name: 'Contenu du rapport' })
  await expect(contents).toContainText('2 sections, 2 photos liées')
  await page.getByRole('button', { name: 'Choisir la photo de garde' }).click()
  const coverPicker = page.getByRole('dialog', { name: 'Photo de la page de garde' })
  await coverPicker.getByRole('button', { name: /^Photo n°1( :|$)/ }).click()
  await coverPicker.getByRole('button', { name: 'Valider' }).click()
  await expect(page.getByRole('img', { name: /^Photo de la page de garde/ })).toBeVisible()
  await expect(contents).toContainText('5 photos (1 sans légende)')
  await expect(contents).toContainText('1 plan, 3 repères')
  await expect(page.getByRole('link', { name: '1 photo sans légende' })).toBeVisible()
  const estimate = page.getByText(/^Taille estimée/)
  const standardEstimate = await estimate.textContent()
  if (screenshots) await page.screenshot({ path: `${screenshots}/report-tab.png`, fullPage: true })

  const standard = await generate(page)
  console.log(`[perf] report standard: ${standard.bytes.length} bytes in ${standard.ms} ms`)
  if (screenshots) writeFileSync(`${screenshots}/report-standard.docx`, standard.bytes)

  // 3. File name (forbidden characters removed) and content of the archive.
  expect(standard.name).toBe(`CR - Entrepôt Lyon Nord - ${isoInDays(0)}.docx`)
  const zip = await JSZip.loadAsync(standard.bytes)
  const document = (await zip.file('word/document.xml')?.async('string')) ?? ''
  for (const text of [
    'Compte rendu de visite technique',
    'Visite annuelle Lyon',
    'Entrepôt Lyon / Nord',
    '1. Synthèse',
    '2. Informations générales',
    '3. Observations par zone',
    '4. Points d’attention et actions',
    '5. Plans annotés',
    '6. Planche photos',
    '7. Dommages-Ouvrage et assurances',
    '8. Projets et coûts',
    'Absents / excusés',
    'Repère n°1',
    'Repère n°3',
    'Photo n°5',
    'Sans légende',
    'Chéneau nord bouché',
    'Total général',
    'Délai indicatif (art. L242-1 du Code des assurances)',
  ]) {
    expect(document, text).toContain(text)
  }
  // Grand total: 12 500,50 + 1 850 + 32 000 + 980,40 HT at 20 %.
  const ttc = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    ((1_250_050 + 185_000 + 3_200_000 + 98_040) * 1.2) / 100,
  )
  expect(document).toContain(ttc)
  // Photos under their area, named in the photo sheet; the cover photo.
  expect(document).toContain('Zone : Toiture')
  // 5 photos in the sheet + 2 under "Toiture" + 1 on the cover + 1 plan + the cover logo.
  expect(document.match(/<w:drawing>/g)).toHaveLength(10)
  // Portrait everywhere, plans included.
  expect(document).not.toContain('w:orient="landscape"')
  const media = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith('word/media/'))
  // 5 photos + 1 plan + the logo.
  expect(media).toHaveLength(7)
  const headers = Object.keys(zip.files).filter((p) => /^word\/header\d+\.xml$/.test(p))
  expect(headers.length).toBeGreaterThan(0)
  expect(await zip.file(headers[0]!)?.async('string')).toContain('Entrepôt Lyon / Nord')

  // The visit now shows its report date.
  await expect(page.getByText(/^Rapport généré le /).first()).toBeVisible()

  // 4. "Allégée" and 4 per page: a lighter file.
  await page.getByRole('radiogroup', { name: 'Qualité des images' }).getByText('Allégée').click()
  await page.getByRole('radiogroup', { name: 'Photos par page' }).getByText('4 par page').click()
  await expect(estimate).not.toHaveText(standardEstimate ?? '')
  const light = await generate(page)
  console.log(`[perf] report light: ${light.bytes.length} bytes in ${light.ms} ms`)
  expect(light.bytes.length).toBeLessThan(standard.bytes.length)

  // The list card shows the report date too.
  await page.getByRole('link', { name: 'Visites', exact: true }).click()
  await expect(page.getByText(/^Rapport généré le /)).toBeVisible()

  expect(problems).toEqual([])
})
