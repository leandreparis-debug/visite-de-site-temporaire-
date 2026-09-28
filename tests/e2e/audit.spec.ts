import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createVisit, fillCompleteVisit, indexUrl, tab, watch } from './helpers'

/**
 * Accessibility audit (axe-core) and layout check of every screen of a
 * complete visit, at 1280 and 1024 px wide. `UPDATE_SCREENSHOTS=1` also
 * writes the screenshots versioned in docs/screenshots/.
 *
 * axe-core is a development dependency only: it is injected by Playwright
 * and never part of dist/index.html.
 */
const SCREENSHOTS_DIR = resolve(import.meta.dirname, '../../docs/screenshots')
const WIDTHS = [1280, 1024] as const

const TABS = [
  ['general', 'Informations générales'],
  ['notes', 'Notes'],
  ['photos', 'Photos'],
  ['plan', 'Plan'],
  ['do-insurance', 'DO & assurances'],
  ['projects-costs', 'Projets & coûts'],
  ['report', 'Rapport'],
] as const

interface AxeFinding {
  screen: string
  id: string
  impact: string
  help: string
  targets: string[]
}

async function audit(page: Page, screen: string): Promise<AxeFinding[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      screen,
      id: v.id,
      impact: v.impact ?? '',
      help: v.help,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }))
}

/** No horizontal scrolling of the page (wide tables scroll inside their own box). */
async function expectNoHorizontalOverflow(page: Page, screen: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `${screen}: page wider than the window`).toBeLessThanOrEqual(0)
}

async function capture(page: Page, name: string) {
  if (!process.env.UPDATE_SCREENSHOTS) return
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  await page.screenshot({
    path: resolve(SCREENSHOTS_DIR, `${name}.jpg`),
    type: 'jpeg',
    quality: 70,
    fullPage: true,
  })
}

test('accessibility (axe) and layout of every screen at 1280 and 1024 px', async ({ page }) => {
  test.setTimeout(240_000)
  const problems = watch(page)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(indexUrl)
  await createVisit(page, 'Visite annuelle Lyon', 'Entrepôt Lyon Nord')
  await fillCompleteVisit(page)

  const findings: AxeFinding[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    // Visit list (with its information banner) and help dialog.
    await page.getByRole('link', { name: 'Visites', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Visites' })).toBeVisible()
    await expectNoHorizontalOverflow(page, `liste ${width}`)
    if (width === 1280) findings.push(...(await audit(page, 'liste')))
    await capture(page, `${width}-liste`)
    await page.getByRole('button', { name: 'Aide' }).click()
    await expect(page.getByRole('dialog', { name: /^Aide/ })).toBeVisible()
    if (width === 1280) findings.push(...(await audit(page, 'aide')))
    await capture(page, `${width}-aide`)
    await page.keyboard.press('Escape')

    await page
      .getByRole('list', { name: 'Visites' })
      .getByRole('link', { name: 'Visite annuelle Lyon', exact: true })
      .click()
    for (const [key, label] of TABS) {
      await tab(page, label).click()
      await expect(page).toHaveURL(new RegExp(`/${key}(\\?|$)`))
      await expect(page.getByRole('tabpanel')).toBeVisible()
      if (key === 'plan') await expect(page.getByTestId('plan-image')).toBeVisible()
      await expectNoHorizontalOverflow(page, `${key} ${width}`)
      if (width === 1280) findings.push(...(await audit(page, key)))
      await capture(page, `${width}-${key}`)
    }
  }
  console.log(`[axe] ${findings.length} serious/critical violations`)
  for (const finding of findings) console.log('[axe]', JSON.stringify(finding))
  expect(findings).toEqual([])
  expect(problems).toEqual([])
})
