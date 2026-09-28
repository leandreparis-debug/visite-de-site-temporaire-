/**
 * Logo files found in `src/assets/logo/`, resolved at build time.
 * Eager glob = no separate chunk; with `assetsInlineLimit` the file is
 * inlined as a data: URI in the single-file build.
 */
const logoModules = import.meta.glob<string>('../../assets/logo/carrefour-property.{svg,png}', {
  eager: true,
  import: 'default',
})

/** SVG takes precedence over PNG when both files are present. */
export const logoSrc: string | undefined =
  logoModules['../../assets/logo/carrefour-property.svg'] ??
  logoModules['../../assets/logo/carrefour-property.png']
