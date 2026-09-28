#!/usr/bin/env node
/**
 * Generates the photo test files in tests/fixtures/photos/ (each < 50 KB).
 *
 * Images are drawn and encoded by Chromium (Playwright, already a dev
 * dependency); EXIF segments are then written byte by byte, so no image
 * library is needed. Run: `node scripts/make-photo-fixtures.mjs`
 * (set PW_CHROMIUM_PATH to use an already installed Chrome/Chromium).
 */
/* global OffscreenCanvas -- used in code evaluated by the browser */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const outDir = resolve(fileURLToPath(new URL('../tests/fixtures/photos', import.meta.url)))
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })
const page = await browser.newPage()

/** Draws a simple scene and returns the encoded bytes. */
async function drawImage({ width, height, type, quality, transparent = false, label }) {
  const base64 = await page.evaluate(
    async ({ width, height, type, quality, transparent, label }) => {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      if (!transparent) {
        const gradient = ctx.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, '#7fb2e5')
        gradient.addColorStop(1, '#e9f1f9')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      }
      // A "building" and a marker on its left, to see the orientation.
      ctx.fillStyle = '#8a6d4b'
      ctx.fillRect(width * 0.15, height * 0.45, width * 0.7, height * 0.45)
      ctx.fillStyle = '#e1000f'
      ctx.beginPath()
      ctx.arc(width * 0.12, height * 0.2, Math.min(width, height) * 0.08, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#004e9f'
      ctx.font = `bold ${Math.round(height / 8)}px sans-serif`
      ctx.fillText(label, width * 0.2, height * 0.35)
      const blob = await canvas.convertToBlob({ type, quality })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    { width, height, type, quality, transparent, label },
  )
  return Buffer.from(base64, 'base64')
}

/**
 * Builds an APP1 "Exif" segment with IFD0 (optional Orientation) → ExifIFD
 * → DateTimeOriginal, in little-endian ("II") or big-endian ("MM") order.
 */
function exifSegment({ order, date, orientation }) {
  const little = order === 'II'
  const entries0 = orientation ? 2 : 1
  const ifd0 = 8
  const exifIfd = ifd0 + 2 + entries0 * 12 + 4
  const dateOffset = exifIfd + 2 + 12 + 4
  const tiff = Buffer.alloc(dateOffset + 20)
  const u16 = (value, at) =>
    little ? tiff.writeUInt16LE(value, at) : tiff.writeUInt16BE(value, at)
  const u32 = (value, at) =>
    little ? tiff.writeUInt32LE(value, at) : tiff.writeUInt32BE(value, at)
  tiff.write(order, 0, 'latin1')
  u16(42, 2)
  u32(ifd0, 4)
  u16(entries0, ifd0)
  let entry = ifd0 + 2
  if (orientation) {
    // Orientation (0x0112), SHORT, count 1, value left-aligned in the 4 bytes.
    u16(0x0112, entry)
    u16(3, entry + 2)
    u32(1, entry + 4)
    u16(orientation, entry + 8)
    entry += 12
  }
  // ExifIFD pointer (0x8769), LONG.
  u16(0x8769, entry)
  u16(4, entry + 2)
  u32(1, entry + 4)
  u32(exifIfd, entry + 8)
  u32(0, entry + 12) // next IFD: none
  // ExifIFD: DateTimeOriginal (0x9003), ASCII, 20 bytes, stored at dateOffset.
  u16(1, exifIfd)
  u16(0x9003, exifIfd + 2)
  u16(2, exifIfd + 4)
  u32(20, exifIfd + 6)
  u32(dateOffset, exifIfd + 10)
  u32(0, exifIfd + 14)
  tiff.write(`${date}\0`, dateOffset, 'latin1')

  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const header = Buffer.alloc(4)
  header.writeUInt16BE(0xffe1, 0)
  header.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([header, payload])
}

/** Inserts an APP1 segment right after the JPEG SOI marker. */
function withExif(jpeg, segment) {
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)])
}

const files = {
  // Larger than 2000 px: must be downscaled.
  'paysage-sans-exif.jpg': await drawImage({
    width: 2400,
    height: 1600,
    type: 'image/jpeg',
    quality: 0.5,
    label: 'Paysage',
  }),
  'exif-ii.jpg': withExif(
    await drawImage({
      width: 800,
      height: 600,
      type: 'image/jpeg',
      quality: 0.7,
      label: 'EXIF II',
    }),
    exifSegment({ order: 'II', date: '2026:09:15 10:42:07' }),
  ),
  'exif-mm.jpg': withExif(
    await drawImage({
      width: 800,
      height: 600,
      type: 'image/jpeg',
      quality: 0.7,
      label: 'EXIF MM',
    }),
    exifSegment({ order: 'MM', date: '2025:12:31 23:59:58' }),
  ),
  // Stored landscape (640×480) with Orientation = 6 (rotate 90° CW): portrait on screen.
  'orientation-6.jpg': withExif(
    await drawImage({
      width: 640,
      height: 480,
      type: 'image/jpeg',
      quality: 0.7,
      label: 'Orient 6',
    }),
    exifSegment({ order: 'II', date: '2026:09:16 08:00:00', orientation: 6 }),
  ),
  'transparent.png': await drawImage({
    width: 400,
    height: 300,
    type: 'image/png',
    transparent: true,
    label: 'PNG',
  }),
  // Not a real HEIC: rejected by type/extension before any decoding.
  'iphone.heic': Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from('ftypheic\0\0\0\0mif1heic', 'latin1'),
  ]),
  'texte-renomme.jpg': Buffer.from('Ceci est un fichier texte, pas une image.\n', 'utf8'),
}

for (const [name, bytes] of Object.entries(files)) {
  if (bytes.length > 50 * 1024) throw new Error(`${name} is ${bytes.length} bytes (> 50 KB)`)
  writeFileSync(join(outDir, name), bytes)
  console.log(`${name.padEnd(24)} ${(bytes.length / 1024).toFixed(1)} Ko`)
}
await browser.close()
