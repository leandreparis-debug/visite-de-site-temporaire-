import { ClipboardList } from 'lucide-react'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

/** Application shell: header + centered main area. */
export function App() {
  return (
    <>
      <ErrorBoundary>
        <TooltipProvider>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
              <EmptyState
                icon={ClipboardList}
                title="Aucune visite pour le moment"
                description="La gestion des visites arrive à l'étape suivante."
              />
            </main>
          </div>
        </TooltipProvider>
      </ErrorBoundary>
      {/* Outside the boundary so global error toasts still show if the UI crashed. */}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}
