import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppFooter } from '@/components/layout/AppFooter'
import { formatBuildLabel } from '@/lib/buildInfo'
import { formatStorageSize, notifyStorageChange } from '@/lib/db/storage'

const MB = 1024 * 1024

function stubEstimate(estimate: (() => Promise<StorageEstimate>) | undefined) {
  Object.defineProperty(navigator, 'storage', {
    value: estimate ? { estimate } : undefined,
    configurable: true,
  })
}

describe('AppFooter', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'storage')
  })

  it('formats sizes in French units', () => {
    const normalize = (s: string) => s.replace(/\u00a0/g, ' ')
    expect(normalize(formatStorageSize(500))).toBe('500 octets')
    expect(normalize(formatStorageSize(13_002_342))).toBe('12,4 Mo')
    expect(normalize(formatStorageSize(3 * 1024 * MB))).toBe('3 Go')
  })

  it('shows the used space and refreshes after a deletion', async () => {
    const estimate = vi
      .fn<() => Promise<StorageEstimate>>()
      .mockResolvedValueOnce({ usage: 12.4 * MB, quota: 1000 * MB })
      .mockResolvedValue({ usage: 2 * MB, quota: 1000 * MB })
    stubEstimate(estimate)
    render(<AppFooter />)
    expect(await screen.findByText('12,4 Mo utilisés dans ce navigateur')).toBeInTheDocument()
    expect(screen.queryByText(/Espace bientôt plein/)).not.toBeInTheDocument()

    notifyStorageChange()
    expect(await screen.findByText('2 Mo utilisés dans ce navigateur')).toBeInTheDocument()
  })

  it('warns above 80 % of the quota', async () => {
    stubEstimate(() => Promise.resolve({ usage: 850 * MB, quota: 1000 * MB }))
    render(<AppFooter />)
    expect(
      await screen.findByText(
        /Espace bientôt plein — générez les rapports puis supprimez d’anciennes visites/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('contentinfo').firstElementChild).toHaveClass('text-warning')
  })

  it('shows only the version when the storage API is unavailable', async () => {
    stubEstimate(undefined)
    render(<AppFooter />)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByText(/utilisés dans ce navigateur/)).not.toBeInTheDocument()
    expect(screen.getByTestId('app-version')).toHaveTextContent(
      /^v1\.0\.0 — build du \d{2}\/\d{2}\/\d{4}$/,
    )
  })

  it('formats the build label', () => {
    expect(formatBuildLabel('1.0.0', '2026-09-28T08:00:00.000Z')).toBe(
      'v1.0.0 — build du 28/09/2026',
    )
  })
})
