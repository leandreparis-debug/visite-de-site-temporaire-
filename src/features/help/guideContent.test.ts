import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_SECTIONS, guideToMarkdown } from '@/features/help/guideContent'

describe('user guide', () => {
  it('docs/GUIDE_UTILISATEUR.md is generated from the single source (run `npm run guide`)', () => {
    const markdown = readFileSync(
      resolve(import.meta.dirname, '../../../docs/GUIDE_UTILISATEUR.md'),
      'utf8',
    )
    expect(markdown).toBe(guideToMarkdown())
  })

  it('covers the 7 topics, in order', () => {
    expect(GUIDE_SECTIONS.map((s) => s.title)).toEqual([
      '1. Démarrer',
      '2. Pendant et après la visite',
      '3. Suivre un site d’une visite à l’autre',
      '4. DO, assurances, projets et coûts',
      '5. Générer le rapport Word',
      '6. Vos données',
      '7. Raccourcis clavier',
    ])
    const markdown = guideToMarkdown()
    for (const section of GUIDE_SECTIONS) expect(markdown).toContain(`## ${section.title}`)
    expect(markdown).toContain('| Où | Touche | Action |')
  })
})
