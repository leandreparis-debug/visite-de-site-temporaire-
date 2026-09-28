/**
 * Normalizes text for accent- and case-insensitive search:
 * "Entrepôt Lyon" → "entrepot lyon".
 */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
