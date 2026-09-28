import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve(import.meta.dirname, '../../tests/fixtures/photos')

/** Bytes of a file of tests/fixtures/photos. */
export function fixtureBytes(name: string): Uint8Array<ArrayBuffer> {
  const buffer = readFileSync(resolve(dir, name))
  const copy = new Uint8Array(buffer.byteLength)
  copy.set(buffer)
  return copy
}

/** A fixture as a `File` (type inferred from the extension, like a browser does). */
export function fixtureFile(name: string, type?: string): File {
  const inferred = name.endsWith('.png') ? 'image/png' : name.endsWith('.jpg') ? 'image/jpeg' : ''
  return new File([fixtureBytes(name)], name, { type: type ?? inferred })
}
