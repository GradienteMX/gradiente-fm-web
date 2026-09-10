'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { useAuth } from '@/components/auth/useAuth'
import type { ContentItem } from '@/lib/types'
import {
  patchDraftContent,
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


  const patch = (p: Partial<ContentItem>) => {
    setDraft((d) => patchDraftContent(d, p, slugManuallyEdited))
  }

  // Single required-truth source (dark rules: TÍTULO · SLUG · CUERPO).
  const checklist = requiredFields('opinion', draft)
  const errors = errorsFrom(checklist)
  const canSubmit = errors.length === 0


  const showEditorial =
    currentUser?.role === 'guide' || currentUser?.role === 'admin'
  const showFranja = !!currentUser?.franjaId
  const franjaValue = draft.attributeFranja ?? !!draft.franjaId

  const onAnchor = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ block: 'start' })
  }

  return (
    <ComposeLayout
      typeLabel={composeTypeDisplay('opinion')}
      isEdit={!!editItemId}
      draft={draft}
      setDraft={setDraft}
      workbench={workbench}
      onClose={onClose}
      rail={
        <ComposeRail
          checklist={checklist}
          completeness={completeness(checklist)}
          canSubmit={canSubmit}
          flash={workbench.flash}
          canSave={workbench.canSave}
          isPublished={workbench.isPublished}
          publishMode={workbench.publishMode}
          typeLabel={composeTypeLabel('opinion')}
          showEditorial={showEditorial}
          editorialValue={!!draft.editorial}
          onEditorialChange={(v) => patch({ editorial: v })}
          showFranja={showFranja}
          franjaValue={franjaValue}
          onFranjaChange={(v) => patch({ attributeFranja: v })}
          onSave={workbench.saveDraft}
          onSaveAndClose={async () => {
            if (await workbench.saveDraft()) onClose()
          }}
          onPublish={onPublish}
          onAnchor={onAnchor}
        />
      }
    >
      <PliegoSection number="01" label="IDENTIDAD" required>
        <div className="grid gap-4">
          <TextFieldL
            id={COMPOSE_ANCHOR_IDS.title}
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="Título de la columna"
            required
          />
        </div>

</PliegoSection>

      <PliegoSection number="meta" label="Firma, subtítulo y enlace (opcional)">

          <TextFieldL
            label="Subtítulo (opcional)"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
          />
          <div className="grid gap-4 pt-3">
        <div className="grid gap-4">
          <TextFieldL
            label="Firma (opcional)"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Nombre del columnista"
          />
          <TextFieldL
            label="Minutos de lectura (opcional)"
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
                </div>

      </PliegoSection>

      <PliegoSection number="02" label="COPY" required>

        <TextAreaL
          id={COMPOSE_ANCHOR_IDS.body}
          label="Texto completo"
          placeholder="Plantea tu postura y apóyala con un ejemplo concreto…"
          value={draft.bodyPreview ?? ''}
          onChange={(v) => patch({ bodyPreview: v })}
          required
          rows={12}
        />

      </PliegoSection>

      <PliegoSection number="summary" label="Resumen para la tarjeta (opcional)">
        <TextAreaL
          label="Resumen para la tarjeta"
          value={draft.excerpt ?? ''}
          onChange={(v) => patch({ excerpt: v })}
          rows={3}
          maxLength={280}
          placeholder="Una sola línea — el argumento principal…"
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
