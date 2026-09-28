import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from '@/components/brand/BrandLogo'

describe('BrandLogo', () => {
  it('has the Carrefour Property alt text and a default height of 32px', () => {
    render(<BrandLogo />)
    const img = screen.getByAltText('Carrefour Property')
    expect(img).toHaveAttribute('height', '32')
    expect(img).toHaveStyle({ height: '32px' })
    expect(img.getAttribute('src')).toBeTruthy()
  })

  it('respects the height prop and forwards className', () => {
    render(<BrandLogo height={48} className="custom-class" />)
    const img = screen.getByAltText('Carrefour Property')
    expect(img).toHaveAttribute('height', '48')
    expect(img).toHaveStyle({ height: '48px' })
    expect(img).toHaveClass('custom-class')
  })
})
