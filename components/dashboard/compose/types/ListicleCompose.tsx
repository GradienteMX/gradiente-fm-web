'use client'

// ── ListicleCompose — «EL PLIEGO DE COMPOSICIÓN v2» light editor for LISTA ──
//
// State/logic preamble copied VERBATIM from the dark ListicleForm
// (components/dashboard/forms/ListicleForm.tsx — untouched, /admin depends):
// draft useState + patch + slugManuallyEdited effect + useDraftWorkbench with
// the EXACT draftKey 'gradiente:dashboard:listicle-draft' + editItemId from
// ?edit= + the publish recipe (requestPublish → setCategoryFilter(null) →
// openConfirm). The 4-kind block editor lives in ListicleBlocksEditor
// (colocated pliego port). Required rules come from requiredFields.ts
// (TÍTULO · SLUG · CUERPO = articleBody non-empty — dark parity).

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { useAuth } from '@/components/auth/useAuth'
import type { ArticleBlock, ContentItem } from '@/lib/types'
import { slugify, useDraftWorkbench } from '@/components/dashboard/forms/shared/Fields'
import {
  composeTypeDisplay,
  composeTypeLabel,
} from '@/components/dashboard/widgets/cultivar/CrearZone'
import {
  COMPOSE_ANCHOR_IDS,
  completeness,
  errorsFrom,
  requiredFields,
} from '@/components/dashboard/compose/requiredFields'
import { ComposeLayout } from '@/components/dashboard/compose/editor/ComposeLayout'
import { ComposeRail } from '@/components/dashboard/compose/editor/ComposeRail'
import { PliegoSection } from '@/components/dashboard/compose/kit/PliegoSection'
import { TextAreaL, TextFieldL } from '@/components/dashboard/compose/kit/fields'
import { SlugRow } from '@/components/dashboard/compose/kit/SlugRow'
import { ImageFieldL } from '@/components/dashboard/compose/kit/ImageFieldL'
import { VibeFieldL } from '@/components/dashboard/compose/kit/VibeFieldL'
import { VibePriorHintL } from '@/components/dashboard/compose/kit/VibePriorHintL'
import { GenreMultiSelectL } from '@/components/dashboard/compose/kit/GenreMultiSelectL'
import { EntityMultiSelectL } from '@/components/dashboard/compose/kit/EntityMultiSelectL'
import { LinkListFieldL } from '@/components/dashboard/compose/kit/LinkListFieldL'
import { PollFieldsetL } from '@/components/dashboard/compose/kit/PollFieldsetL'
import { ListicleBlocksEditor } from './ListicleBlocksEditor'

const DRAFT_KEY = 'gradiente:dashboard:listicle-draft'

// Copied verbatim from ListicleForm.tsx:49-68.
function emptyDraft(): ContentItem {
  return {
    id: 'draft-listicle',
    slug: '',
    type: 'listicle',
    title: '',
    subtitle: '',
    excerpt: '',
    vibeMin: 7, vibeMax: 7,
    genres: [],
    tags: [],
    entities: [],
    imageUrl: '',
    heroCaption: '',
    publishedAt: new Date().toISOString(),
    author: '',
    articleBody: [],
    editorial: true,
  }
}

export function ListicleCompose({ onClose }: { onClose: () => void }) {
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
  // (patch() is the user-edit funnel — the block editor writes through it too;
  // hydration bypasses it) — the head claims «Guardado automático» only after
  // the user actually wrote.
  const [dirty, setDirty] = useState(false)
  const patch = (p: Partial<ContentItem>) => {
    setDirty(true)
    setDraft((d) => ({ ...d, ...p }))
  }
  const blocks = draft.articleBody ?? []
  const setBlocks = (next: ArticleBlock[]) => patch({ articleBody: next })

  // Single required-truth source (dark parity: TÍTULO · SLUG · CUERPO).
  const checklist = requiredFields('listicle', draft)
  const errors = errorsFrom(checklist)
  const canSubmit = errors.length === 0

  const hydrating = !!editItemId && workbench.lastSavedAt === null && !draft.title

  // EDITORIAL is a staff lever (mirror of /api/items: role guide|admin).
  // Franja row: franja-team member + stampable type (listicle is).
  const isStaff = currentUser?.role === 'guide' || currentUser?.role === 'admin'
  const showFranja = !!currentUser?.franjaId

  const onAnchor = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ block: 'start' })
  }

  return (
    <ComposeLayout
      typeLabel={composeTypeDisplay('listicle')}
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
          typeLabel={composeTypeLabel('listicle')}
          showEditorial={isStaff}
          editorialValue={!!draft.editorial}
          onEditorialChange={(v) => patch({ editorial: v })}
          showFranja={showFranja}
          franjaValue={draft.attributeFranja ?? !!draft.franjaId}
          onFranjaChange={(v) => patch({ attributeFranja: v })}
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
            placeholder="Título de la lista"
            required
          />
          <TextFieldL
            label="SUBTÍTULO / DEK"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
          />
        </div>
        <TextFieldL
          label="FIRMA"
          value={draft.author ?? ''}
          onChange={(v) => patch({ author: v })}
          placeholder="Nombre o firma"
        />
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

      <PliegoSection
        number="02"
        label="CUERPO"
        id={COMPOSE_ANCHOR_IDS.body}
        required
      >
        <ListicleBlocksEditor blocks={blocks} onChange={setBlocks} />
      </PliegoSection>

      <PliegoSection number="03" label="COPY">
        <TextAreaL
          label="EXCERPT (UNA LÍNEA) · EL CUERPO VA EN 02"
          value={draft.excerpt ?? ''}
          onChange={(v) => patch({ excerpt: v })}
          rows={3}
          maxLength={280}
          placeholder="Una línea que presenta la lista…"
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
          label="HERO"
          value={draft.imageUrl ?? ''}
          onChange={(v) => patch({ imageUrl: v })}
        />
        <TextFieldL
          label="CAPTION HERO"
          value={draft.heroCaption ?? ''}
          onChange={(v) => patch({ heroCaption: v })}
          placeholder="Crédito o contexto de la imagen"
        />
      </PliegoSection>

      <PliegoSection number="06" label="CONTEXTO">
        {/* Scene entities the list references — surface in the CONTEXTO rail
            and the per-entity filter. Track-level artists live in each TRACK
            block; these are the list's headline artists/labels. */}
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
        {/* Outbound buy/listen/source links → //ENLACES row in the overlay. */}
        <LinkListFieldL
          label="ENLACES"
          values={draft.links ?? []}
          onChange={(links) => patch({ links })}
          presets={['Bandcamp', 'Spotify', 'Sitio', 'Fuente']}
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
