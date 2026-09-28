import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GUIDE_SECTIONS } from '@/features/help/guideContent'
import { HelpButton } from '@/features/help/HelpDialog'

describe('HelpButton', () => {
  it('opens the guide, in collapsible sections, from the same content', async () => {
    const user = userEvent.setup()
    render(<HelpButton />)
    await user.click(screen.getByRole('button', { name: 'Aide' }))
    const dialog = screen.getByRole('dialog', { name: 'Aide — Comptes rendus de visite' })
    const summaries = [...dialog.querySelectorAll('summary')].map((s) => s.textContent)
    expect(summaries).toEqual(GUIDE_SECTIONS.map((s) => s.title))
    const details = dialog.querySelectorAll('details')
    expect(details[0]).toHaveAttribute('open')
    expect(details[1]).not.toHaveAttribute('open')
    // Inline formatting: keys and bold text.
    expect(within(dialog).getAllByText('Nouvelle visite')[0]?.tagName).toBe('KBD')
    expect(within(dialog).getByText('Google Chrome').tagName).toBe('STRONG')
    expect(within(dialog).getAllByRole('table', { hidden: true })).toHaveLength(2)
  })
})
