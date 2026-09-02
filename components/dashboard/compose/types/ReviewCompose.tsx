'use client'

// ── ReviewCompose — «EL PLIEGO DE COMPOSICIÓN v2» light form for reseña ─────
//
// State preamble + subject/format constants copied VERBATIM from the dark
// ReviewForm (components/dashboard/forms/ReviewForm.tsx:30-60 — DELETED in
// fase F; this fork is the only copy): same SUBJECTS / FORMATS_BY_SUBJECT / isHappening, same
// emptyDraft, same DRAFT_KEY, same slug effect, same workbench wiring, same
// publish recipe. Only the JSX is pliego.
//
// NO rating field — none exists anywhere in the system (deliberate; never
// render fake affordances). The 02 RESEÑA section carries the subject chips
// (single-select), the conditional venue/promotora entity selects for
// happenings, PAÍS/AÑO, and the conditional FORMATO chips for objects.
// EDITORIAL moves to the rail, staff-gated; review is house-voice → no
// franja attribution row (parity with the dark form).

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { useAuth } from '@/components/auth/useAuth'
import type { ContentItem, ItemFormat, ItemSubjectKind } from '@/lib/types'
import {
  slugify,
  useDraftWorkbench,
} from '@/components/dashboard/forms/shared/Fields'
import {
  composeTypeDisplay,
  composeTypeLabel,
} from '@/components/dashboard/widgets/cultivar/CrearZone'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { ComposeLayout } from '@/components/dashboard/compose/editor/ComposeLayout'
import { ComposeRail } from '@/components/dashboard/compose/editor/ComposeRail'
import {
  COMPOSE_ANCHOR_IDS,
  completeness,
  errorsFrom,
  requiredFields,
} from '@/components/dashboard/compose/requiredFields'
import { PliegoSection } from '@/components/dashboard/compose/kit/PliegoSection'
import {
  FieldLabelL,
  TextFieldL,
  TextAreaL,
} from '@/components/dashboard/compose/kit/fields'
import { SlugRow } from '@/components/dashboard/compose/kit/SlugRow'
import { VibeFieldL } from '@/components/dashboard/compose/kit/VibeFieldL'
import { VibePriorHintL } from '@/components/dashboard/compose/kit/VibePriorHintL'
import { GenreMultiSelectL } from '@/components/dashboard/compose/kit/GenreMultiSelectL'
import { ImageFieldL } from '@/components/dashboard/compose/kit/ImageFieldL'
import { EntityMultiSelectL } from '@/components/dashboard/compose/kit/EntityMultiSelectL'
import { EmbedListL } from '@/components/dashboard/compose/kit/EmbedListL'
import { LinkListFieldL } from '@/components/dashboard/compose/kit/LinkListFieldL'
import { PollFieldsetL } from '@/components/dashboard/compose/kit/PollFieldsetL'

// What the review is *about*. Drives which CONTEXTO fields show (migration
// 0038). DISCO/LIBRO are objects with a format; EVENTO/EXPOSICIÓN are happenings
// with a venue/promoter instead.
const SUBJECTS: { id: ItemSubjectKind; label: string }[] = [
  { id: 'record', label: 'DISCO' },
  { id: 'book', label: 'LIBRO' },
  { id: 'event', label: 'EVENTO' },
  { id: 'exhibition', label: 'EXPOSICIÓN' },
]

// Format chips per subject — see items.format (migrations 0029 + 0038).
// Single-select. Happenings (event/exhibition) carry no format.
const FORMATS_BY_SUBJECT: Record<ItemSubjectKind, { id: ItemFormat; label: string }[]> = {
  record: [
    { id: 'vinyl', label: 'VINYL' },
    { id: 'cassette', label: 'TAPE' },
    { id: 'cd', label: 'CD' },
    { id: 'digital', label: 'DIGITAL' },
    { id: 'mix', label: 'MIX' },
    { id: 'other', label: 'OTRO' },
  ],
  book: [
    { id: 'hardcover', label: 'TAPA DURA' },
    { id: 'paperback', label: 'RÚSTICA' },
    { id: 'ebook', label: 'E-BOOK' },
    { id: 'zine', label: 'ZINE' },
    { id: 'other', label: 'OTRO' },
  ],
  event: [],
  exhibition: [],
}

// Whether the subject is a happening (venue/promoter) vs an object (format).
const isHappening = (s: ItemSubjectKind | undefined) =>
  s === 'event' || s === 'exhibition'

const DRAFT_KEY = 'gradiente:dashboard:review-draft'

function emptyDraft(): ContentItem {
  return {
    id: 'draft-review',
    slug: '',
    type: 'review',
    title: '',
    subtitle: '',
    excerpt: '',
    bodyPreview: '',
    vibeMin: 5, vibeMax: 5,
    genres: [],
    tags: [],
    entities: [],
    subjectKind: 'record',
    format: undefined,
    country: '',
    year: undefined,
    embeds: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    author: '',
    readTime: undefined,
    editorial: false,
  }
}

// Pliego single-select chip (subject / format pickers). ON = acid-on-ink
// (sanctioned on-panel use); OFF = bordered paper. ≥44px touch, ≥36px desktop.
function ChipL({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-cue="tick"
      className={`min-h-11 border px-3 font-mono text-d11 font-bold uppercase tracking-widest md:min-h-9 ${
        on
          ? 'border-ink bg-ink text-acid'
          : 'border-ink bg-paper-raised text-ink hover:bg-ink hover:text-paper'
      } ${FOCUS_RING}`}
    >
      {label}
    </button>
  )
}

export function ReviewCompose({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<ContentItem>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const search = useSearchParams()
  const editItemId = search?.get('edit') ?? null
  const { setCategoryFilter } = useVibe()
  const { openConfirm } = usePublishConfirm()
  const { currentUser } = useAuth()
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
    openConfirm(id, workbench.publishMode)
  }

  useEffect(() => {
    if (!slugManuallyEdited && draft.title) {
      const next = slugify(draft.title)
      setDraft((d) => (d.slug === next ? d : { ...d, slug: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.title, slugManuallyEdited])

  // Autosave-head honesty: `dirty` flips on the FIRST user edit this session
  // (patch() is the user-edit funnel; hydration bypasses it) — the head
  // claims «Guardado automático» only after the user actually wrote.
  const [dirty, setDirty] = useState(false)
  const patch = (p: Partial<ContentItem>) => {
    setDirty(true)
    setDraft((d) => ({ ...d, ...p }))
  }

  // Single required-truth source (dark rules: TÍTULO · SLUG · CUERPO).
  const checklist = requiredFields('review', draft)
  const errors = errorsFrom(checklist)
  const canSubmit = errors.length === 0

  const hydrating = !!editItemId && workbench.lastSavedAt === null && !draft.title

  const showEditorial =
    currentUser?.role === 'guide' || currentUser?.role === 'admin'

  const onAnchor = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ block: 'start' })
  }

  return (
    <ComposeLayout
      typeLabel={composeTypeDisplay('review')}
      isEdit={!!editItemId}
      lastSavedAt={dirty ? workbench.lastSavedAt : null}
      hydrating={hydrating}
      onClose={onClose}
      rail={
        <ComposeRail
          checklist={checklist}
          completeness={completeness(checklist)}
          canSubmit={canSubmit}
          flash={workbench.flash}
          isPublished={workbench.isPublished}
          publishMode={workbench.publishMode}
          typeLabel={composeTypeLabel('review')}
          showEditorial={showEditorial}
          editorialValue={!!draft.editorial}
          onEditorialChange={(v) => patch({ editorial: v })}
          showFranja={false}
          franjaValue={false}
          onFranjaChange={() => {}}
          onSave={workbench.saveDraft}
          onSaveAndClose={() => {
            workbench.saveDraft()
            onClose()
          }}
          onPublish={onPublish}
          onAnchor={onAnchor}
        />
      }
    >
      <PliegoSection number="01" label="IDENTIDAD" required>
        <div className="grid gap-4 md:grid-cols-2">
          <TextFieldL
            id={COMPOSE_ANCHOR_IDS.title}
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="Artista — Título de la obra"
            required
          />
          <TextFieldL
            label="SUBTÍTULO"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Sello · año"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextFieldL
            label="FIRMA"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Nombre o firma"
          />
          <TextFieldL
            label="LECTURA (MIN)"
            value={draft.readTime?.toString() ?? ''}
            onChange={(v) =>
              patch({ readTime: v === '' ? undefined : Number(v) })
            }
            type="number"
            placeholder="6"
            mono
          />
        </div>
        {/* SlugRow's own default («se-genera-del-titulo») is the honest strip. */}
        <SlugRow
          id={COMPOSE_ANCHOR_IDS.slug}
          slug={draft.slug}
          onEdit={(slug) => {
            setSlugManuallyEdited(true)
            patch({ slug })
          }}
        />
      </PliegoSection>

      <PliegoSection number="02" label="RESEÑA">
        {/* Subject switch — what the review is *about*. Toggles which fields
            below make sense (object → formato; happening → venue/promotora). */}
        <div className="flex flex-col gap-2">
          <FieldLabelL label="RESEÑA DE" />
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <ChipL
                key={s.id}
                on={(draft.subjectKind ?? 'record') === s.id}
                label={s.label}
                onClick={() =>
                  patch({
                    subjectKind: s.id,
                    // Clearing format when switching to a happening keeps a
                    // stale vinyl/paperback from leaking onto an event.
                    format: isHappening(s.id) ? undefined : draft.format,
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* Venue/promotora only matter for happenings. */}
        {isHappening(draft.subjectKind) && (
          <>
            <EntityMultiSelectL
              kind="venue"
              value={draft.entities ?? []}
              onChange={(entities) => patch({ entities })}
            />
            <EntityMultiSelectL
              kind="promoter"
              value={draft.entities ?? []}
              onChange={(entities) => patch({ entities })}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <TextFieldL
            label="PAÍS"
            value={draft.country ?? ''}
            onChange={(v) => patch({ country: v })}
          />
          <TextFieldL
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

        {/* Format chips — object subjects only. */}
        {!isHappening(draft.subjectKind) && (
          <div className="flex flex-col gap-2">
            <FieldLabelL label="FORMATO" />
            <div className="flex flex-wrap gap-1.5">
              {FORMATS_BY_SUBJECT[draft.subjectKind ?? 'record'].map((f) => (
                <ChipL
                  key={f.id}
                  on={draft.format === f.id}
                  label={f.label}
                  onClick={() =>
                    patch({ format: draft.format === f.id ? undefined : f.id })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </PliegoSection>

      <PliegoSection number="03" label="COPY" required>
        <TextAreaL
          label="EXCERPT (UNA LÍNEA)"
          value={draft.excerpt ?? ''}
          onChange={(v) => patch({ excerpt: v })}
          rows={2}
          maxLength={280}
          placeholder="Una línea que resume la reseña…"
        />
        <TextAreaL
          id={COMPOSE_ANCHOR_IDS.body}
          label="CUERPO (PÁRRAFOS SEPARADOS POR LÍNEA EN BLANCO)"
          value={draft.bodyPreview ?? ''}
          onChange={(v) => patch({ bodyPreview: v })}
          required
          rows={10}
        />
      </PliegoSection>

      <PliegoSection number="04" label="VIBE + GÉNEROS">
        <VibeFieldL
          valueMin={draft.vibeMin}
          valueMax={draft.vibeMax}
          onChange={(min, max) => patch({ vibeMin: min, vibeMax: max })}
        />
        <VibePriorHintL
          genres={draft.genres}
          currentMin={draft.vibeMin}
          currentMax={draft.vibeMax}
          onApply={(min, max) => patch({ vibeMin: min, vibeMax: max })}
        />
        <GenreMultiSelectL
          value={draft.genres}
          onChange={(genres) => patch({ genres })}
        />
      </PliegoSection>

      <PliegoSection number="05" label="PORTADA">
        <ImageFieldL
          value={draft.imageUrl ?? ''}
          onChange={(v) => patch({ imageUrl: v })}
        />
      </PliegoSection>

      <PliegoSection number="06" label="CONTEXTO">
        {/* Scene entities the reseña is about, playable embeds, and outbound
            buy/read-more links (Bandcamp/Discogs/source → //ENLACES row). */}
        <EntityMultiSelectL
          kind="artist"
          value={draft.entities ?? []}
          onChange={(entities) => patch({ entities })}
        />
        <EntityMultiSelectL
          kind="label"
          value={draft.entities ?? []}
          onChange={(entities) => patch({ entities })}
        />
        <EmbedListL
          embeds={draft.embeds ?? []}
          onChange={(embeds) => patch({ embeds })}
        />
        <LinkListFieldL
          label="ENLACES"
          values={draft.links ?? []}
          onChange={(links) => patch({ links })}
        />
      </PliegoSection>

      <PliegoSection number="07" label="ENCUESTA (OPCIONAL)">
        <PollFieldsetL
          type={draft.type}
          poll={draft.poll}
          onChange={(poll) => patch({ poll: poll ?? undefined })}
        />
      </PliegoSection>
    </ComposeLayout>
  )
}
