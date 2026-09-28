import * as z from 'zod/mini'
import { describe, expect, it } from 'vitest'
import '@/lib/zod-setup'

describe('zod-setup', () => {
  it('disables JIT (CSP forbids eval) and uses French messages', () => {
    expect(z.config().jitless).toBe(true)
    const result = z.safeParse(z.string(), 42)
    expect(result.error?.issues[0]?.message).toMatch(/^Entrée invalide/)
  })
})
