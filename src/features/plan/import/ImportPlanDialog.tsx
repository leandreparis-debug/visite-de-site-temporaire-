import { FileUp, Loader2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toUserMessage } from '@/lib/errors'
import { useObjectUrl } from '@/lib/useObjectUrl'
import { cn } from '@/lib/utils'
import { addPlan } from '../plansRepo'
import {
  browserPlanCodec,
  planImageType,
  PLAN_FORMAT_MESSAGE,
  processPlanImage,
} from './processPlanImage'
import { loadPdf, PDF_DEGRADED_MESSAGE, type LoadedPdf } from './renderPdfPage'

export interface ImportPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  visitId: string
  /** File dropped on the empty state, to start with. */
  initialFile?: File | null
  onImported: (planId: string) => void
}

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

/** Loads pdf.js only when a PDF is opened (same file, evaluated on demand). */
async function openPdf(file: File): Promise<LoadedPdf> {
  const { pdfjsBackend } = await import('./pdfjsBackend')
  return loadPdf(file, pdfjsBackend)
}

/** "Ajouter un plan": PDF (with page choice) or PNG/JPEG image. */
export function ImportPlanDialog(props: ImportPlanDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {props.open && <ImportPlanForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportPlanForm({ onOpenChange, visitId, initialFile, onImported }: ImportPlanDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [pdf, setPdf] = useState<LoadedPdf | null>(null)
  const [thumbnails, setThumbnails] = useState<(Blob | null)[]>([])
  const [page, setPage] = useState(1)
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [busy, setBusy] = useState<'opening' | 'rendering' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const pdfRef = useRef<LoadedPdf | null>(null)

  // Frees the PDF when the dialog closes or another file is chosen.
  useEffect(
    () => () => {
      void pdfRef.current?.close()
    },
    [],
  )

  const choose = async (chosen: File) => {
    setError(null)
    setThumbnails([])
    setPage(1)
    setNameEdited(false)
    setName(baseName(chosen.name))
    void pdfRef.current?.close()
    pdfRef.current = null
    setPdf(null)
    if (!isPdf(chosen) && !planImageType(chosen)) {
      setFile(null)
      setError(PLAN_FORMAT_MESSAGE)
      return
    }
    setFile(chosen)
    if (!isPdf(chosen)) return
    setBusy('opening')
    try {
      const loaded = await openPdf(chosen)
      pdfRef.current = loaded
      setPdf(loaded)
      if (loaded.pageCount > 1) {
        // Thumbnails one by one (bounded memory), first 40 pages.
        for (let index = 1; index <= Math.min(loaded.pageCount, 40); index++) {
          if (pdfRef.current !== loaded) return
          const thumbnail = await loaded.renderThumbnail(index).catch(() => null)
          setThumbnails((current) => {
            const next = [...current]
            next[index - 1] = thumbnail
            return next
          })
        }
      }
    } catch (caught) {
      setFile(null)
      setError(toUserMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  const initialRef = useRef(initialFile)
  useEffect(() => {
    if (initialRef.current) void choose(initialRef.current)
    // Only once, for the file dropped on the empty state.
  }, [])

  const selectPage = (pageNumber: number) => {
    setPage(pageNumber)
    if (!nameEdited && file) {
      setName(pageNumber === 1 ? baseName(file.name) : `${baseName(file.name)} – p. ${pageNumber}`)
    }
  }

  const submit = async () => {
    if (!file || busy) return
    setBusy('rendering')
    setError(null)
    try {
      const rendered = pdf
        ? await pdf.renderPage(page)
        : await processPlanImage(file, browserPlanCodec)
      const plan = await addPlan({
        visitId,
        name: name.trim() || baseName(file.name) || 'Plan',
        blob: rendered.blob,
        mimeType: rendered.mimeType,
        width: rendered.width,
        height: rendered.height,
        sourceType: pdf ? 'pdf' : 'image',
      })
      toast.success('Plan ajouté')
      if (rendered.degraded) toast.warning(PDF_DEGRADED_MESSAGE, { duration: 15_000 })
      onImported(plan.id)
      onOpenChange(false)
    } catch (caught) {
      console.error('[plan] Import failed:', caught)
      setError(toUserMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un plan</DialogTitle>
        <DialogDescription>PDF (depuis AutoCAD) ou image PNG / JPEG.</DialogDescription>
      </DialogHeader>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,image/png,image/jpeg"
        className="hidden"
        data-testid="plan-input"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) void choose(chosen)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => {
          setDragOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const dropped = event.dataTransfer.files[0]
          if (dropped) void choose(dropped)
        }}
        className={cn(
          'flex items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-sm outline-none hover:border-brand/50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
          dragOver && 'border-brand bg-accent',
        )}
      >
        <FileUp className="size-6 text-brand" aria-hidden="true" />
        <span>
          {file
            ? `Fichier : ${file.name} (changer)`
            : 'Choisir ou déposer un fichier PDF, PNG ou JPEG'}
        </span>
      </button>

      {busy === 'opening' && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Lecture du PDF…
        </p>
      )}

      {pdf && pdf.pageCount > 1 && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Page du plan ({pdf.pageCount} pages)</legend>
          <div
            role="radiogroup"
            aria-label="Page du plan"
            className="grid max-h-72 grid-cols-4 gap-3 overflow-y-auto p-1"
          >
            {Array.from({ length: Math.min(pdf.pageCount, 40) }, (_, index) => (
              <PageChoice
                key={index}
                pageNumber={index + 1}
                thumbnail={thumbnails[index] ?? null}
                selected={page === index + 1}
                onSelect={selectPage}
              />
            ))}
          </div>
        </fieldset>
      )}

      {file && (
        <div className="grid gap-2">
          <Label htmlFor={nameId}>Nom du plan</Label>
          <Input
            id={nameId}
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.target.value)
              setNameEdited(true)
            }}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false)
          }}
          disabled={busy === 'rendering'}
        >
          Annuler
        </Button>
        <Button onClick={() => void submit()} disabled={!file || busy !== null}>
          {busy === 'rendering' && <Loader2 className="animate-spin" aria-hidden="true" />}
          {busy === 'rendering' ? 'Préparation du plan…' : 'Importer le plan'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function PageChoice({
  pageNumber,
  thumbnail,
  selected,
  onSelect,
}: {
  pageNumber: number
  thumbnail: Blob | null
  selected: boolean
  onSelect: (page: number) => void
}) {
  const url = useObjectUrl(thumbnail)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Page ${pageNumber}`}
      onClick={() => {
        onSelect(pageNumber)
      }}
      className={cn(
        'grid gap-1 rounded-md border bg-surface p-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected && 'border-brand ring-2 ring-brand',
      )}
    >
      <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
        {url ? (
          <img src={url} alt="" className="max-h-full max-w-full" />
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      Page {pageNumber}
    </button>
  )
}
