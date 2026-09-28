import { ErrorBoundary } from '@/app/ErrorBoundary'
import { useRoute } from '@/app/router'
import { AppFooter } from '@/components/layout/AppFooter'
import { AppHeader } from '@/components/layout/AppHeader'
import { Toaster } from '@/components/ui/sonner'
import { VisitEditorPage } from '@/features/visits/VisitEditorPage'
import { VisitListPage } from '@/features/visits/VisitListPage'

/** Application shell: header, routed page, footer. */
export function App() {
  const route = useRoute()
  return (
    <>
      <ErrorBoundary>
        <div className="flex min-h-screen min-w-[1024px] flex-col">
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
            {route.name === 'visit' ? (
              <VisitEditorPage key={route.visitId} visitId={route.visitId} tab={route.tab} />
            ) : (
              <VisitListPage />
            )}
          </main>
          <AppFooter />
        </div>
      </ErrorBoundary>
      {/* Outside the boundary so global error toasts still show if the UI crashed. */}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}
