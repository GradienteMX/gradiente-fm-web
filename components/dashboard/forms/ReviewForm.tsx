'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import type { ContentItem, ItemFormat } from '@/lib/types'
import { LivePreview } from '@/components/dashboard/LivePreview'
import {
  Section,
  TextField,
  TextArea,
  Toggle,
  VibeField,
  GenreMultiSelect,
  ImageUrlField,
  EmbedList,
  SubmitFooter,
  slugify,
  useDraftWorkbench,
} from './shared/Fields'
import { EntityMultiSelect } from './shared/EntityMultiSelect'
import { PollFieldset } from './shared/PollFieldset'
import { VibePriorHint } from './shared/VibePriorHint'

// Closed format set — see items.format (migration 0029). Single-select chips.
const FORMATS: { id: ItemFormat; label: string }[] = [
  { id: 'vinyl', label: 'VINYL' },
  { id: 'cassette', label: 'TAPE' },
  { id: 'cd', label: 'CD' },
  { id: 'digital', label: 'DIGITAL' },
  { id: 'mix', label: 'MIX' },
  { id: 'other', label: 'OTRO' },
]

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
    format: undefined,
    embeds: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    author: '',
    readTime: undefined,
    editorial: false,
  }
}

export function ReviewForm() {
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
  if (!draft.bodyPreview?.trim()) errors.push('CUERPO')
  const canSubmit = errors.length === 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5">
        <Section label="01" title="IDENTIDAD">
          <TextField
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="PERC TRAX — Forward Pressure EP"
            required
          />
          <TextField
            label="SUBTÍTULO"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Perc Trax · 2026"
          />
          <TextField
            label="SLUG"
            value={draft.slug}
            onChange={(v) => {
              setSlugManuallyEdited(true)
              patch({ slug: slugify(v) })
            }}
            placeholder="perc-trax-forward-pressure"
            mono
            required
          />
          <TextField
            label="FIRMA"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Redacción Gradiente"
          />
          <TextField
            label="LECTURA (min)"
            value={draft.readTime?.toString() ?? ''}
            onChange={(v) =>
              patch({ readTime: v === '' ? undefined : Number(v) })
            }
            type="number"
            placeholder="6"
            mono
          />
          <Toggle
            label="EDITORIAL (boostea HP inicial)"
            value={!!draft.editorial}
            onChange={(v) => patch({ editorial: v })}
          />
        </Section>

        <Section label="02" title="COPY">
          <TextArea
            label="EXCERPT · una línea · el cuerpo va abajo"
            value={draft.excerpt ?? ''}
            onChange={(v) => patch({ excerpt: v })}
            rows={2}
            maxLength={280}
            placeholder="Cinco cortes de puro peso industrial…"
          />
          <TextArea
            label="BODY (párrafos separados por línea en blanco)"
            value={draft.bodyPreview ?? ''}
            onChange={(v) => patch({ bodyPreview: v })}
            required
            rows={10}
            placeholder="El A1 abre sin piedad…"
          />
        </Section>

        <Section label="03" title="VIBE + GÉNEROS">
          <VibeField valueMin={draft.vibeMin} valueMax={draft.vibeMax} onChange={(min, max) => patch({ vibeMin: min, vibeMax: max })} />
          <VibePriorHint
            genres={draft.genres}
            currentMin={draft.vibeMin}
            currentMax={draft.vibeMax}
            onApply={(min, max) => patch({ vibeMin: min, vibeMax: max })}
          />
          <GenreMultiSelect
            value={draft.genres}
            onChange={(genres) => patch({ genres })}
          />
        </Section>

        <Section label="04" title="CONTEXTO">
          <EntityMultiSelect
            kind="artist"
            value={draft.entities ?? []}
            onChange={(entities) => patch({ entities })}
          />
          <EntityMultiSelect
            kind="label"
            value={draft.entities ?? []}
            onChange={(entities) => patch({ entities })}
          />
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

          <div className="flex flex-col gap-2">
            <span className="sys-label">FORMATO</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => {
                const isOn = draft.format === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      patch({ format: isOn ? undefined : f.id })
                    }
                    className="border px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors"
                    style={{
                      borderColor: isOn ? '#F97316' : '#242424',
                      color: isOn ? '#F97316' : '#888',
                      backgroundColor: isOn
                        ? 'rgba(249,115,22,0.12)'
                        : 'transparent',
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <EmbedList
            embeds={draft.embeds ?? []}
            onChange={(embeds) => patch({ embeds })}
          />
        </Section>

        <Section label="05" title="MEDIA">
          <ImageUrlField
            value={draft.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/review-001.jpg"
          />
        </Section>

        <Section label="06" title="ENCUESTA (opcional)">
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
