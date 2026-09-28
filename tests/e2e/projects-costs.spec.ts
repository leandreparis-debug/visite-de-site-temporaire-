import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href
const screenshots = process.env.E2E_SCREENSHOTS

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

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

interface CostInput {
  label: string
  amount: string
  cents: number
  rate: string
  rateBp: number
  category: string
  project: string
  status: string
  supplier?: string
}

const COSTS: CostInput[] = [
  {
    label: 'Devis étanchéité',
    amount: '12 500,50',
    cents: 1_250_050,
    rate: '2000',
    rateBp: 2000,
    category: 'works',
    project: 'Réfection toiture',
    status: 'quote',
    supplier: 'Étanchéité SA',
  },
  {
    label: 'Facture diagnostic',
    amount: '1850',
    cents: 185_000,
    rate: '1000',
    rateBp: 1000,
    category: 'study',
    project: 'Réfection toiture',
    status: 'invoiced',
  },
  {
    label: 'Niveleurs de quai',
    amount: '32 000',
    cents: 3_200_000,
    rate: '2000',
    rateBp: 2000,
    category: 'works',
    project: 'Mise aux normes quais',
    status: 'committed',
  },
  {
    label: 'Signalétique',
    amount: '0,05',
    cents: 5,
    rate: '550',
    rateBp: 550,
    category: 'other',
    project: 'Mise aux normes quais',
    status: 'estimate',
  },
  {
    label: 'Nettoyage chéneaux',
    amount: '980,40',
    cents: 98_040,
    rate: '2000',
    rateBp: 2000,
    category: 'maintenance',
    project: 'Non rattaché',
    status: 'committed',
  },
]

/** Grand total computed independently: VAT rounded half away from zero on each line. */
function expectedTotals() {
  let ht = 0
  let vat = 0
  for (const cost of COSTS) {
    ht += cost.cents
    vat += Math.round((cost.cents * cost.rateBp) / 10_000)
  }
  return { ht, vat, ttc: ht + vat }
}

const euros = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
/** Text with every kind of space collapsed to a regular space. */
const plain = (text: string) => text.replace(/\s+/g, ' ').trim()

async function expectText(locator: Locator, expected: string) {
  await expect
    .poll(async () => plain((await locator.textContent()) ?? ''))
    .toContain(plain(expected))
}

const grandTotal = (page: Page) => page.locator('[data-grand-total]')
const groupHeaders = (page: Page) => page.locator('[data-group-header] button')
const group = (page: Page, label: string) =>
  page.locator('tbody[data-group]').filter({ has: page.getByRole('button', { name: label }) })

async function checkGrandTotal(page: Page) {
  const { ht, vat, ttc } = expectedTotals()
  const row = grandTotal(page)
  await expectText(row, euros(ht))
  await expectText(row, euros(vat))
  await expectText(row, euros(ttc))
}

async function checkProjectLinks(page: Page) {
  for (const cost of COSTS) {
    await expect(
      page.getByLabel(`Projet : ${cost.label}`, { exact: true }).locator('option:checked'),
    ).toHaveText(cost.project)
  }
}

test('projects and costs in file://', async ({ page }) => {
  const problems = watch(page)
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Visite coûts Lyon')
  await create.getByLabel('Nom du site').fill('Entrepôt Lyon Nord')
  await create.getByRole('button', { name: 'Créer la visite' }).click()
  await page.getByRole('tab', { name: /^Projets & coûts/ }).click()
  await expect(page.getByText('Aucun projet connu sur ce site.')).toBeVisible()
  await expect(page.getByText('Aucun coût renseigné.')).toBeVisible()

  // 1. Two projects and five cost lines (various rates and stages, one unassigned).
  const projectForm = page.getByRole('form', { name: 'Ajouter un projet' })
  await projectForm.getByLabel('Nom du projet').fill('Réfection toiture')
  await projectForm.getByLabel('Statut').selectOption('planned')
  await projectForm.getByLabel('Nom du projet').press('Enter')
  await projectForm.getByLabel('Nom du projet').fill('Mise aux normes quais')
  await projectForm.getByLabel('Statut').selectOption('in_progress')
  await projectForm.getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByRole('tab', { name: 'Projets & coûts (2)' })).toBeVisible()

  const costForm = page.getByRole('form', { name: 'Ajouter un coût' })
  for (const cost of COSTS) {
    await costForm.getByLabel('Libellé').fill(cost.label)
    await costForm.getByLabel('Montant HT').fill(cost.amount)
    await costForm.getByLabel('TVA').selectOption(cost.rate)
    await costForm.getByLabel('Catégorie').selectOption(cost.category)
    await costForm.getByLabel('Projet').selectOption({ label: cost.project })
    await costForm.getByLabel('Statut').selectOption(cost.status)
    await costForm.getByLabel('Fournisseur').fill(cost.supplier ?? '')
    await costForm.getByLabel('Libellé').press('Enter')
    await expect(page.getByLabel(`Libellé : ${cost.label}`)).toHaveValue(cost.label)
  }
  await expect(page.locator('tr[data-cost-id]')).toHaveCount(5)

  // 2. Grand total, computed independently.
  await checkGrandTotal(page)
  await expect(groupHeaders(page)).toHaveText([
    /^Mise aux normes quais/,
    /^Réfection toiture/,
    /^Non rattachés/,
  ])
  const banner = page.getByRole('navigation', { name: 'Synthèse projets et coûts' })
  const items = (await banner.getByRole('button').allTextContents()).map(plain)
  expect(items).toEqual(
    [
      '1 projet en cours',
      '5 lignes de coûts',
      `Engagé : ${euros(3_298_040)} HT`,
      `Facturé : ${euros(185_000)} HT`,
    ].map(plain),
  )
  if (screenshots)
    await page.screenshot({ path: `${screenshots}/costs-project.png`, fullPage: true })

  // 3. Group by stage.
  await page.getByRole('radiogroup', { name: 'Grouper par' }).getByText('Statut').click()
  await expect(groupHeaders(page)).toHaveText([/^Estimation/, /^Devis reçu/, /^Engagé/, /^Facturé/])
  await checkGrandTotal(page)
  await page.getByRole('radiogroup', { name: 'Grouper par' }).getByText('Projet').click()

  // 4. Delete a project, keeping its costs: they become unassigned.
  await page.getByRole('button', { name: 'Supprimer le projet Réfection toiture' }).click()
  const dialog = page.getByRole('alertdialog', {
    name: 'Supprimer le projet « Réfection toiture » ?',
  })
  await expectText(dialog, `Ce projet a 2 lignes de coûts (${euros(1_435_050)} HT).`)
  await dialog.getByRole('button', { name: 'Conserver les coûts (non rattachés)' }).click()
  await expect(groupHeaders(page)).toHaveText([/^Mise aux normes quais/, /^Non rattachés/])
  await expect(group(page, 'Non rattachés').locator('tr[data-cost-id]')).toHaveCount(3)
  await checkGrandTotal(page)

  // 5. Undo.
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(groupHeaders(page)).toHaveText([
    /^Mise aux normes quais/,
    /^Réfection toiture/,
    /^Non rattachés/,
  ])
  await expect(group(page, 'Réfection toiture').locator('tr[data-cost-id]')).toHaveCount(2)
  await checkProjectLinks(page)

  // 6. Copy for Excel, read back the clipboard.
  await page.getByRole('button', { name: 'Copier pour Excel' }).click()
  await expect(page.getByText('Tableau copié — collez-le dans Excel (Ctrl+V)')).toBeVisible()
  const tsv = await page.evaluate(() => navigator.clipboard.readText())
  const rows = tsv.split(/\r?\n/)
  expect(rows).toEqual([
    'Projet\tLibellé\tCatégorie\tFournisseur\tStatut\tMontant HT\tTaux TVA\tTVA\tTTC\tCommentaire',
    'Mise aux normes quais\tNiveleurs de quai\tTravaux\t\tEngagé\t32000,00\t20\t6400,00\t38400,00\t',
    'Mise aux normes quais\tSignalétique\tAutre\t\tEstimation\t0,05\t5,5\t0,00\t0,05\t',
    'Réfection toiture\tDevis étanchéité\tTravaux\tÉtanchéité SA\tDevis reçu\t12500,50\t20\t2500,10\t15000,60\t',
    'Réfection toiture\tFacture diagnostic\tÉtude\t\tFacturé\t1850,00\t10\t185,00\t2035,00\t',
    '\tNettoyage chéneaux\tMaintenance\t\tEngagé\t980,40\t20\t196,08\t1176,48\t',
  ])
  await expect(page.getByRole('status')).toHaveText('Enregistré')

  // 7. Reload: everything is kept.
  await page.reload()
  await expect(page.locator('tr[data-cost-id]')).toHaveCount(5)
  await checkGrandTotal(page)
  await checkProjectLinks(page)

  // 8. Duplicate: projects, costs and links follow on the copy.
  await page.getByRole('button', { name: 'Actions pour « Visite coûts Lyon »' }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await page
    .getByRole('dialog', { name: 'Dupliquer la visite' })
    .getByRole('button', { name: 'Dupliquer' })
    .click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Copie — Visite coûts Lyon' }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /^Projets & coûts/ }).click()
  await expect(page.getByRole('tab', { name: 'Projets & coûts (2)' })).toBeVisible()
  await expect(page.locator('tr[data-cost-id]')).toHaveCount(5)
  await checkGrandTotal(page)
  await checkProjectLinks(page)

  expect(problems).toEqual([])
})
