import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href

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

const visitTitle = (page: Page, name: string) => page.getByRole('heading', { level: 2, name })
const cardLink = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Visites' }).getByRole('link', { name, exact: true })

test('full visit management flow in file://', async ({ page }) => {
  const problems = watch(page)
  await page.goto(indexUrl)

  // 1. Create a visit.
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await dialog.getByLabel('Titre').fill('Visite Entrepôt Lyon')
  await dialog.getByLabel('Nom du site').fill('Entrepôt Lyon Nord')
  await dialog.getByRole('button', { name: 'Créer la visite' }).click()
  await expect(page).toHaveURL(/#\/visits\/[\w-]+\/general$/)
  await expect(visitTitle(page, 'Visite Entrepôt Lyon')).toBeVisible()
  const visitUrl = page.url()

  // 2. It appears in the list (search without accents).
  await page.getByRole('link', { name: 'Visites', exact: true }).click()
  await expect(page).toHaveURL(/#\/$/)
  await page.getByRole('searchbox').fill('entrepot')
  await expect(cardLink(page, 'Visite Entrepôt Lyon')).toBeVisible()

  // 3. Open it and rename it.
  await cardLink(page, 'Visite Entrepôt Lyon').click()
  await expect(page).toHaveURL(visitUrl)
  await page.getByRole('button', { name: 'Visite Entrepôt Lyon', exact: true }).click()
  const titleInput = page.getByRole('textbox', { name: 'Titre de la visite' })
  await titleInput.fill('Visite Lyon — bilan')
  await titleInput.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Enregistré')

  // 4. Reload: same visit, new title.
  await page.reload()
  await expect(page).toHaveURL(visitUrl)
  await expect(visitTitle(page, 'Visite Lyon — bilan')).toBeVisible()

  // 5. Change tab, reload: the tab is kept.
  await page.getByRole('tab', { name: 'Notes' }).click()
  await expect(page).toHaveURL(/\/notes$/)
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('Bientôt disponible')

  // 6. Duplicate.
  await page.getByRole('button', { name: 'Actions pour « Visite Lyon — bilan »' }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  const duplicate = page.getByRole('dialog', { name: 'Dupliquer la visite' })
  await expect(duplicate).toContainText('Participants (marqués absents)')
  await duplicate.getByRole('button', { name: 'Dupliquer' }).click()
  await expect(visitTitle(page, 'Copie — Visite Lyon — bilan')).toBeVisible()
  await expect(page).not.toHaveURL(visitUrl)

  // 7. Delete the original from the list.
  await page.getByRole('link', { name: 'Visites', exact: true }).click()
  await expect(cardLink(page, 'Copie — Visite Lyon — bilan')).toBeVisible()
  await page.getByRole('button', { name: 'Actions pour « Visite Lyon — bilan »' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Supprimer la visite ?' })
  await expect(confirm).toContainText('Cette action est définitive.')
  await confirm.getByRole('button', { name: 'Supprimer' }).click()

  // 8. Final list: only the copy.
  await expect(cardLink(page, 'Visite Lyon — bilan')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Visites' }).getByRole('listitem')).toHaveCount(1)
  await expect(cardLink(page, 'Copie — Visite Lyon — bilan')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('list', { name: 'Visites' }).getByRole('listitem')).toHaveCount(1)

  expect(problems).toEqual([])
})

test('a change is saved when leaving right away (no wait for autosave)', async ({ page }) => {
  const problems = watch(page)
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Nouvelle visite' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await dialog.getByLabel('Titre').fill('Réunion')
  await dialog.getByLabel('Nom du site').fill('Site')
  await dialog.getByLabel('Nom du site').press('Enter')
  await expect(visitTitle(page, 'Réunion')).toBeVisible()

  await page.getByRole('button', { name: 'Réunion', exact: true }).click()
  await page.getByRole('textbox', { name: 'Titre de la visite' }).fill('Réunion modifiée')
  await page.getByRole('textbox', { name: 'Titre de la visite' }).press('Enter')
  // Leave immediately, before the 800 ms debounce.
  await page.getByRole('link', { name: 'Visites', exact: true }).click()
  await expect(cardLink(page, 'Réunion modifiée')).toBeVisible()
  await page.reload()
  await expect(cardLink(page, 'Réunion modifiée')).toBeVisible()

  // Keyboard-only: the menu opens with Enter and moves with arrows.
  await page.getByRole('button', { name: 'Actions pour « Réunion modifiée »' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Ouvrir' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Dupliquer' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem')).toHaveCount(0)

  expect(problems).toEqual([])
})
