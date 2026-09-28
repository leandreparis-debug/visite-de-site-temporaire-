import { describe, expect, it, vi } from 'vitest'
import { formatImportReport, runPhotoImport, sortForImport } from '@/features/photos/photoImport'
import type { ProcessedPhoto } from '@/features/photos/processing/processPhoto'
import { UnsupportedImageError } from '@/features/photos/processing/processPhoto'
import { StorageQuotaError } from '@/lib/errors'
import { fixtureFile } from '@/test/photoFixtures'

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const processed = (name: string): ProcessedPhoto => ({
  blob: new Blob([name]),
  thumbnailBlob: new Blob([name]),
  width: 10,
  height: 10,
  mimeType: 'image/jpeg',
  originalName: name,
})

describe('sortForImport', () => {
  it('sorts names naturally (IMG_2 before IMG_10)', () => {
    const names = ['IMG_10.jpg', 'img_2.jpg', 'IMG_1.jpg', 'IMG_100.jpg']
    const sorted = sortForImport(names.map((name) => ({ file: file(name), takenAt: null })))
    expect(sorted.map((c) => c.file.name)).toEqual([
      'IMG_1.jpg',
      'img_2.jpg',
      'IMG_10.jpg',
      'IMG_100.jpg',
    ])
  })

  it('uses the EXIF date first when available', () => {
    const sorted = sortForImport([
      { file: file('a.jpg'), takenAt: null },
      { file: file('b.jpg'), takenAt: '2026-09-15T10:00:00' },
      { file: file('c.jpg'), takenAt: '2026-09-01T10:00:00' },
    ])
    expect(sorted.map((c) => c.file.name)).toEqual(['c.jpg', 'b.jpg', 'a.jpg'])
  })
})

describe('runPhotoImport', () => {
  const deps = (overrides: Partial<Parameters<typeof runPhotoImport>[1]> = {}) => ({
    process: vi.fn((f: File) => Promise.resolve(processed(f.name))),
    save: vi.fn(() => Promise.resolve()),
    isCancelled: () => false,
    ...overrides,
  })

  it('reads EXIF dates of real files to order the import', async () => {
    const process = vi.fn((f: File) => Promise.resolve(processed(f.name)))
    await runPhotoImport(
      [
        fixtureFile('exif-ii.jpg'),
        fixtureFile('paysage-sans-exif.jpg'),
        fixtureFile('exif-mm.jpg'),
      ],
      deps({ process }),
    )
    expect(process.mock.calls.map(([f]) => f.name)).toEqual([
      'exif-mm.jpg',
      'exif-ii.jpg',
      'paysage-sans-exif.jpg',
    ])
  })

  it('skips a failing file with its reason and continues', async () => {
    const d = deps({
      process: vi.fn((f: File) =>
        f.name === '2.jpg'
          ? Promise.reject(new UnsupportedImageError('Image illisible.', 'bad'))
          : Promise.resolve(processed(f.name)),
      ),
    })
    const progress: string[] = []
    const report = await runPhotoImport([file('1.jpg'), file('2.jpg'), file('3.jpg')], {
      ...d,
      onProgress: (done, total, name) => progress.push(`${done}/${total} ${name}`),
    })
    expect(report).toEqual({
      imported: 2,
      skipped: [{ name: '2.jpg', reason: 'Image illisible.' }],
      notProcessed: 0,
      cancelled: false,
    })
    expect(d.save).toHaveBeenCalledTimes(2)
    expect(progress).toEqual(['0/3 1.jpg', '1/3 2.jpg', '2/3 3.jpg', '3/3 '])
    expect(formatImportReport(report)).toBe('2\u00a0photos importées, 1\u00a0ignorée')
  })

  it('stops after the photo in progress when cancelled', async () => {
    let cancelled = false
    const d = deps({
      isCancelled: () => cancelled,
      save: vi.fn(() => {
        cancelled = true // the user clicks "Annuler" during the first photo
        return Promise.resolve()
      }),
    })
    const report = await runPhotoImport([file('1.jpg'), file('2.jpg'), file('3.jpg')], d)
    expect(report).toMatchObject({ imported: 1, cancelled: true, notProcessed: 2 })
    expect(d.process).toHaveBeenCalledTimes(1)
    expect(formatImportReport(report)).toBe('1\u00a0photo importée (import annulé)')
  })

  it('stops cleanly on a full storage (StorageQuotaError)', async () => {
    const d = deps({
      save: vi.fn((photo: ProcessedPhoto) =>
        photo.originalName === '2.jpg'
          ? Promise.reject(new StorageQuotaError())
          : Promise.resolve(),
      ),
    })
    const report = await runPhotoImport([file('1.jpg'), file('2.jpg'), file('3.jpg')], d)
    expect(report.imported).toBe(1)
    expect(report.notProcessed).toBe(2)
    expect(report.skipped).toEqual([])
    expect(report.stoppedBecause).toMatch(/Espace de stockage du navigateur insuffisant/)
    expect(d.process).toHaveBeenCalledTimes(2)
  })

  it('formats the report', () => {
    expect(
      formatImportReport({ imported: 12, skipped: [], notProcessed: 0, cancelled: false }),
    ).toBe('12\u00a0photos importées')
  })
})

describe('usePhotoImport (hook)', () => {
  it('asks for confirmation when the storage looks too small, and can be cancelled', async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { usePhotoImport } = await import('@/features/photos/usePhotoImport')
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: () => Promise.resolve({ usage: 999_000_000, quota: 1_000_000_000 }) },
      configurable: true,
    })
    const { result } = renderHook(() => usePhotoImport('visit-id'))
    await act(() => result.current.start([file('1.jpg'), file('2.jpg')]))
    expect(result.current.storageWarning).toMatchObject({ neededBytes: 2 * 700 * 1024 })
    expect(result.current.isImporting).toBe(false)
    act(() => {
      result.current.dismissStorageWarning()
    })
    expect(result.current.storageWarning).toBeNull()
    Reflect.deleteProperty(navigator, 'storage')
  })
})
