#!/usr/bin/env node
/**
 * Verifies that the production build is a single, self-contained HTML file.
 *
 * Checks:
 *  1. `dist/` contains exactly one file: `index.html` (no sub-folders).
 *  2. `index.html` has no external reference:
 *     - no `src=` / `href=` pointing to `http(s)://`, `//host` or a relative/absolute file;
 *     - no CSS `url(...)` pointing to a file or a remote URL.
 *     `data:`, `blob:`, `#anchor`, `about:` and `javascript:` values are allowed, as
 *     are XML namespaces such as `http://www.w3.org/…` (inline SVG).
 *  3. Prints the file size in KB.
 *
 * Exits with code 1 and an explicit French message on failure.
 *
 * Usage: `npm run check:single` (after `npm run build`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDir = join(root, 'dist')

/** URL prefixes tolerated inside attributes (XML namespaces only). */
const ALLOWED_URL_PREFIXES = ['http://www.w3.org/', 'https://www.w3.org/']

/** Values that never trigger a request. */
const SAFE_SCHEMES = /^(data:|blob:|#|about:|javascript:|mailto:)/i

/** Looks like a file path: ./x, ../x, /x, or name.ext with a static-asset extension. */
const FILE_LIKE =
  /^(\.{1,2}\/|\/[^/]|[\w@%.-]+\/)|\.(m?js|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|json|map|wasm|html?)(\?|#|$)/i

const REMOTE = /^(https?:)?\/\//i

function fail(messages) {
  console.error('\n✖ Vérification du fichier unique : ÉCHEC')
  for (const message of messages) console.error(`  - ${message}`)
  console.error('')
  process.exit(1)
}

/** Classifies a referenced value; returns a reason string if it is forbidden. */
function forbiddenReason(value) {
  const v = value.trim()
  if (v === '' || SAFE_SCHEMES.test(v)) return null
  if (ALLOWED_URL_PREFIXES.some((prefix) => v.startsWith(prefix))) return null
  if (REMOTE.test(v)) return 'ressource distante'
  if (FILE_LIKE.test(v)) return 'fichier externe'
  return null
}

let entries
try {
  entries = readdirSync(distDir)
} catch {
  fail([`Dossier introuvable : ${distDir}. Lancez d'abord "npm run build".`])
}

const errors = []
if (entries.length !== 1 || entries[0] !== 'index.html') {
  errors.push(
    `dist/ doit contenir exactement un fichier "index.html" ; contenu trouvé : ${
      entries.length ? entries.join(', ') : '(vide)'
    }`,
  )
}

const indexPath = join(distDir, 'index.html')
let html = ''
try {
  if (!statSync(indexPath).isFile()) throw new Error('not a file')
  html = readFileSync(indexPath, 'utf8')
} catch {
  errors.push('dist/index.html est absent ou illisible.')
  fail(errors)
}

// src="…", href='…', src=… (quoted or not). Values built at runtime in the JS
// bundle (e.g. `src="`+x+`"`) do not look like URLs and are ignored.
const attributePattern = /\b(src|href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+))/gi
for (const match of html.matchAll(attributePattern)) {
  const value = match[2] ?? match[3] ?? match[4] ?? ''
  // srcset may list several candidates: "a.png 1x, b.png 2x"
  const candidates =
    match[1].toLowerCase() === 'srcset'
      ? value.split(',').map((c) => c.trim().split(/\s+/)[0])
      : [value]
  for (const candidate of candidates) {
    const reason = forbiddenReason(candidate ?? '')
    if (reason) errors.push(`${match[1]}="${candidate.slice(0, 120)}" → ${reason}`)
  }
}

// CSS url(…) references.
const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi
for (const match of html.matchAll(cssUrlPattern)) {
  const value = match[1] ?? match[2] ?? match[3] ?? ''
  const reason = forbiddenReason(value)
  if (reason) errors.push(`url(${value.slice(0, 120)}) → ${reason}`)
}

if (errors.length > 0) fail(errors)

const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)
console.log(`✔ dist/index.html est autonome (fichier unique, aucune référence externe).`)
console.log(`  Taille : ${sizeKb} Ko`)
