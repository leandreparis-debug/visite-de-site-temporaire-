/**
 * Minimal EXIF reader: only `DateTimeOriginal` (tag 0x9003), no dependency.
 * Path: JPEG markers → APP1 "Exif" → TIFF header (II or MM) → IFD0 →
 * ExifIFD (tag 0x8769) → 0x9003.
 */

/** Bytes to read from the start of a file: EXIF always sits in the first segments. */
export const EXIF_READ_BYTES = 128 * 1024

const TAG_EXIF_IFD = 0x8769
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TYPE_ASCII = 2
const TYPE_LONG = 4
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/

/**
 * Reads the EXIF `DateTimeOriginal` of a JPEG.
 *
 * @param buffer the beginning of the file (the first 128 KB are enough).
 * @returns a local ISO date-time `YYYY-MM-DDTHH:mm:ss`, or `null` when absent,
 *   invalid or when the structure is unexpected. Never throws.
 */
export function readDateTimeOriginal(buffer: ArrayBuffer): string | null {
  try {
    return parse(new DataView(buffer, 0, Math.min(buffer.byteLength, EXIF_READ_BYTES)))
  } catch {
    return null
  }
}

function parse(view: DataView): string | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null
    const marker = view.getUint8(offset + 1)
    // Padding bytes before a marker.
    if (marker === 0xff) {
      offset += 1
      continue
    }
    // Start of scan / end of image: no metadata after this point.
    if (marker === 0xda || marker === 0xd9) return null
    const length = view.getUint16(offset + 2)
    if (length < 2) return null
    const start = offset + 4
    if (marker === 0xe1 && isExifHeader(view, start)) return readTiff(view, start + 6)
    offset = start + length - 2
  }
  return null
}

function isExifHeader(view: DataView, start: number): boolean {
  // "Exif\0\0"
  return (
    start + 6 <= view.byteLength &&
    view.getUint32(start) === 0x45786966 &&
    view.getUint16(start + 4) === 0x0000
  )
}

function readTiff(view: DataView, tiff: number): string | null {
  const order = view.getUint16(tiff)
  if (order !== 0x4949 && order !== 0x4d4d) return null
  const little = order === 0x4949
  if (view.getUint16(tiff + 2, little) !== 42) return null
  const u16 = (at: number) => view.getUint16(tiff + at, little)
  const u32 = (at: number) => view.getUint32(tiff + at, little)

  const findEntry = (ifd: number, tag: number): number | null => {
    const count = u16(ifd)
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12
      if (u16(entry) === tag) return entry
    }
    return null
  }

  const exifPointer = findEntry(u32(4), TAG_EXIF_IFD)
  if (exifPointer === null || u16(exifPointer + 2) !== TYPE_LONG) return null
  const dateEntry = findEntry(u32(exifPointer + 8), TAG_DATE_TIME_ORIGINAL)
  if (dateEntry === null || u16(dateEntry + 2) !== TYPE_ASCII) return null
  const count = u32(dateEntry + 4)
  if (count < 19 || count > 64) return null
  const valueOffset = count > 4 ? u32(dateEntry + 8) : dateEntry + 8

  let text = ''
  for (let i = 0; i < 19; i++) text += String.fromCharCode(view.getUint8(tiff + valueOffset + i))
  const match = EXIF_DATE.exec(text)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  // Reject impossible values ("0000:00:00 00:00:00" is common for "unknown").
  const date = new Date(`${iso}Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 19) !== iso ? null : iso
}
