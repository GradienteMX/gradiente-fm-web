'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import type { ContentItem } from '@/lib/types'
import { LivePreview } from '@/components/dashboard/LivePreview'
import {
  Section,
  TextField,
  TextArea,
  Toggle,
  VibeField,
  GenreMultiSelect,
  StringListField,
  ImageUrlField,
  LinkListField,
  SubmitFooter,
  slugify,
  useDraftWorkbench,
} from './shared/Fields'
import { EntityMultiSelect } from './shared/EntityMultiSelect'
import { PartnerAttributionField } from './shared/PartnerAttributionField'
import { PollFieldset } from './shared/PollFieldset'
import { VibePriorHint } from './shared/VibePriorHint'

const DRAFT_KEY = 'gradiente:dashboard:evento-draft'

function emptyDraft(): ContentItem {
  return {
    id: 'draft-evento',
    slug: '',
    type: 'evento',
    title: '',
    subtitle: '',
    excerpt: '',
    vibeMin: 5, vibeMax: 5,
    genres: [],
    tags: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    date: '',
    endDate: '',
    venue: '',
    venueCity: '',
    artists: [],
    entities: [],
    subjectKind: 'event',
    country: '',
    year: undefined,
    ticketUrl: '',
    price: '',
    editorial: false,
    attributePartner: true,
  }
}

// ISO ↔ datetime-local string helpers.
// <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" (no seconds, no TZ).
function isoToLocal(iso: string | undefined): string {
  if (!iso) return ''
  try {
    // Drop anything past minutes. Works for both Z-suffixed and naive strings.
    return iso.slice(0, 16)
  } catch {
    return ''
  }
}
function localToIso(local: string): string {
  if (!local) return ''
  // Pad to seconds so ContentItem fields parse cleanly elsewhere.
  return `${local}:00`
}

export function EventoForm() {
  const [draft, setDraft] = useState<ContentItem>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const router = useRouter()
  const search = useSearchParams()
  const editItemId = search?.get('edit') ?? null
  const { setCategoryFilter } = useVibe()
  const { openConfirm } = usePublishConfirm()
  const workbench = useDraftWorkbench({
    draftKey: DRAFT_KEY,
    emptyFn: emptyDraft,
    draft,
    setDraft,
    editItemId,
  })

  const onPublish = () => {
    const id = workbench.requestPublish()
    setCategoryFilter(null)
    openConfirm(id)
  }

  useEffect(() => {
    if (!slugManuallyEdited && draft.title) {
      const next = slugify(draft.title)
      setDraft((d) => (d.slug === next ? d : { ...d, slug: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.title, slugManuallyEdited])

  const patch = (p: Partial<ContentItem>) => setDraft((d) => ({ ...d, ...p }))

  const onReset = () => {
    workbench.reset()
    setSlugManuallyEdited(false)
  }

  const errors: string[] = []
  if (!draft.title) errors.push('TÍTULO')
  if (!draft.slug) errors.push('SLUG')
  if (!draft.date) errors.push('INICIO')
  const canSubmit = errors.length === 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5">
        <Section label="01" title="IDENTIDAD">
          <TextField
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="FASCiNOMA 2026"
            required
          />
          <TextField
            label="SUBTÍTULO"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Espacio al aire libre CDMX · Dub · Techno"
          />
          <TextField
            label="SLUG"
            value={draft.slug}
            onChange={(v) => {
              setSlugManuallyEdited(true)
              patch({ slug: slugify(v) })
            }}
            placeholder="fascinoma-2026-cdmx"
            mono
            required
          />
          <Toggle
            label="EDITORIAL (boostea HP inicial)"
            value={!!draft.editorial}
            onChange={(v) => patch({ editorial: v })}
          />
          <PartnerAttributionField
            draft={draft}
            onChange={(v) => patch({ attributePartner: v })}
          />
        </Section>

        <Section label="02" title="FECHAS">
          <TextField
            label="INICIO"
            value={isoToLocal(draft.date)}
            onChange={(v) => patch({ date: localToIso(v) })}
            type="datetime-local"
            mono
            required
          />
          <TextField
            label="FIN (opcional)"
            value={isoToLocal(draft.endDate)}
            onChange={(v) => patch({ endDate: localToIso(v) })}
            type="datetime-local"
            mono
          />
        </Section>

        <Section label="03" title="UBICACIÓN">
          <TextField
            label="VENUE"
            value={draft.venue ?? ''}
            onChange={(v) => patch({ venue: v })}
            placeholder="Club Japan"
          />
          <TextField
            label="CIUDAD / DIRECCIÓN"
            value={draft.venueCity ?? ''}
            onChange={(v) => patch({ venueCity: v })}
            placeholder="CDMX · Monterrey 56, Roma Norte"
          />
          {/* Entity links — venue/promotora as first-class scene rows. The
              free-text fields above stay as a fallback for quick drafts and
              legacy events; the CONTEXTO rail prefers these when present. */}
          <EntityMultiSelect
            kind="venue"
            value={draft.entities ?? []}
            onChange={(entities) => patch({ entities })}
          />
          <EntityMultiSelect
            kind="promoter"
            value={draft.entities ?? []}
            onChange={(entities) => patch({ entities })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="PAÍS"
              value={draft.country ?? ''}
              onChange={(v) => patch({ country: v })}
              placeholder="México"
            />
            <TextField
              label="AÑO"
              value={draft.year?.toString() ?? ''}
              onChange={(v) =>
                patch({ year: v === '' ? undefined : Number(v) })
              }
              type="number"
              placeholder="2026"
              mono
            />
          </div>
        </Section>

        <Section label="04" title="LINE-UP">
          {/* Artist entities carry through to the CONTEXTO rail + per-artist
              filter; the free-text list below is the quick-draft fallback. */}
          <EntityMultiSelect
            kind="artist"
            value={draft.entities ?? []}
            onChange={(entities) => patch({ entities })}
          />
          <StringListField
            label="ARTISTAS (texto libre)"
            placeholder="Surgeon"
            values={draft.artists ?? []}
            onChange={(artists) => patch({ artists })}
            addLabel="AÑADIR ARTISTA"
          />
        </Section>

        <Section label="05" title="COPY">
          <TextArea
            label="EXCERPT"
            value={draft.excerpt ?? ''}
            onChange={(v) => patch({ excerpt: v })}
            rows={3}
            placeholder="La décima edición del festival…"
          />
        </Section>

        <Section label="06" title="VIBE + GÉNEROS">
          <VibeField valueMin={draft.vibeMin} valueMax={draft.vibeMax} onChange={(min, max) => patch({ vibeMin: min, vibeMax: max })} />
          <VibePriorHint
            genres={draft.genres}
            venue={draft.venue}
            currentMin={draft.vibeMin}
            currentMax={draft.vibeMax}
            onApply={(min, max) => patch({ vibeMin: min, vibeMax: max })}
          />
          <GenreMultiSelect
            value={draft.genres}
            onChange={(genres) => patch({ genres })}
          />
        </Section>

        <Section label="07" title="MEDIA + BOLETOS">
          <ImageUrlField
            label="FLYER URL"
            value={draft.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/ev-fascinoma-2026.jpg"
          />
          <TextField
            label="TICKET URL"
            value={draft.ticketUrl ?? ''}
            onChange={(v) => patch({ ticketUrl: v })}
            placeholder="https://boletos.com/..."
            mono
          />
          <TextField
            label="PRECIO"
            value={draft.price ?? ''}
            onChange={(v) => patch({ price: v })}
            placeholder="$800 early · $1200 general"
          />
          {/* Extra outbound links beyond TICKET — event page, RSVP, source. */}
          <LinkListField
            label="ENLACES"
            values={draft.links ?? []}
            onChange={(links) => patch({ links })}
            presets={['Sitio', 'RSVP', 'Fuente']}
          />
        </Section>

        <Section label="08" title="ENCUESTA (opcional)">
          <PollFieldset
            type={draft.type}
            poll={draft.poll}
            onChange={(poll) => patch({ poll: poll ?? undefined })}
          />
        </Section>

        <SubmitFooter
          canSubmit={canSubmit}
          errors={errors}
          onSaveDraft={workbench.saveDraft}
          onPublish={onPublish}
          onReset={onReset}
          flash={workbench.flash}
          lastSavedAt={workbench.lastSavedAt}
          isPublished={workbench.isPublished}
        />
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <LivePreview draft={draft} />
      </div>
    </div>
  )
}
