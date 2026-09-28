/**
 * Shared e2e helpers: problem watcher (console errors, network, workers) and
 * a complete visit filled through the interface, like a Property Manager.
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, type Page } from '@playwright/test'

export const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href
export const photoFixture = (name: string) =>
  resolve(import.meta.dirname, '../fixtures/photos', name)
export const planFixture = (name: string) => resolve(import.meta.dirname, '../fixtures/plans', name)

/** Collects console errors, page errors, non-local requests and workers. */
export function watch(page: Page, ignore: RegExp[] = []) {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !ignore.some((re) => re.test(message.text())))
      problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    if (!/^(file|data|blob):/.test(request.url())) problems.push(`request: ${request.url()}`)
  })
  page.on('worker', (worker) => problems.push(`worker: ${worker.url()}`))
  return problems
}

/** Local date `YYYY-MM-DD`, `days` from today. */
export function isoInDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Tab whose name starts with `name` (e.g. "Photos" matches "Photos (5)"). */
export const tab = (page: Page, name: string) =>
  page.getByRole('tab', {
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  })

/** Creates a visit from the list (first one or not) and lands on its editor. */
export async function createVisit(page: Page, title: string, siteName: string) {
  const first = page.getByRole('button', { name: 'Créer ma première visite' })
  if (await first.isVisible()) await first.click()
  else await page.getByRole('button', { name: 'Nouvelle visite' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await dialog.getByLabel('Titre').fill(title)
  await dialog.getByLabel('Nom du site').fill(siteName)
  await dialog.getByRole('button', { name: 'Créer la visite' }).click()
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
}

export const PHOTO_FILES = [
  'exif-mm.jpg',
  'exif-ii.jpg',
  'orientation-6.jpg',
  'paysage-sans-exif.jpg',
  'transparent.png',
]
export const CAPTIONS = [
  'Vue générale de la toiture',
  'Chéneau nord bouché',
  'Descente d’eau pluviale fissurée',
  'Quai 3 : niveleur hors service',
]

/**
 * Fills every tab of the current visit: general information (3 participants,
 * 1 absent), 2 note sections with bullets, 2 attention points (1 overdue),
 * 5 photos (4 captions), 1 PDF plan with 3 pins, 1 contract, 1 DO claim
 * declared 70 days ago, 2 projects and 4 costs.
 */
export async function fillCompleteVisit(page: Page) {
  // General information.
  await tab(page, 'Informations générales').click()
  await page.getByLabel('Heure de début').fill('09:30')
  await page.getByLabel('Rédacteur').fill('Arnaud Montigny')
  await page.getByLabel('Objet').fill('Visite annuelle de la toiture et des quais')
  await page.getByLabel('Code site').fill('LYN-01')
  await page.getByLabel('Ville').fill('Lyon')
  await page.getByLabel('Nom', { exact: true }).focus()
  for (const [name, role, company] of [
    ['Jeanne Martin', 'Property Manager', 'Carrefour Property'],
    ['Paul Durand', 'Couvreur', 'Toitures SA'],
    ['Nadia Benali', 'Exploitante', 'Logistique+'],
  ] as const) {
    await page.keyboard.type(name)
    await page.keyboard.press('Tab')
    await page.keyboard.type(role)
    await page.keyboard.press('Tab')
    await page.keyboard.type(company)
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Nom', { exact: true })).toBeFocused()
  }
  await page.getByRole('checkbox', { name: 'Présent : Nadia Benali' }).uncheck()

  // Notes: 2 sections with bullets, 2 attention points.
  await tab(page, 'Notes').click()
  for (const [index, [title, content]] of [
    ['Toiture', 'Infiltrations constatées :\n- cellule 3\n- chéneau nord\n\nDevis demandé.'],
    ['Quais', 'Niveleurs :\n- quai 3 hors service\n- quai 7 bruyant'],
  ].entries()) {
    await page.getByRole('button', { name: 'Ajouter une section' }).click()
    await page.getByRole('combobox', { name: `Titre de la section ${index + 1}` }).fill(title ?? '')
    await page.getByRole('textbox', { name: `Notes : ${title}` }).fill(content ?? '')
  }
  const pointText = page.getByLabel('Point d’attention ou action')
  await pointText.fill('Remplacer les lanterneaux')
  await page.getByLabel('Échéance', { exact: true }).fill(isoInDays(-5))
  await pointText.press('Enter')
  await pointText.fill('Faire nettoyer les chéneaux')
  await pointText.press('Enter')

  // Photos: 5 files, 4 captions.
  await tab(page, 'Photos').click()
  await page.getByTestId('photo-input').setInputFiles(PHOTO_FILES.map((name) => photoFixture(name)))
  await expect(tab(page, 'Photos (5)')).toBeVisible({ timeout: 30_000 })
  for (const [index, caption] of CAPTIONS.entries()) {
    const field = page.getByRole('textbox', { name: `Légende de la photo ${index + 1}` })
    await field.fill(caption)
    await field.blur()
  }
  await page.getByRole('combobox', { name: 'Catégorie de la photo 2' }).selectOption('defect')

  // Plan: PDF page 1, 3 pins placed in click mode.
  await tab(page, 'Plan').click()
  await page.getByRole('button', { name: /Importez le plan/ }).click()
  await page.getByTestId('plan-input').setInputFiles(planFixture('entrepot-2-pages.pdf'))
  await page.getByRole('button', { name: 'Importer le plan' }).click()
  await expect(page.getByTestId('plan-image')).toBeVisible({ timeout: 30_000 })
  const canvas = page.getByTestId('plan-canvas')
  const panel = page.getByRole('list', { name: 'Photos à placer' })
  for (const [n, position] of [
    [1, { x: 300, y: 250 }],
    [2, { x: 450, y: 300 }],
    [3, { x: 600, y: 220 }],
  ] as const) {
    await panel.getByRole('button').first().click()
    await canvas.click({ position })
    await expect(page.getByText(`Repère n°${n} ajouté`)).toBeVisible()
  }

  // DO & insurances: 1 contract, 1 claim declared 70 days ago.
  await tab(page, 'DO & assurances').click()
  const contract = page.getByRole('form', { name: 'Ajouter un contrat' })
  await contract.getByLabel('Type').selectOption('dommages_ouvrage')
  await contract.getByLabel('Assureur').fill('Assureur DO SA')
  await contract.getByLabel('Date de fin').fill(isoInDays(30))
  await contract.getByLabel('Assureur').press('Enter')
  await page.getByRole('button', { name: 'Déclarer un sinistre' }).click()
  const declare = page.getByRole('dialog', { name: 'Déclarer un sinistre DO' })
  await declare.getByLabel('Description du sinistre').fill('Infiltrations en toiture, cellule 3')
  await declare.getByLabel('Référence').fill('DO-2026-014')
  await declare.getByLabel('Date de déclaration').fill(isoInDays(-70))
  await declare.getByRole('button', { name: 'Déclarer' }).click()
  await expect(declare).toBeHidden()
  const claim = page.getByRole('article', { name: 'DO-2026-014' })
  await claim.getByLabel('Montant réclamé').fill('12 500,50')
  await claim.getByLabel('Montant réclamé').blur()

  // Projects & costs: 2 projects, 4 costs.
  await tab(page, 'Projets & coûts').click()
  const projectForm = page.getByRole('form', { name: 'Ajouter un projet' })
  for (const [name, status] of [
    ['Réfection toiture', 'planned'],
    ['Mise aux normes quais', 'in_progress'],
  ] as const) {
    await projectForm.getByLabel('Nom du projet').fill(name)
    await projectForm.getByLabel('Statut').selectOption(status)
    await projectForm.getByLabel('Nom du projet').press('Enter')
  }
  const costForm = page.getByRole('form', { name: 'Ajouter un coût' })
  for (const [label, amount, project, status] of [
    ['Devis étanchéité', '12 500,50', 'Réfection toiture', 'quote'],
    ['Diagnostic toiture', '1850', 'Réfection toiture', 'invoiced'],
    ['Niveleurs de quai', '32 000', 'Mise aux normes quais', 'committed'],
    ['Nettoyage chéneaux', '980,40', 'Non rattaché', 'committed'],
  ] as const) {
    await costForm.getByLabel('Libellé').fill(label)
    await costForm.getByLabel('Montant HT').fill(amount)
    await costForm.getByLabel('Projet').selectOption({ label: project })
    await costForm.getByLabel('Statut').selectOption(status)
    await costForm.getByLabel('Libellé').press('Enter')
    await expect(page.getByLabel(`Libellé : ${label}`)).toHaveValue(label)
  }
  await expect(page.getByText('Modifications en cours…')).toHaveCount(0, { timeout: 5000 })
}
