import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import type { Visit } from '@/types/visit'
import { seedVisit } from './seed'

/** Seeds a visit and opens the editor on a tab (whole app, as in real use). */
export async function renderEditor(tab: string, overrides: Partial<Visit> = {}) {
  const visit = await seedVisit(
    { title: 'Visite Lyon', siteName: 'Entrepôt Lyon', updatedAt: '2026-09-20T10:00:00.000Z' },
    overrides,
  )
  window.history.replaceState(null, '', `#/visits/${visit.id}/${tab}`)
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { level: 2, name: visit.title })
  return { visit, user }
}
