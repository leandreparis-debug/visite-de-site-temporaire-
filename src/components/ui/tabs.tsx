/**
 * shadcn/ui-compatible Tabs without Radix (bundle size): WAI-ARIA tabs pattern
 * with roving tabindex, automatic activation, ←/→/Home/End keys.
 * Controlled only: `value` + `onValueChange`.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  baseId: string
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs(component: string): TabsContextValue {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error(`<${component}> must be used inside <Tabs>`)
  return context
}

const idFor = (baseId: string, kind: 'tab' | 'panel', value: string) => `${baseId}-${kind}-${value}`

function Tabs({
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'defaultValue'> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const baseId = React.useId()
  const context = React.useMemo(
    () => ({ value, onValueChange, baseId }),
    [value, onValueChange, baseId],
  )
  return (
    <TabsContext.Provider value={context}>
      <div data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props} />
    </TabsContext.Provider>
  )
}

function TabsList({ className, onKeyDown, ...props }: React.ComponentProps<'div'>) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    )
    const current = tabs.findIndex((tab) => tab === document.activeElement)
    if (current === -1) return
    const target = {
      ArrowRight: tabs[(current + 1) % tabs.length],
      ArrowLeft: tabs[(current - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[event.key]
    if (!target) return
    event.preventDefault()
    target.focus()
    target.click()
  }
  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  value,
  className,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { value: string }) {
  const tabs = useTabs('TabsTrigger')
  const selected = tabs.value === value
  return (
    <button
      type="button"
      role="tab"
      id={idFor(tabs.baseId, 'tab', value)}
      aria-selected={selected}
      aria-controls={idFor(tabs.baseId, 'panel', value)}
      tabIndex={selected ? 0 : -1}
      data-state={selected ? 'active' : 'inactive'}
      data-slot="tabs-trigger"
      onClick={(event) => {
        onClick?.(event)
        if (!selected) tabs.onValueChange(value)
      }}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

/** Panel of a tab; rendered only when its tab is selected. */
function TabsContent({
  value,
  className,
  ...props
}: React.ComponentProps<'div'> & { value: string }) {
  const tabs = useTabs('TabsContent')
  if (tabs.value !== value) return null
  return (
    <div
      role="tabpanel"
      id={idFor(tabs.baseId, 'panel', value)}
      aria-labelledby={idFor(tabs.baseId, 'tab', value)}
      tabIndex={0}
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
