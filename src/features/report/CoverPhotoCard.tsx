import { ImagePlus, X } from 'lucide-react'
import { useState } from 'react'
import { SectionCard } from '@/components/form/DraftFields'
import { Button } from '@/components/ui/button'
import { PhotoPickerDialog } from '@/features/photos/PhotoPickerDialog'
import { useObjectUrl } from '@/lib/useObjectUrl'
import type { Photo } from '@/types/media'

export interface CoverPhotoCardProps {
  /** Photos of the visit, in display order. */
  photos: readonly Photo[]
  coverPhotoId: string | undefined
  disabled?: boolean
  onChange: (photoId: string | null) => void
}

/** "Page de garde": photo of the site shown on the report cover (optional). */
export function CoverPhotoCard({ photos, coverPhotoId, disabled, onChange }: CoverPhotoCardProps) {
  const [picking, setPicking] = useState(false)
  // A deleted photo is simply ignored (the report does the same).
  const photo = photos.find((p) => p.id === coverPhotoId)
  const url = useObjectUrl(photo?.thumbnailBlob)

  return (
    <SectionCard
      title="Page de garde"
      headingId="report-cover"
      description="Une photo du site (l’entrepôt, la façade…) sous le titre du rapport."
    >
      {photo ? (
        <div className="space-y-2">
          {url && (
            <img
              src={url}
              alt={`Photo de la page de garde${photo.caption.trim() ? ` : ${photo.caption.trim()}` : ''}`}
              className="aspect-[4/3] w-full rounded-lg border object-cover"
            />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={disabled}
              onClick={() => {
                setPicking(true)
              }}
            >
              <ImagePlus aria-hidden="true" />
              Changer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange(null)
              }}
            >
              <X aria-hidden="true" />
              Retirer
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          disabled={disabled || photos.length === 0}
          onClick={() => {
            setPicking(true)
          }}
        >
          <ImagePlus aria-hidden="true" />
          {photos.length === 0 ? 'Aucune photo dans la visite' : 'Choisir la photo de garde'}
        </Button>
      )}
      <PhotoPickerDialog
        open={picking}
        mode="single"
        title="Photo de la page de garde"
        description="Choisissez une photo du site, par exemple une vue de l’entrepôt."
        photos={photos}
        initialIds={photo ? [photo.id] : []}
        onConfirm={(ids) => {
          onChange(ids[0] ?? null)
          setPicking(false)
        }}
        onClose={() => {
          setPicking(false)
        }}
      />
    </SectionCard>
  )
}
