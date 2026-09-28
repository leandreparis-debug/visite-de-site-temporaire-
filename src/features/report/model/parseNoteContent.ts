import type { NoteBlock } from './reportModel'

/** A bullet line: a dash followed by at least one space ("- texte"). */
const BULLET = /^-\s+(.*)$/

/**
 * Splits the plain text of a note section into Word blocks.
 *
 * - A line starting with "- " (dash then space) is a bullet; consecutive
 *   bullets form one list. "-texte" (no space) stays ordinary text.
 * - Other lines are text; consecutive text lines form one paragraph (kept as
 *   separate lines, rendered with line breaks).
 * - Empty lines separate paragraphs and lists. Line edges are trimmed.
 *
 * @example parseNoteContent('Toiture :\n- fuite\n- chéneau')
 * // [{ type: 'paragraph', lines: ['Toiture :'] }, { type: 'bullets', items: ['fuite', 'chéneau'] }]
 */
export function parseNoteContent(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let current: NoteBlock | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      current = null
      continue
    }
    const bullet = BULLET.exec(line)
    if (bullet) {
      const item = bullet[1] ?? ''
      if (current?.type === 'bullets') current.items.push(item)
      else {
        current = { type: 'bullets', items: [item] }
        blocks.push(current)
      }
    } else if (current?.type === 'paragraph') {
      current.lines.push(line)
    } else {
      current = { type: 'paragraph', lines: [line] }
      blocks.push(current)
    }
  }
  return blocks
}
