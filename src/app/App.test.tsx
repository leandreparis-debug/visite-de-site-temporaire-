import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '@/app/App'

describe('App', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
  })

  it('renders the header, the logo and the empty visit list', async () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Comptes rendus de visite' }),
    ).toBeInTheDocument()
    expect(screen.getByAltText('Carrefour Property')).toBeInTheDocument()
    expect(screen.getByText('Outil temporaire — données stockées sur ce poste')).toBeInTheDocument()
    expect(await screen.findByText('Aucune visite pour le moment')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer ma première visite' })).toBeInTheDocument()
  })

  it('shows the visit editor for a #/visits/:id route', async () => {
    window.history.replaceState(null, '', '#/visits/unknown/notes')
    render(<App />)
    expect(await screen.findByText('Visite introuvable')).toBeInTheDocument()
  })
})
