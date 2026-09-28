/**
 * Writes the user guide in Markdown from its single source
 * (src/features/help/guideContent.ts, also shown by the in-app help).
 *
 * Usage: node scripts/generate-guide.ts [output path]
 * Default output: docs/GUIDE_UTILISATEUR.md
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { guideToMarkdown } from '../src/features/help/guideContent.ts'

const output = resolve(import.meta.dirname, '..', process.argv[2] ?? 'docs/GUIDE_UTILISATEUR.md')
writeFileSync(output, guideToMarkdown())
console.log(`✔ Guide utilisateur écrit : ${output}`)
