'use client'

// ── OpinionCompose — «EL PLIEGO DE COMPOSICIÓN v2» light form for opinión ───
//
// State preamble copied VERBATIM from the dark OpinionForm
// (components/dashboard/forms/OpinionForm.tsx — untouched, /admin depends):
// same emptyDraft, same DRAFT_KEY, same slug effect, same workbench wiring,
// same publish recipe. Only the JSX is pliego.
//
// EDITORIAL and VINCULAR A MI PROMOTORA move to the rail's PUBLICACIÓN panel:
// editorial lever is staff-only (guide/admin — app/api/items isStaff), the
// partner stamp is partner-team only (opinión is a stamped scene-voice type —
// PartnerAttributionField parity).

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { useAuth } from '@/components/auth/useAuth'
import type { ContentItem } from '@/lib/types'
import {
  slugify,
  useDraftWorkbench,
} from '@/components/dashboard/forms/shared/Fields'
import {
  composeTypeDisplay,
  composeTypeLabel,
} from '@/components/dashboard/widgets/cultivar/CrearZone'
import { ComposeLayout } from '@/components/dashboard/compose/editor/ComposeLayout'
import { ComposeRail } from '@/components/dashboard/compose/editor/ComposeRail'
import {
  COMPOSE_ANCHOR_IDS,
  completeness,
  errorsFrom,
  requiredFields,
} from '@/components/dashboard/compose/requiredFields'
import { PliegoSection } from '@/components/dashboard/compose/kit/PliegoSection'
import { TextFieldL, TextAreaL } from '@/components/dashboard/compose/kit/fields'
import { SlugRow } from '@/components/dashboard/compose/kit/SlugRow'
import { VibeFieldL } from '@/components/dashboard/compose/kit/VibeFieldL'
import { VibePriorHintL } from '@/components/dashboard/compose/kit/VibePriorHintL'
import { GenreMultiSelectL } from '@/components/dashboard/compose/kit/GenreMultiSelectL'
import { ImageFieldL } from '@/components/dashboard/compose/kit/ImageFieldL'
import { EntityMultiSelectL } from '@/components/dashboard/compose/kit/EntityMultiSelectL'
import { LinkListFieldL } from '@/components/dashboard/compose/kit/LinkListFieldL'
import { PollFieldsetL } from '@/components/dashboard/compose/kit/PollFieldsetL'

const DRAFT_KEY = 'gradiente:dashboard:opinion-draft'

function emptyDraft(): ContentItem {
  return {
    id: 'draft-opinion',
    slug: '',
    type: 'opinion',
    title: '',
    subtitle: '',
    excerpt: '',
    bodyPreview: '',
    vibeMin: 5, vibeMax: 5,
    genres: [],
    tags: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    author: '',
    readTime: undefined,
    editorial: false,
  }
}

export function OpinionCompose({ onClose }: { onClose: () => void }) {
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
  const checklist = requiredFields('opinion', draft)
  const errors = errorsFrom(checklist)
  const canSubmit = errors.length === 0

  const hydrating = !!editItemId && workbench.lastSavedAt === null && !draft.title

  const showEditorial =
    currentUser?.role === 'guide' || currentUser?.role === 'admin'
  const showPartner = !!currentUser?.partnerId
  const partnerValue = draft.attributePartner ?? !!draft.partnerId

  const onAnchor = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ block: 'start' })
  }

  return (
    <ComposeLayout
      typeLabel={composeTypeDisplay('opinion')}
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
          typeLabel={composeTypeLabel('opinion')}
          showEditorial={showEditorial}
          editorialValue={!!draft.editorial}
          onEditorialChange={(v) => patch({ editorial: v })}
          showPartner={showPartner}
          partnerValue={partnerValue}
          onPartnerChange={(v) => patch({ attributePartner: v })}
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
            placeholder="Título de la columna"
            required
          />
          <TextFieldL
            label="SUBTÍTULO / DEK"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextFieldL
            label="FIRMA"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Nombre del columnista"
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

      <PliegoSection number="02" label="COPY" required>
        <TextAreaL
          label="EXCERPT (UNA LÍNEA)"
          value={draft.excerpt ?? ''}
          onChange={(v) => patch({ excerpt: v })}
          rows={3}
          maxLength={280}
          placeholder="Una sola línea — el argumento principal…"
        />
        <TextAreaL
          id={COMPOSE_ANCHOR_IDS.body}
          label="CUERPO (PÁRRAFOS SEPARADOS POR LÍNEA EN BLANCO)"
          value={draft.bodyPreview ?? ''}
          onChange={(v) => patch({ bodyPreview: v })}
          required
          rows={12}
        />
      </PliegoSection>

      <PliegoSection number="03" label="VIBE + GÉNEROS">
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

      <PliegoSection number="04" label="PORTADA">
        <ImageFieldL
          value={draft.imageUrl ?? ''}
          onChange={(v) => patch({ imageUrl: v })}
        />
      </PliegoSection>

      <PliegoSection number="05" label="CONTEXTO">
        {/* Scene entities the piece is about (→ CONTEXTO rail chips + per-entity
            filter) plus reference / source links (→ //ENLACES row). */}
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
        <LinkListFieldL
          label="ENLACES"
          values={draft.links ?? []}
          onChange={(links) => patch({ links })}
          presets={['Fuente', 'Sitio']}
        />
      </PliegoSection>

      <PliegoSection number="06" label="ENCUESTA (OPCIONAL)">
        <PollFieldsetL
          type={draft.type}
          poll={draft.poll}
          onChange={(poll) => patch({ poll: poll ?? undefined })}
        />
      </PliegoSection>
    </ComposeLayout>
  )
}
