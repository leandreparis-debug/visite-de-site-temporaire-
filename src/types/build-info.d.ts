/** Constants injected at build time by Vite (`define`, see vite.config.ts). */
declare global {
  /** Version of package.json, e.g. "1.0.0". */
  const __APP_VERSION__: string
  /** Build timestamp (ISO 8601, UTC). */
  const __BUILD_DATE__: string
}

export {}
