import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

describe('App', () => {
  it('renders the header title, the logo and the empty state', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Comptes rendus de visite' }),
    ).toBeInTheDocument()
    expect(screen.getByAltText('Carrefour Property')).toBeInTheDocument()
    expect(screen.getByText('Outil temporaire — données stockées sur ce poste')).toBeInTheDocument()
    expect(screen.getByText('Aucune visite pour le moment')).toBeInTheDocument()
    expect(
      screen.getByText("La gestion des visites arrive à l'étape suivante."),
    ).toBeInTheDocument()
  })
})
