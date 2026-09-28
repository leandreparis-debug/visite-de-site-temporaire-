import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const indexUrl = pathToFileURL(resolve(import.meta.dirname, '../../dist/index.html')).href

function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    const url = request.url()
    if (!/^(file|data|blob):/.test(url)) problems.push(`request: ${url}`)
  })
  return problems
}

async function waitSaved(page: Page) {
  await expect(page.getByRole('status')).toHaveText('Enregistré')
}

const participantNames = (page: Page) => page.getByRole('combobox', { name: /^Nom du participant/ })

test('general info, participants, notes and attention points survive reload and duplication', async ({
  page,
}) => {
  const problems = watch(page)
  await page.goto(indexUrl)

  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Visite annuelle Lyon')
  await create.getByLabel('Nom du site').fill('Entrepôt Lyon Nord')
  await create.getByLabel('Nom du site').press('Enter')
  await expect(page).toHaveURL(/\/general$/)

  // 1. General information.
  await page.getByLabel('Heure de début').fill('09:30')
  await page.getByLabel('Rédacteur').fill('Arnaud Montigny')
  await page
    .getByLabel('Objet')
    .fill('Visite annuelle de la toiture suite aux infiltrations signalées')
  await page.getByLabel('Code site').fill('LYN-01')
  await page.getByLabel('Ville').fill('Lyon')

  // Three participants, keyboard only.
  await page.getByLabel('Nom', { exact: true }).focus()
  const people: [string, string, string][] = [
    ['Jeanne Martin', 'Property Manager', 'Carrefour Property'],
    ['Paul Durand', 'Couvreur', 'Toitures SA'],
    ['Nadia Benali', 'Exploitante', 'Logistique+'],
  ]
  for (const [name, role, company] of people) {
    await page.keyboard.type(name)
    await page.keyboard.press('Tab')
    await page.keyboard.type(role)
    await page.keyboard.press('Tab')
    await page.keyboard.type(company)
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Nom', { exact: true })).toBeFocused()
  }
  await expect(participantNames(page)).toHaveCount(3)
  await page.getByRole('checkbox', { name: 'Présent : Nadia Benali' }).uncheck()
  await expect(page.getByText('2 présents · 1 absent')).toBeVisible()

  // 2. Notes: technical template + two sections.
  await page.getByRole('tab', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Insérer la trame visite technique' }).click()
  await expect(page.getByRole('combobox', { name: /^Titre de la section/ })).toHaveCount(14)
  await page
    .getByRole('textbox', { name: 'Notes : Toiture et étanchéité' })
    .fill('Infiltrations au droit du quai 3\n- chéneau nord bouché\n- 2 lanterneaux fissurés')
  await page.getByRole('textbox', { name: 'Notes : Quais et portes sectionnelles' }).fill('RAS')

  // 3. Two attention points, one done.
  const pointText = page.getByLabel('Point d’attention ou action')
  await pointText.fill('Curer le chéneau nord')
  await page.getByLabel('Priorité', { exact: true }).selectOption('high')
  await pointText.press('Enter')
  await pointText.fill('Remplacer les lanterneaux')
  await pointText.press('Enter')
  await page
    .getByRole('combobox', { name: 'Statut : Remplacer les lanterneaux' })
    .selectOption('done')
  await waitSaved(page)

  // 4. Reload: everything is kept.
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Notes : Toiture et étanchéité' })).toHaveValue(
    'Infiltrations au droit du quai 3\n- chéneau nord bouché\n- 2 lanterneaux fissurés',
  )
  await expect(page.getByText('1 ouvert')).toBeVisible()
  await page.getByRole('tab', { name: 'Informations générales' }).click()
  await expect(page.getByLabel('Rédacteur')).toHaveValue('Arnaud Montigny')
  await expect(page.getByLabel('Heure de début')).toHaveValue('09:30')
  await expect(page.getByLabel('Ville')).toHaveValue('Lyon')
  await expect(participantNames(page)).toHaveCount(3)
  await expect(page.getByText('2 présents · 1 absent')).toBeVisible()

  // 5. Duplicate and check the copy.
  await page.getByRole('button', { name: 'Actions pour « Visite annuelle Lyon »' }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await page
    .getByRole('dialog', { name: 'Dupliquer la visite' })
    .getByRole('button', { name: 'Dupliquer' })
    .click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Copie — Visite annuelle Lyon' }),
  ).toBeVisible()
  await expect(participantNames(page)).toHaveCount(3)
  await expect(page.getByText('0 présent · 3 absents')).toBeVisible()
  for (const name of ['Jeanne Martin', 'Paul Durand', 'Nadia Benali']) {
    await expect(page.getByRole('checkbox', { name: `Présent : ${name}` })).not.toBeChecked()
  }
  await page.getByRole('tab', { name: 'Notes' }).click()
  await expect(page.getByRole('combobox', { name: /^Titre de la section/ })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Insérer la trame visite technique' }),
  ).toBeVisible()
  const points = page.getByRole('textbox', { name: 'Texte du point d’attention' })
  await expect(points).toHaveCount(1)
  await expect(points).toHaveValue('Curer le chéneau nord')

  expect(problems).toEqual([])
})

test('typing fast in a note loses nothing across autosaves', async ({ page }) => {
  const problems = watch(page)
  await page.goto(indexUrl)
  await page.getByRole('button', { name: 'Créer ma première visite' }).click()
  const create = page.getByRole('dialog', { name: 'Nouvelle visite' })
  await create.getByLabel('Titre').fill('Saisie rapide')
  await create.getByLabel('Nom du site').fill('Site')
  await create.getByLabel('Nom du site').press('Enter')
  await page.getByRole('tab', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Ajouter une section' }).click()
  await page.keyboard.type('Toiture')
  await page.keyboard.press('Tab')

  const note = page.getByRole('textbox', { name: 'Notes : Toiture' })
  const text =
    'Première ligne tapée vite. '.repeat(4) +
    '\n- puce une\n- puce deux avec des accents éèàç ' +
    'et une fin '.repeat(4)
  // Types with pauses so that several autosaves happen in the middle of typing.
  for (const chunk of text.match(/.{1,40}/gs) ?? []) {
    await note.pressSequentially(chunk, { delay: 5 })
    await page.waitForTimeout(900)
  }
  await expect(note).toHaveValue(text)
  await waitSaved(page)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Notes : Toiture' })).toHaveValue(text)
  expect(problems).toEqual([])
})
