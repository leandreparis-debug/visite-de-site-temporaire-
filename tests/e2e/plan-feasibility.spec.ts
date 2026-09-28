import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const root = resolve(import.meta.dirname, '../..')

test.beforeAll(() => {
  execFileSync(
    'npx',
    ['vite', 'build', '--config', 'vite.probe.config.ts', '--logLevel', 'error'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
})

test('pdf.js renders page 1 in the main thread, in file://, under the CSP', async ({ page }) => {
  expect(readdirSync(resolve(root, 'dist-probe'))).toEqual(['pdf-probe.html'])
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) problems.push(`request: ${r.url()}`)
  })
  page.on('worker', (w) => problems.push(`worker created: ${w.url()}`))

  await page.goto(pathToFileURL(resolve(root, 'dist-probe/pdf-probe.html')).href)
  await page
    .locator('#file')
    .setInputFiles(resolve(root, 'tests/fixtures/plans/entrepot-2-pages.pdf'))
  await expect(page.locator('#result')).toContainText('"ok"', { timeout: 30_000 })
  const result = JSON.parse((await page.locator('#result').textContent()) ?? '{}') as {
    ok: boolean
    width: number
    height: number
    pageCount: number
    ms: number
    error?: string
  }
  console.log('[feasibility]', JSON.stringify(result))
  expect(result.error).toBeUndefined()
  expect(result).toMatchObject({ ok: true, pageCount: 2, width: 4096 })
  expect(result.height).toBeGreaterThan(2800)
  // The rendered image really shows the plan (not blank): sample dark pixels.
  const darkRatio = await page.locator('#output').evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data
    let dark = 0
    for (let i = 0; i < data.length; i += 4 * 97) if ((data[i] ?? 255) < 100) dark++
    return dark / (data.length / (4 * 97))
  })
  expect(darkRatio).toBeGreaterThan(0.001)
  expect(problems).toEqual([])
})
