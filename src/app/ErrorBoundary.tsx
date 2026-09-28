import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Global error boundary.
 *
 * Catches errors thrown while rendering its children, logs the details with
 * `console.error`, and replaces the UI with a French error card offering to
 * reload the tool. Data already saved in the browser is not affected by a reload.
 *
 * Note: React error boundaries do not catch errors in event handlers or async
 * code; those are handled by the global listeners installed in `main.tsx`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Rendering error:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div role="alert" className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5" aria-hidden="true" />
              Une erreur est survenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              L’outil a rencontré un problème inattendu. Vos données enregistrées sur ce poste ne
              sont pas perdues.
            </p>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              {error.message || 'Erreur inconnue'}
            </pre>
          </CardContent>
          <CardFooter>
            <Button onClick={this.handleReload}>
              <RotateCcw aria-hidden="true" />
              Recharger l’outil
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
}
