'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import type { ContentItem } from '@/lib/types'
import { LivePreview } from '@/components/dashboard/LivePreview'
import {
  Section,
  TextField,
  TextArea,
  Toggle,
  VibeField,
  GenreMultiSelect,
  ImageUrlField,
  SubmitFooter,
  slugify,
  useDraftWorkbench,
} from './shared/Fields'
import { PollFieldset } from './shared/PollFieldset'

const DRAFT_KEY = 'gradiente:dashboard:editorial-draft'

function emptyDraft(): ContentItem {
  return {
    id: 'draft-editorial',
    slug: '',
    type: 'editorial',
    title: '',
    subtitle: '',
    excerpt: '',
    bodyPreview: '',
    vibe: 5,
    genres: [],
    tags: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    author: '',
    readTime: undefined,
    editorial: true, // editorials default to editorial-flagged
  }
}

export function EditorialForm() {
  const [draft, setDraft] = useState<ContentItem>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const router = useRouter()
  const search = useSearchParams()
  const editItemId = search?.get('edit') ?? null
  const { setCategoryFilter } = useVibe()
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
    router.push(`/?pending=${id}`)
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
  const canSubmit = errors.length === 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5">
        <Section label="01" title="IDENTIDAD">
          <TextField
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="Club Japan y la pedagogía de la oscuridad"
            required
          />
          <TextField
            label="SUBTÍTULO / DEK"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Lo que se aprende en la sala más oscura de la Roma Norte"
          />
          <TextField
            label="SLUG"
            value={draft.slug}
            onChange={(v) => {
              setSlugManuallyEdited(true)
              patch({ slug: slugify(v) })
            }}
            placeholder="club-japan-pedagogia-oscuridad"
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
            placeholder="9"
            mono
          />
          <Toggle
            label="EDITORIAL (HP inicial elevado)"
            value={!!draft.editorial}
            onChange={(v) => patch({ editorial: v })}
          />
        </Section>

        <Section label="02" title="COPY">
          <TextArea
            label="EXCERPT (lead editorial)"
            value={draft.excerpt ?? ''}
            onChange={(v) => patch({ excerpt: v })}
            rows={3}
            placeholder="La pedagogía de la oscuridad no se enseña…"
          />
          <TextArea
            label="BODY (párrafos separados por línea en blanco)"
            value={draft.bodyPreview ?? ''}
            onChange={(v) => patch({ bodyPreview: v })}
            rows={14}
            placeholder="Lo primero que se aprende es dejar de buscar con los ojos…"
          />
        </Section>

        <Section label="03" title="VIBE + GÉNEROS">
          <VibeField value={draft.vibe} onChange={(v) => patch({ vibe: v })} />
          <GenreMultiSelect
            value={draft.genres}
            onChange={(genres) => patch({ genres })}
          />
        </Section>

        <Section label="04" title="MEDIA">
          <ImageUrlField
            value={draft.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/ed-001.jpg"
          />
        </Section>

        <Section label="05" title="ENCUESTA (opcional)">
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
