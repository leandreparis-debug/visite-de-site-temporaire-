import { describe, expect, it } from 'vitest'
import { readDateTimeOriginal } from '@/features/photos/processing/exif'
import { fixtureBytes } from '@/test/photoFixtures'

const buffer = (name: string) => fixtureBytes(name).buffer

describe('readDateTimeOriginal', () => {
  it('reads the date in little-endian (II) and big-endian (MM) files', () => {
    expect(readDateTimeOriginal(buffer('exif-ii.jpg'))).toBe('2026-09-15T10:42:07')
    expect(readDateTimeOriginal(buffer('exif-mm.jpg'))).toBe('2025-12-31T23:59:58')
    expect(readDateTimeOriginal(buffer('orientation-6.jpg'))).toBe('2026-09-16T08:00:00')
  })

  it('returns null without EXIF or for non-JPEG files', () => {
    expect(readDateTimeOriginal(buffer('paysage-sans-exif.jpg'))).toBeNull()
    expect(readDateTimeOriginal(buffer('transparent.png'))).toBeNull()
    expect(readDateTimeOriginal(buffer('texte-renomme.jpg'))).toBeNull()
  })

  it('never throws on truncated, random or empty buffers', () => {
    const full = fixtureBytes('exif-ii.jpg')
    for (let length = 0; length < 300; length++) {
      const result = readDateTimeOriginal(full.slice(0, length).buffer)
      // Either the date was fully present, or nothing: never a partial value.
      expect([null, '2026-09-15T10:42:07']).toContain(result)
    }
    expect(readDateTimeOriginal(full.slice(0, 40).buffer)).toBeNull()
    let seed = 42
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % 256
    for (let run = 0; run < 50; run++) {
      const bytes = Uint8Array.from({ length: 4096 }, random)
      // Also with a valid JPEG + APP1 Exif header followed by garbage.
      bytes.set([0xff, 0xd8, 0xff, 0xe1, 0x10, 0x00, 0x45, 0x78, 0x69, 0x66, 0, 0], 0)
      expect(() => readDateTimeOriginal(bytes.buffer)).not.toThrow()
    }
    expect(readDateTimeOriginal(new ArrayBuffer(0))).toBeNull()
  })

  it('rejects an invalid date value ("0000:00:00 00:00:00")', () => {
    const bytes = fixtureBytes('exif-ii.jpg')
    const text = new TextDecoder('latin1').decode(bytes)
    const at = text.indexOf('2026:09:15 10:42:07')
    bytes.set(new TextEncoder().encode('0000:00:00 00:00:00'), at)
    expect(readDateTimeOriginal(bytes.buffer)).toBeNull()
  })
})
