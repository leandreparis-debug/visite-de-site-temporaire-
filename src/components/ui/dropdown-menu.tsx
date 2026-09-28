/**
 * shadcn/ui-compatible DropdownMenu built on the native Popover API.
 *
 * Why not Radix: bundle size (Radix ships a positioning engine). Chrome/Edge
 * natively provide the top layer, light dismiss, Escape and trigger toggling
 * (`popovertarget`); placement uses CSS anchor positioning.
 * Keyboard: ↑/↓/Home/End move between items, Enter/Space select, Escape or
 * Tab close, focus returns to the trigger.
 */
import { Slot } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface MenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  menuId: string
  triggerId: string
  anchorName: string
}

const MenuContext = React.createContext<MenuContextValue | null>(null)

function useMenu(component: string): MenuContextValue {
  const context = React.useContext(MenuContext)
  if (!context) throw new Error(`<${component}> must be used inside <DropdownMenu>`)
  return context
}

/** Kept for API compatibility with shadcn (the native popover is never modal). */
function DropdownMenu({ children }: { children?: React.ReactNode; modal?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  const context = React.useMemo(
    () => ({
      open,
      setOpen,
      menuId: `${id}-menu`,
      triggerId: `${id}-trigger`,
      anchorName: `--menu-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    }),
    [open, id],
  )
  return <MenuContext.Provider value={context}>{children}</MenuContext.Provider>
}

function DropdownMenuTrigger({
  asChild,
  style,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const menu = useMenu('DropdownMenuTrigger')
  const Component = asChild ? Slot.Root : 'button'
  return (
    <Component
      id={menu.triggerId}
      type="button"
      popoverTarget={menu.menuId}
      aria-haspopup="menu"
      aria-expanded={menu.open}
      aria-controls={menu.open ? menu.menuId : undefined}
      data-state={menu.open ? 'open' : 'closed'}
      style={{ ...style, anchorName: menu.anchorName }}
      {...props}
    />
  )
}

function menuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'))
}

function DropdownMenuContent({
  className,
  align = 'start',
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & { align?: 'start' | 'end' }) {
  const menu = useMenu('DropdownMenuContent')
  const ref = React.useRef<HTMLDivElement>(null)
  const { setOpen, triggerId } = menu

  // Sync React state with the native popover (opened by the trigger, closed by
  // light dismiss, Escape or an item).
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const onToggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === 'open'
      setOpen(open)
      if (
        !open &&
        (element.contains(document.activeElement) || document.activeElement === document.body)
      ) {
        document.getElementById(triggerId)?.focus()
      }
    }
    element.addEventListener('toggle', onToggle)
    return () => {
      element.removeEventListener('toggle', onToggle)
    }
  }, [setOpen, triggerId])

  // Focus the first item once the items are rendered.
  React.useEffect(() => {
    if (menu.open && ref.current) menuItems(ref.current)[0]?.focus()
  }, [menu.open])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(event.currentTarget)
    const index = items.findIndex((item) => item === document.activeElement)
    const target = {
      ArrowDown: items[(index + 1) % items.length],
      ArrowUp: items[(index - 1 + items.length) % items.length],
      Home: items[0],
      End: items[items.length - 1],
    }[event.key]
    if (target) {
      event.preventDefault()
      target.focus()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      event.currentTarget.hidePopover()
    }
  }

  return (
    <div
      ref={ref}
      id={menu.menuId}
      popover="auto"
      role="menu"
      aria-labelledby={menu.triggerId}
      data-slot="dropdown-menu-content"
      data-state={menu.open ? 'open' : 'closed'}
      onKeyDown={onKeyDown}
      style={{
        positionAnchor: menu.anchorName,
        inset: 'auto',
        top: 'anchor(bottom)',
        ...(align === 'end' ? { right: 'anchor(right)' } : { left: 'anchor(left)' }),
        margin: '4px 0 0 0',
        positionTryFallbacks: 'flip-block',
        ...style,
      }}
      className={cn(
        'min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md open:animate-in open:fade-in-0 open:zoom-in-95',
        className,
      )}
      {...props}
    >
      {menu.open && children}
    </div>
  )
}

function DropdownMenuItem({
  className,
  variant = 'default',
  onSelect,
  onClick,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'default' | 'destructive'
  /** Called when the item is chosen (click, Enter, Space); the menu then closes. */
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      onClick={(event) => {
        onClick?.(event)
        event.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover()
        onSelect?.()
      }}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="separator"
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
