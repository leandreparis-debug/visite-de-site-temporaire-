import { describe, expect, it } from 'vitest'
import { parseNoteContent } from '@/features/report/model/parseNoteContent'

describe('parseNoteContent', () => {
  it('mixes paragraphs and bullets, grouping consecutive bullets', () => {
    expect(
      parseNoteContent(
        'Toiture en bon état général.\nQuelques points :\n- fuite quai 3\n- chéneau bouché\nÀ revoir en novembre.\n- reprise joint',
      ),
    ).toEqual([
      { type: 'paragraph', lines: ['Toiture en bon état général.', 'Quelques points :'] },
      { type: 'bullets', items: ['fuite quai 3', 'chéneau bouché'] },
      { type: 'paragraph', lines: ['À revoir en novembre.'] },
      { type: 'bullets', items: ['reprise joint'] },
    ])
  })

  it('keeps "-texte" (no space after the dash) as a paragraph', () => {
    expect(parseNoteContent('-texte collé\n- vraie puce\n-10 % de pente')).toEqual([
      { type: 'paragraph', lines: ['-texte collé'] },
      { type: 'bullets', items: ['vraie puce'] },
      { type: 'paragraph', lines: ['-10 % de pente'] },
    ])
  })

  it('splits on empty lines and trims line edges', () => {
    expect(
      parseNoteContent(
        '  Premier paragraphe  \n\n\n   \nSecond\n  -   puce indentée  \n\n- autre liste\r\n',
      ),
    ).toEqual([
      { type: 'paragraph', lines: ['Premier paragraphe'] },
      { type: 'paragraph', lines: ['Second'] },
      { type: 'bullets', items: ['puce indentée'] },
      { type: 'bullets', items: ['autre liste'] },
    ])
  })

  it('returns nothing for an empty or blank text', () => {
    expect(parseNoteContent('')).toEqual([])
    expect(parseNoteContent(' \n\t\n ')).toEqual([])
    // A lone dash is not a bullet.
    expect(parseNoteContent('-')).toEqual([{ type: 'paragraph', lines: ['-'] }])
  })
})
