import { BrandLogo } from '@/components/brand/BrandLogo'
import { Separator } from '@/components/ui/separator'
import { HelpButton } from '@/features/help/HelpDialog'

/** Sticky application header: logo, title, local-storage notice and help. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <BrandLogo height={32} />
        <Separator orientation="vertical" className="h-8!" />
        <div className="min-w-0">
          <h1 className="truncate text-base leading-tight font-semibold">
            Comptes rendus de visite
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Outil temporaire — données stockées sur ce poste
          </p>
        </div>
        <HelpButton />
      </div>
    </header>
  )
}
