/**
 * Global Zod configuration. MUST be the first import of `main.tsx`.
 *
 * - `jitless: true`: Zod otherwise probes `new Function(...)` to JIT-compile
 *   object parsers. The build's Content-Security-Policy (no 'unsafe-eval')
 *   blocks it, which logs a CSP violation in the console.
 * - French locale for Zod's built-in error messages.
 *
 * The app uses `zod/mini` (same engine, tree-shakable functional API) to keep
 * the single-file bundle small — see docs/DECISIONS.md.
 */
import { fr } from 'zod/locales'
import * as z from 'zod/mini'

z.config({ jitless: true })
z.config(fr())
