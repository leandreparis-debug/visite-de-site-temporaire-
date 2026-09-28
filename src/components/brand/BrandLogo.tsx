import { cn } from '@/lib/utils'

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
const logoSrc =
  logoModules['../../assets/logo/carrefour-property.svg'] ??
  logoModules['../../assets/logo/carrefour-property.png']

export interface BrandLogoProps {
  /** Extra classes applied to the `<img>`. */
  className?: string
  /** Rendered height in pixels; width follows the image ratio. Defaults to 32. */
  height?: number
}

/**
 * Carrefour Property logo.
 *
 * Loads `src/assets/logo/carrefour-property.svg`, or `.png` if no SVG exists.
 * Always exposes `alt="Carrefour Property"` for accessibility and tests.
 *
 * @example <BrandLogo height={40} />
 */
export function BrandLogo({ className, height = 32 }: BrandLogoProps) {
  return (
    <img
      src={logoSrc}
      alt="Carrefour Property"
      height={height}
      style={{ height, width: 'auto' }}
      className={cn('block shrink-0 select-none', className)}
      draggable={false}
    />
  )
}
