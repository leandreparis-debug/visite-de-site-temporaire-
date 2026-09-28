import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { DraftInput, DraftTextarea, SectionCard, Suggestions } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { createId } from '@/lib/id'
import { pluralize } from '@/lib/notify'
import { VISIT_KIND_LABELS } from '@/types/labels'
import { VISIT_KINDS, type Participant, type VisitKind } from '@/types/visit'
import {
  addParticipant,
  countPresence,
  insertParticipantAt,
  moveParticipant,
  removeParticipant,
  updateParticipant,
  type ParticipantFields,
} from './participantOps'
import { useFieldSuggestions } from './useFieldSuggestions'
import { setVisitInfo, type VisitInfoPatch } from './visitInfoOps'

const KIND_OPTIONS = VISIT_KINDS.map((kind) => ({ value: kind, label: VISIT_KIND_LABELS[kind] }))

/** "Informations générales" tab: visit, site and participants. */
export function GeneralTab({ visit, update }: VisitTabProps) {
  const suggestions = useFieldSuggestions(visit.id)
  const ids = {
    date: useId(),
    time: useId(),
    author: useId(),
    authors: useId(),
    purpose: useId(),
    siteName: useId(),
    siteNames: useId(),
    siteCode: useId(),
    address: useId(),
    city: useId(),
    cities: useId(),
  }

  /** Field edit: coalesced per field, so typing keeps a single pending update. */
  const setInfo = (key: string, patch: VisitInfoPatch) => {
    update((v) => setVisitInfo(v, patch), { coalesceKey: `info.${key}` })
  }

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-6">
        <SectionCard title="Visite" headingId="general-visit">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid gap-2">
              <span className="text-sm font-medium" id="general-kind-label">
                Type
              </span>
              <SegmentedControl<VisitKind>
                label="Type de visite"
                options={KIND_OPTIONS}
                value={visit.kind}
                onChange={(kind) => {
                  update((v) => setVisitInfo(v, { kind }))
                }}
                className="w-fit"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.date}>Date</Label>
              <Input
                id={ids.date}
                type="date"
                required
                value={visit.date}
                className="bg-surface"
                onChange={(event) => {
                  setInfo('date', { date: event.target.value })
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.time}>Heure de début</Label>
              <Input
                id={ids.time}
                type="time"
                value={visit.startTime ?? ''}
                className="bg-surface"
                onChange={(event) => {
                  setInfo('startTime', { startTime: event.target.value })
                }}
              />
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor={ids.author}>Rédacteur</Label>
              <DraftInput
                id={ids.author}
                list={ids.authors}
                autoComplete="off"
                value={visit.author ?? ''}
                onValueChange={(author) => {
                  setInfo('author', { author })
                }}
                className="bg-surface"
              />
              <Suggestions id={ids.authors} values={suggestions.authors} />
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor={ids.purpose}>Objet</Label>
              <DraftTextarea
                id={ids.purpose}
                rows={3}
                maxLength={1000}
                placeholder="Ex. : visite annuelle de la toiture suite aux infiltrations signalées"
                value={visit.purpose ?? ''}
                onValueChange={(purpose) => {
                  setInfo('purpose', { purpose })
                }}
                className="min-h-[4.5rem]"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Site" headingId="general-site">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid gap-2">
              <Label htmlFor={ids.siteName}>
                Nom du site
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </Label>
              <DraftInput
                id={ids.siteName}
                list={ids.siteNames}
                autoComplete="off"
                required
                requiredMessage="Le nom du site est obligatoire"
                maxLength={200}
                value={visit.site.name}
                onValueChange={(name) => {
                  setInfo('site.name', { site: { name } })
                }}
                className="bg-surface"
              />
              <Suggestions id={ids.siteNames} values={suggestions.siteNames} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.siteCode}>Code site</Label>
              <DraftInput
                id={ids.siteCode}
                autoComplete="off"
                maxLength={50}
                value={visit.site.code ?? ''}
                onValueChange={(code) => {
                  setInfo('site.code', { site: { code } })
                }}
                className="bg-surface"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.city}>Ville</Label>
              <DraftInput
                id={ids.city}
                list={ids.cities}
                autoComplete="off"
                maxLength={120}
                value={visit.site.city ?? ''}
                onValueChange={(city) => {
                  setInfo('site.city', { site: { city } })
                }}
                className="bg-surface"
              />
              <Suggestions id={ids.cities} values={suggestions.cities} />
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor={ids.address}>Adresse</Label>
              <DraftInput
                id={ids.address}
                autoComplete="off"
                maxLength={300}
                value={visit.site.address ?? ''}
                onValueChange={(address) => {
                  setInfo('site.address', { site: { address } })
                }}
                className="bg-surface"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <ParticipantsCard
        visit={visit}
        update={update}
        suggestions={{
          names: suggestions.participantNames,
          roles: suggestions.roles,
          companies: suggestions.companies,
        }}
      />
    </div>
  )
}

interface ParticipantsCardProps extends VisitTabProps {
  suggestions: { names: string[]; roles: string[]; companies: string[] }
}

const EMPTY_ENTRY = { name: '', role: '', company: '' }

function ParticipantsCard({ visit, update, suggestions }: ParticipantsCardProps) {
  const [entry, setEntry] = useState(EMPTY_ENTRY)
  const nameRef = useRef<HTMLInputElement>(null)
  const ids = {
    names: useId(),
    roles: useId(),
    companies: useId(),
    name: useId(),
    role: useId(),
    company: useId(),
  }
  const { present, absent } = countPresence(visit.participants)

  const add = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!entry.name.trim()) {
      nameRef.current?.focus()
      return
    }
    // The id is generated here, never inside the updater (replayed by the autosave).
    const participant = { id: createId(), ...entry }
    update((v) => addParticipant(v, participant))
    setEntry(EMPTY_ENTRY)
    nameRef.current?.focus()
  }

  const remove = (participant: Participant) => {
    const { removed, index } = removeParticipant(visit, participant.id)
    if (!removed) return
    update((v) => removeParticipant(v, participant.id).visit)
    toast('Participant supprimé', {
      description: removed.name,
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((v) => insertParticipantAt(v, removed, index))
        },
      },
    })
  }

  const edit = (id: string, fields: Partial<ParticipantFields>, key: string) => {
    update((v) => updateParticipant(v, id, fields), { coalesceKey: `participant.${id}.${key}` })
  }

  return (
    <SectionCard
      title="Participants"
      headingId="general-participants"
      description={
        visit.participants.length > 0 && (
          <span aria-live="polite">
            {pluralize(present, 'présent')} · {pluralize(absent, 'absent')}
          </span>
        )
      }
    >
      <form
        onSubmit={add}
        className="mb-4 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 rounded-lg bg-muted/60 p-3"
        aria-label="Ajouter un participant"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={ids.name}>Nom</Label>
          <Input
            ref={nameRef}
            id={ids.name}
            list={ids.names}
            autoComplete="off"
            maxLength={120}
            placeholder="Prénom Nom"
            value={entry.name}
            onChange={(event) => {
              setEntry((e) => ({ ...e, name: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.role}>Fonction</Label>
          <Input
            id={ids.role}
            list={ids.roles}
            autoComplete="off"
            maxLength={120}
            value={entry.role}
            onChange={(event) => {
              setEntry((e) => ({ ...e, role: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.company}>Société</Label>
          <Input
            id={ids.company}
            list={ids.companies}
            autoComplete="off"
            maxLength={120}
            value={entry.company}
            onChange={(event) => {
              setEntry((e) => ({ ...e, company: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <Button type="submit" variant="outline" className="bg-surface">
          <Plus aria-hidden="true" />
          Ajouter
        </Button>
      </form>
      <Suggestions id={ids.names} values={suggestions.names} />
      <Suggestions id={ids.roles} values={suggestions.roles} />
      <Suggestions id={ids.companies} values={suggestions.companies} />

      {visit.participants.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun participant. Ajoutez les personnes présentes à la visite.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Nom</th>
              <th className="pb-2 pl-2 font-medium">Fonction</th>
              <th className="pb-2 pl-2 font-medium">Société</th>
              <th className="w-20 pb-2 text-center font-medium">Présent</th>
              <th className="w-28 pb-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visit.participants.map((participant, index) => (
              <tr key={participant.id} className="border-b last:border-0">
                <td className="py-1.5 align-top">
                  <DraftInput
                    aria-label={`Nom du participant ${index + 1}`}
                    list={ids.names}
                    autoComplete="off"
                    required
                    requiredMessage="Le nom est obligatoire"
                    maxLength={120}
                    value={participant.name}
                    onValueChange={(name) => {
                      edit(participant.id, { name }, 'name')
                    }}
                    className="h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface"
                  />
                </td>
                <td className="py-1.5 pl-2 align-top">
                  <DraftInput
                    aria-label={`Fonction de ${participant.name}`}
                    list={ids.roles}
                    autoComplete="off"
                    maxLength={120}
                    value={participant.role ?? ''}
                    onValueChange={(role) => {
                      edit(participant.id, { role }, 'role')
                    }}
                    className="h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface"
                  />
                </td>
                <td className="py-1.5 pl-2 align-top">
                  <DraftInput
                    aria-label={`Société de ${participant.name}`}
                    list={ids.companies}
                    autoComplete="off"
                    maxLength={120}
                    value={participant.company ?? ''}
                    onValueChange={(company) => {
                      edit(participant.id, { company }, 'company')
                    }}
                    className="h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface"
                  />
                </td>
                <td className="py-1.5 text-center align-top">
                  <input
                    type="checkbox"
                    className="mt-2 size-4 cursor-pointer accent-brand"
                    aria-label={`Présent : ${participant.name}`}
                    checked={participant.present}
                    onChange={(event) => {
                      const presentValue = event.target.checked
                      update((v) => updateParticipant(v, participant.id, { present: presentValue }))
                    }}
                  />
                </td>
                <td className="py-1.5 text-right align-top whitespace-nowrap">
                  <IconButton
                    icon={ArrowUp}
                    label={`Monter ${participant.name}`}
                    disabled={index === 0}
                    onClick={() => {
                      update((v) => moveParticipant(v, participant.id, -1))
                    }}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={`Descendre ${participant.name}`}
                    disabled={index === visit.participants.length - 1}
                    onClick={() => {
                      update((v) => moveParticipant(v, participant.id, 1))
                    }}
                  />
                  <IconButton
                    icon={Trash2}
                    label={`Supprimer ${participant.name}`}
                    className="hover:text-danger"
                    onClick={() => {
                      remove(participant)
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  )
}
