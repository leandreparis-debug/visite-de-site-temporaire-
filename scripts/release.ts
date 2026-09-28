/**
 * Builds the distributable V1 package in release/:
 *   1. every check: typecheck, lint, unit tests, build, check:single, e2e;
 *   2. release/CR-Visites-Carrefour-Property-v<version>.html (the single file);
 *   3. release/GUIDE_UTILISATEUR.md (from the guide's single source);
 *   4. release/LISEZMOI.txt (10 lines at most: how to open, which browser, help).
 *
 * Usage: npm run release
 */
import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { guideToMarkdown } from '../src/features/help/guideContent.ts'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string
}
const htmlName = `CR-Visites-Carrefour-Property-v${version}.html`

function run(command: string) {
  console.log(`\n▶ ${command}`)
  execSync(command, { cwd: root, stdio: 'inherit' })
}

// 1. Checks: any failure stops the release.
run('npm run typecheck')
run('npm run lint')
run('npm run test')
run('npm run build')
run('npm run check:single')
run('npx playwright test')

// 2-4. Package.
const out = resolve(root, 'release')
rmSync(out, { recursive: true, force: true })
mkdirSync(out)
copyFileSync(resolve(root, 'dist/index.html'), resolve(out, htmlName))
writeFileSync(resolve(out, 'GUIDE_UTILISATEUR.md'), guideToMarkdown())
const readme = [
  `Comptes rendus de visite — Carrefour Property — version ${version}`,
  `1. Double-cliquez sur ${htmlName} : l'outil s'ouvre dans le navigateur, sans Internet ni installation.`,
  '2. Utilisez Google Chrome ou Microsoft Edge, et toujours le même navigateur sur ce poste.',
  "   Si le fichier s'ouvre dans un autre programme : clic droit > Ouvrir avec > Chrome ou Edge.",
  "3. Aide : bouton « Aide » en haut à droite de l'outil (même contenu que GUIDE_UTILISATEUR.md).",
  '4. Vos visites restent dans le navigateur de ce poste : générez le rapport Word (onglet Rapport) pour les conserver.',
  "5. Nouvelle version : remplacez l'ancien fichier HTML par le nouveau, vos visites sont conservées.",
]
// UTF-8 BOM and CRLF: read correctly by the Windows Notepad.
writeFileSync(resolve(out, 'LISEZMOI.txt'), `\uFEFF${readme.join('\r\n')}\r\n`)

const size = (readFileSync(resolve(out, htmlName)).length / 1024 / 1024).toFixed(2)
console.log(`\n✔ Version ${version} prête dans release/ :`)
console.log(`  ${htmlName} (${size} Mo)`)
console.log('  GUIDE_UTILISATEUR.md')
console.log('  LISEZMOI.txt')
