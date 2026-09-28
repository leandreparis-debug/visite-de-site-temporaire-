// Order matters: Zod config and the IndexedDB polyfill must load before any app module.
import '@/lib/zod-setup'
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import './domPolyfills'
import { Blob as NodeBlob } from 'node:buffer'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { resetDbForTests } from '@/lib/db/db'

// jsdom's Blob cannot be structured-cloned by fake-indexeddb (it comes back as
// a plain object); Node's native Blob can. Browsers are not affected.
globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob

beforeEach(async () => {
  await resetDbForTests()
})

afterEach(() => {
  cleanup()
})
