import { useState } from 'react'
import { NativeSelect } from '@/components/form/NativeSelect'
import { cn } from '@/lib/utils'
import { PHOTO_CATEGORY_LABELS } from '@/types/labels'
import { PHOTO_CATEGORIES, type Photo } from '@/types/media'
import type { PhotoMetaSaver } from './usePhotoMetaSaver'

/** Caption input: local value while focused, saved 600 ms after typing and on blur. */
export function CaptionField({
  photo,
  saver,
  label,
  className,
}: {
  photo: Photo
  saver: PhotoMetaSaver
  label: string
  className?: string
}) {
  const [local, setLocal] = useState<string | null>(null)
  return (
    <input
      type="text"
      aria-label={label}
      placeholder="Ajouter une légende…"
      maxLength={1000}
      value={local ?? saver.valueOf(photo, 'caption')}
      onFocus={() => {
        setLocal(saver.valueOf(photo, 'caption'))
      }}
      onChange={(event) => {
        setLocal(event.target.value)
        saver.set(photo.id, 'caption', event.target.value)
      }}
      onBlur={() => {
        setLocal(null)
        void saver.flush(photo.id)
      }}
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    />
  )
}

/** Category select, saved immediately. */
export function CategorySelect({
  photo,
  saver,
  label,
  className,
  selectClassName,
}: {
  photo: Photo
  saver: PhotoMetaSaver
  label: string
  className?: string
  selectClassName?: string
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={saver.valueOf(photo, 'category')}
      className={className}
      selectClassName={cn('h-8 text-xs', selectClassName)}
      onChange={(event) => {
        saver.set(photo.id, 'category', event.target.value, { immediate: true })
      }}
    >
      {PHOTO_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {PHOTO_CATEGORY_LABELS[category]}
        </option>
      ))}
    </NativeSelect>
  )
}
