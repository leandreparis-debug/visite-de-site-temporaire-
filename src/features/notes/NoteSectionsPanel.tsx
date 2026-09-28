import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileStack,
  NotebookPen,
  Plus,
  Trash2,
} from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { DraftInput, DraftTextarea, SectionCard, Suggestions } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { createId } from '@/lib/id'
import { pluralize } from '@/lib/notify'
import type { NoteSection } from '@/types/visit'
import {
  addNoteSection,
  insertTemplate,
  moveNoteSection,
  removeNoteSection,
  sortedSections,
  updateNoteSection,
} from './noteSectionOps'
import { NOTE_TEMPLATES, templatesFor, WAREHOUSE_ZONES, type NoteTemplate } from './templates'

/** "Notes par zone ou thème": free-text sections with templates. */
export function NoteSectionsPanel({ visit, update }: VisitTabProps) {
  const sections = sortedSections(visit)
  const zonesListId = useId()
  // UI-only state (not saved): collapsed sections, section to focus, deletion to confirm.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<NoteSection | null>(null)

  const addSection = () => {
    const id = createId()
    update((v) => addNoteSection(v, { id }))
    setFocusId(id)
  }

  const applyTemplate = (template: NoteTemplate) => {
    // Ids are generated here (enough for the whole template), never in the updater.
    const ids = template.titles.map(() => createId())
    const { added } = insertTemplate(visit, template, ids)
    if (added === 0) {
      toast.info('Toutes les sections de la trame sont déjà présentes')
      return
    }
    update((v) => insertTemplate(v, template, ids).visit)
    toast.success(pluralize(added, 'section ajoutée', 'sections ajoutées'))
  }

  const deleteSection = (section: NoteSection) => {
    update((v) => removeNoteSection(v, section.id).visit)
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(section.id)
      return next
    })
  }

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const templates = templatesFor(visit.kind)

  return (
    <SectionCard
      title="Notes par zone ou thème"
      headingId="notes-sections"
      description="Astuce : commencez une ligne par « - » pour créer une puce dans le rapport."
      actions={
        <>
          {sections.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCollapsed(new Set(sections.map((s) => s.id)))
                }}
              >
                <ChevronsDownUp aria-hidden="true" />
                Tout replier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCollapsed(new Set())
                }}
              >
                <ChevronsUpDown aria-hidden="true" />
                Tout déplier
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileStack aria-hidden="true" />
                Insérer une trame
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onSelect={() => {
                    applyTemplate(template)
                  }}
                >
                  {template.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={addSection}>
            <Plus aria-hidden="true" />
            Ajouter une section
          </Button>
        </>
      }
    >
      <Suggestions id={zonesListId} values={WAREHOUSE_ZONES} />

      {sections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
          <NotebookPen className="size-8 text-brand" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Organisez vos notes par zone ou par thème : une section par partie du bâtiment ou par
            sujet abordé. Partez d’une trame ou ajoutez vos propres sections.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              applyTemplate(NOTE_TEMPLATES[visit.kind])
            }}
          >
            <FileStack aria-hidden="true" />
            Insérer la {NOTE_TEMPLATES[visit.kind].label.toLowerCase()}
          </Button>
        </div>
      ) : (
        <ol className="grid gap-3">
          {sections.map((section, index) => {
            const isCollapsed = collapsed.has(section.id)
            const contentId = `section-${section.id}-content`
            return (
              <li
                key={section.id}
                className="grid grid-cols-[auto_1fr_auto] items-start gap-x-1 rounded-lg border bg-background/60 p-3"
              >
                {/* DOM order = tab order: title → notes → buttons (placed visually on the first row). */}
                <IconButton
                  icon={isCollapsed ? ChevronRight : ChevronDown}
                  label={`${isCollapsed ? 'Déplier' : 'Replier'} ${section.title}`}
                  aria-expanded={!isCollapsed}
                  aria-controls={contentId}
                  onClick={() => {
                    toggle(section.id)
                  }}
                />
                <DraftInput
                  wrapperClassName="flex-1"
                  aria-label={`Titre de la section ${index + 1}`}
                  list={zonesListId}
                  autoComplete="off"
                  autoFocus={focusId === section.id}
                  required
                  requiredMessage="Le titre de la section est obligatoire"
                  maxLength={120}
                  value={section.title}
                  onFocus={(event) => {
                    if (focusId === section.id) {
                      event.currentTarget.select()
                      setFocusId(null)
                    }
                  }}
                  onValueChange={(title) => {
                    update((v) => updateNoteSection(v, section.id, { title }), {
                      coalesceKey: `section.${section.id}.title`,
                    })
                  }}
                  className="h-8 border-transparent bg-transparent font-medium shadow-none hover:border-input focus-visible:bg-surface"
                />
                <div id={contentId} className="col-start-2 row-start-2 mt-2">
                  {isCollapsed ? (
                    <CollapsedPreview content={section.content} />
                  ) : (
                    <DraftTextarea
                      aria-label={`Notes : ${section.title}`}
                      value={section.content}
                      onValueChange={(content) => {
                        update((v) => updateNoteSection(v, section.id, { content }), {
                          coalesceKey: `section.${section.id}.content`,
                        })
                      }}
                      placeholder="Constats, observations…"
                      className="min-h-[6.5rem] leading-relaxed"
                    />
                  )}
                </div>
                <div className="col-start-3 row-start-1 flex">
                  <IconButton
                    icon={ArrowUp}
                    label={`Monter ${section.title}`}
                    disabled={index === 0}
                    onClick={() => {
                      update((v) => moveNoteSection(v, section.id, -1))
                    }}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={`Descendre ${section.title}`}
                    disabled={index === sections.length - 1}
                    onClick={() => {
                      update((v) => moveNoteSection(v, section.id, 1))
                    }}
                  />
                  <IconButton
                    icon={Trash2}
                    label={`Supprimer ${section.title}`}
                    className="hover:text-danger"
                    onClick={() => {
                      if (section.content.trim()) setToDelete(section)
                      else deleteSection(section)
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer la section “{toDelete?.title}” et son contenu ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les notes de cette section seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (toDelete) deleteSection(toDelete)
                setToDelete(null)
              }}
            >
              <Trash2 aria-hidden="true" />
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}

function CollapsedPreview({ content }: { content: string }) {
  const firstLine = content
    .split('\n')
    .find((line) => line.trim())
    ?.trim()
  return (
    <p className="flex gap-2 text-sm text-muted-foreground">
      <span className="truncate">{firstLine ?? 'Section vide'}</span>
      <span className="shrink-0">· {pluralize(content.length, 'caractère')}</span>
    </p>
  )
}
