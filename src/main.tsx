// Must stay the first import: configures Zod before any schema is created (CSP).
import '@/lib/zod-setup'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { installGlobalErrorHandlers } from '@/app/globalErrorHandlers'
import { initStorage } from '@/app/initStorage'
import '@/styles/globals.css'

installGlobalErrorHandlers()
// Persistent storage request + IndexedDB check; never blocks rendering.
void initStorage()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Élément #root introuvable dans index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
