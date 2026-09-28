import type { ComponentProps } from 'react'
import { routeToHash, type Route } from '@/app/router'

export type LinkProps = Omit<ComponentProps<'a'>, 'href'> & { to: Route }

/** Real `<a href="#/…">` for a typed route (keyboard, middle-click, copy link all work). */
export function Link({ to, ...props }: LinkProps) {
  return <a href={routeToHash(to)} {...props} />
}
