/** "Plan n°4, n°9" for the pins of a photo. */
export function formatPinNumbers(numbers: readonly number[]): string {
  return `Plan ${numbers.map((n) => `n°${n}`).join(', ')}`
}

/** EXIF date "15/09/2026 à 10h42" (local time as recorded by the camera). */
export function formatTakenAt(takenAt: string): string {
  const [date = '', time = ''] = takenAt.split('T')
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year} à ${time.slice(0, 5).replace(':', 'h')}`
}
