import { CircleHelp } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatBuildLabel } from '@/lib/buildInfo'
import { GUIDE_INTRO, GUIDE_SECTIONS, type GuideBlock } from './guideContent'

/** Renders the inline formatting of the guide: **bold** and `key`. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <kbd
          key={index}
          className="rounded border bg-muted px-1 py-px font-sans text-[0.85em] font-medium"
        >
          {part.slice(1, -1)}
        </kbd>
      )
    return <Fragment key={index}>{part}</Fragment>
  })
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{inline(block.text)}</p>
    case 'list':
      return (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {block.headers.map((header) => (
                <th key={header} scope="col" className="py-1 pr-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join('|')} className="border-b last:border-0">
                {row.map((value, index) => (
                  <td key={index} className="py-1 pr-3 align-top">
                    {inline(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
  }
}

/**
 * "Aide" button of the header and the user guide dialog, in collapsible
 * sections (native `<details>`). Content: src/features/help/guideContent.ts,
 * also published as docs/GUIDE_UTILISATEUR.md.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={() => {
          setOpen(true)
        }}
      >
        <CircleHelp aria-hidden="true" />
        Aide
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl" bodyClassName="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aide — Comptes rendus de visite</DialogTitle>
            <DialogDescription>{GUIDE_INTRO}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {GUIDE_SECTIONS.map((section, index) => (
              <details
                key={section.id}
                open={index === 0}
                className="group rounded-lg border bg-surface px-4 py-2 open:pb-4"
              >
                <summary className="cursor-pointer py-1 font-semibold text-brand marker:text-muted-foreground">
                  {section.title}
                </summary>
                <div className="mt-2 space-y-2">
                  {section.blocks.map((block, blockIndex) => (
                    <Block key={blockIndex} block={block} />
                  ))}
                </div>
              </details>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{formatBuildLabel()}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
