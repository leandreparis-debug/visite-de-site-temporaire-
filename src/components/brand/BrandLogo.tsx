import { cn } from '@/lib/utils'
import { logoSrc } from './logoSource'

export interface BrandLogoProps {
  /** Extra classes applied to the `<img>`. */
  className?: string
  /** Rendered height in pixels; width follows the image ratio. Defaults to 32. */
  height?: number
}

/**
 * Carrefour Property logo.
 *
 * Loads `src/assets/logo/carrefour-property.png` (an `.svg` of the same name takes precedence).
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
