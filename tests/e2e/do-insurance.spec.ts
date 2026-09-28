import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href
const screenshots = process.env.E2E_SCREENSHOTS

/** Collects console errors, page errors and non-local requests. */
function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith('file:') && !url.startsWith('data:') && !url.startsWith('blob:'))
      problems.push(`request: ${url}`)
  })
  return problems
}

/** Local date `YYYY-MM-DD`, `days` from today (the browser runs on the same machine). */
function isoInDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const COVERAGE = 'Position de l’assureur sur la garantie'
const claimCard = (page: Page) => page.getByRole('article', { name: 'DO-2026-014' })
const deadline = (page: Page, kind: string) => claimCard(page).locator(`[data-deadline="${kind}"]`)
const tabpanel = (page: Page) => page.getByRole('tabpanel')

/** Checks the whole DO & insurance content, on the original visit or its copy. */
async function expectSavedContent(page: Page) {
  const panel = tabpanel(page)
  await expect(panel.getByLabel(/^Assureur : Dommages-Ouvrage/)).toHaveValue('Assureur DO SA')
  await expect(panel.getByLabel(/^Assureur : Multirisque/)).toHaveValue('MMA Entreprises')
  await expect(panel.getByText('Expire dans 30\u00a0j')).toBeVisible()
  const card = claimCard(page)
  await expect(card.getByLabel('Montant réclamé')).toHaveValue(/^12\s500,50\s€$/)
  await expect(card.getByLabel('Montant indemnisé')).toHaveValue(/^10\s000,00\s€$/)
  await expect(card.getByLabel(`Statut : ${COVERAGE}`)).toHaveValue('done')
  await expect(card.getByLabel('Statut : Déclaration du sinistre')).toHaveValue('todo')
  await expect(deadline(page, 'coverage_decision')).toHaveAttribute('data-state', 'done')
  await expect(card.getByLabel('Date de déclaration')).toHaveValue(isoInDays(-70))
}

test('DO claims and insurance contracts in file://', async ({ page }) => {
  const problems = watch(page)
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Visite DO Lyon')
  await create.getByLabel('Nom du site').fill('Entrepôt Lyon Nord')
  await create.getByRole('button', { name: 'Créer la visite' }).click()
  await page.getByRole('tab', { name: /^DO & assurances/ }).click()
  await expect(page).toHaveURL(/\/do-insurance$/)
  await expect(tabpanel(page)).toContainText('Aucun contrat renseigné.')
  await expect(tabpanel(page)).toContainText('Aucun sinistre DO suivi sur ce site.')

  // 1. Two contracts, one ending in 30 days.
  const entry = page.getByRole('form', { name: 'Ajouter un contrat' })
  await entry.getByLabel('Type').selectOption('dommages_ouvrage')
  await entry.getByLabel('Assureur').fill('Assureur DO SA')
  await entry.getByLabel('N° de police').fill('DO-778899')
  await entry.getByLabel('Date de fin').fill(isoInDays(30))
  await entry.getByLabel('Assureur').press('Enter')
  await expect(entry.getByLabel('Assureur')).toHaveValue('')
  await entry.getByLabel('Type').selectOption('multirisque')
  await entry.getByLabel('Assureur').fill('MMA Entreprises')
  await entry.getByLabel('Date de fin').fill(isoInDays(400))
  await entry.getByRole('button', { name: 'Ajouter' }).click()
  await expect(tabpanel(page).getByText('Expire dans 30\u00a0j')).toBeVisible()
  await expect(tabpanel(page).getByText('Valide', { exact: true })).toBeVisible()
  const banner = page.getByRole('navigation', { name: 'Synthèse DO et assurances' })
  await expect(banner).toContainText('2 contrats dont 1 expire bientôt')

  // 2. A claim declared 70 days ago: the insurer's position (60 days) is overdue.
  await page.getByRole('button', { name: 'Déclarer un sinistre' }).click()
  const declare = page.getByRole('dialog', { name: 'Déclarer un sinistre DO' })
  await declare.getByLabel('Description du sinistre').fill('Infiltrations en toiture, cellule 3')
  await declare.getByLabel('Localisation').fill('Cellule 3')
  await declare.getByLabel('Référence').fill('DO-2026-014')
  // The only DO contract's insurer is prefilled.
  await expect(declare.getByLabel('Assureur')).toHaveValue('Assureur DO SA')
  await declare.getByLabel('Date de déclaration').fill(isoInDays(-70))
  await declare.getByRole('button', { name: 'Déclarer' }).click()
  await expect(declare).toBeHidden()

  const card = claimCard(page)
  await expect(card.locator('[data-step-type]')).toHaveCount(10)
  await expect(card.getByText('En cours : Déclaration du sinistre')).toBeVisible()
  await expect(card.getByText('0 / 10 étapes')).toBeVisible()
  await expect(deadline(page, 'coverage_decision')).toHaveAttribute('data-state', 'overdue')
  await expect(deadline(page, 'coverage_decision')).toContainText('dépassé de 10\u00a0j')
  await expect(deadline(page, 'compensation_offer')).toContainText('dans 20\u00a0j')
  await expect(card).toContainText('Délai indicatif (art. L242-1 du Code des assurances)')
  await expect(banner.getByRole('button', { name: '1 délai dépassé' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^DO & assurances \(1\) — alerte$/ })).toBeVisible()
  if (screenshots) await page.screenshot({ path: `${screenshots}/do-overdue.png`, fullPage: true })

  // 3. The insurer's position is received: no more alert.
  await card.getByLabel(`Statut : ${COVERAGE}`).selectOption('done')
  await expect(deadline(page, 'coverage_decision')).toHaveAttribute('data-state', 'done')
  await expect(banner.getByRole('button', { name: /dépassé/ })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'DO & assurances (1)', exact: true })).toBeVisible()
  // Done without a date: today's date is filled in.
  await expect(card.getByLabel(`Date : ${COVERAGE}`)).toHaveValue(isoInDays(0))

  // 4. Amounts typed in the French format.
  await card.getByLabel('Montant réclamé').fill('12 500,50')
  await card.getByLabel('Montant indemnisé').fill('10000')
  await card.getByLabel('Montant indemnisé').blur()
  await expect(card.getByLabel('Montant réclamé')).toHaveValue(/^12\s500,50\s€$/)
  await expect(page.getByRole('status')).toHaveText('Enregistré')
  if (screenshots) await page.screenshot({ path: `${screenshots}/do-done.png`, fullPage: true })

  // 5. Reload: everything is kept.
  await page.reload()
  await expectSavedContent(page)

  // 6. Duplicate: claim, steps, amounts and contracts follow on the copy.
  await page.getByRole('button', { name: 'Actions pour « Visite DO Lyon »' }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await page
    .getByRole('dialog', { name: 'Dupliquer la visite' })
    .getByRole('button', { name: 'Dupliquer' })
    .click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Copie — Visite DO Lyon' }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /^DO & assurances/ }).click()
  await expectSavedContent(page)

  // Advancing a step on the copy leaves the original untouched.
  const ACK = 'Statut : Accusé de réception de l’assureur'
  await claimCard(page).getByLabel(ACK).selectOption('done')
  await expect(page.getByRole('status')).toHaveText('Enregistré')
  await page.getByRole('link', { name: 'Visites', exact: true }).click()
  await page
    .getByRole('list', { name: 'Visites' })
    .getByRole('link', { name: 'Visite DO Lyon', exact: true })
    .click()
  await page.getByRole('tab', { name: /^DO & assurances/ }).click()
  await expect(claimCard(page).getByLabel(ACK)).toHaveValue('todo')
  await expectSavedContent(page)

  expect(problems).toEqual([])
})
