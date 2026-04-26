'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { useDraftItems, removeItem, type DraftItem } from '@/lib/drafts'
import { categoryColor } from '@/lib/utils'

import { ExplorerShell } from '@/components/dashboard/explorer/ExplorerShell'
import { ExplorerWindow } from '@/components/dashboard/explorer/ExplorerWindow'
import {
  ExplorerToolbar,
  defaultToolbarActions,
} from '@/components/dashboard/explorer/ExplorerToolbar'
import { ViewControls, type ViewMode } from '@/components/dashboard/explorer/ViewControls'

import {
  NuevoSection,
  selectionForType,
} from '@/components/dashboard/explorer/sections/NuevoSection'
import { DraftsSection } from '@/components/dashboard/explorer/sections/DraftsSection'
import { ProfileSection } from '@/components/dashboard/explorer/sections/ProfileSection'
import { HomeSection } from '@/components/dashboard/explorer/sections/HomeSection'
import { GuardadosSection } from '@/components/dashboard/explorer/sections/GuardadosSection'
import { SavedCommentsSection } from '@/components/dashboard/explorer/sections/SavedCommentsSection'

import { MixForm } from '@/components/dashboard/forms/MixForm'
import { ListicleForm } from '@/components/dashboard/forms/ListicleForm'
import { EventoForm } from '@/components/dashboard/forms/EventoForm'
import { ReviewForm } from '@/components/dashboard/forms/ReviewForm'
import { EditorialForm } from '@/components/dashboard/forms/EditorialForm'
import { OpinionForm } from '@/components/dashboard/forms/OpinionForm'
import { ArticuloForm } from '@/components/dashboard/forms/ArticuloForm'
import { NoticiaForm } from '@/components/dashboard/forms/NoticiaForm'

import type { ContentType } from '@/lib/types'
import type { ExplorerSection, SelectionMeta } from '@/components/dashboard/explorer/types'

type SupportedType = Extract<
  ContentType,
  'evento' | 'mix' | 'noticia' | 'review' | 'listicle' | 'editorial' | 'opinion' | 'articulo'
>

const SUPPORTED: SupportedType[] = [
  'mix',
  'listicle',
  'articulo',
  'evento',
  'review',
  'editorial',
  'opinion',
  'noticia',
]

const VALID_SECTIONS: ExplorerSection[] = [
  'home',
  'nuevo',
  'drafts',
  'publicados',
  'profile',
  'guardados-feed',
  'guardados-agenda',
  'guardados-noticias',
  'guardados-reviews',
  'guardados-mixes',
  'guardados-editoriales',
  'guardados-articulos',
  'guardados-comentarios',
]

function isSupportedType(t: string | null): t is SupportedType {
  return !!t && (SUPPORTED as string[]).includes(t)
}
function isSection(s: string | null): s is ExplorerSection {
  return !!s && (VALID_SECTIONS as string[]).includes(s)
}

const SECTION_LABEL: Record<ExplorerSection, string> = {
  home: 'Dashboard',
  nuevo: 'Nuevo contenido',
  drafts: 'Drafts',
  publicados: 'Publicados',
  profile: 'Perfil',
  'guardados-feed': 'Guardados · Feed',
  'guardados-agenda': 'Guardados · Agenda',
  'guardados-noticias': 'Guardados · Noticias',
  'guardados-reviews': 'Guardados · Reviews',
  'guardados-mixes': 'Guardados · Mixes',
  'guardados-editoriales': 'Guardados · Editoriales',
  'guardados-articulos': 'Guardados · Artículos',
  'guardados-comentarios': 'Guardados · Comentarios',
}

const SECTION_WINDOW_TITLE: Record<ExplorerSection, string> = {
  home: 'DASHBOARD',
  nuevo: 'NUEVO CONTENIDO',
  drafts: 'DRAFTS',
  publicados: 'PUBLICADOS',
  profile: 'PERFIL',
  'guardados-feed': 'GUARDADOS · FEED',
  'guardados-agenda': 'GUARDADOS · AGENDA',
  'guardados-noticias': 'GUARDADOS · NOTICIAS',
  'guardados-reviews': 'GUARDADOS · REVIEWS',
  'guardados-mixes': 'GUARDADOS · MIXES',
  'guardados-editoriales': 'GUARDADOS · EDITORIALES',
  'guardados-articulos': 'GUARDADOS · ARTÍCULOS',
  'guardados-comentarios': 'GUARDADOS · COMENTARIOS',
}

export default function DashboardPage() {
  const { isAuthed, username, openLogin } = useAuth()
  const router = useRouter()
  const search = useSearchParams()

  const rawSection = search?.get('section') ?? null
  const rawType = search?.get('type') ?? null
  const section: ExplorerSection = isSection(rawSection) ? rawSection : 'home'
  const composeType: SupportedType | null = isSupportedType(rawType) ? rawType : null
  const editingId = search?.get('edit') ?? null

  const [hydrated, setHydrated] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedTplType, setSelectedTplType] = useState<SupportedType | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)

  const draftItems = useDraftItems()
  const draftCount = draftItems.filter((i) => i._draftState === 'draft').length
  const publishedCount = draftItems.filter((i) => i._draftState === 'published').length
  // Guardados isn't wired yet — saved-from-feed surface doesn't exist on the
  // public side. When it does, this becomes a real count.
  const savedCount = 0
  const lastEditedAt = useMemo(() => {
    if (draftItems.length === 0) return null
    return draftItems
      .map((i) => i._updatedAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  }, [draftItems])

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthed) openLogin()
  }, [hydrated, isAuthed, openLogin])

  // Reset section-local selections when navigating between sections.
  useEffect(() => {
    setSelectedDraftId(null)
    setSelectedTplType(null)
  }, [section])

  const navigateSection = useCallback(
    (next: ExplorerSection) => {
      router.push(next === 'home' ? '/dashboard' : `/dashboard?section=${next}`)
    },
    [router],
  )

  const openCompose = useCallback(
    (type: SupportedType, opts?: { editId?: string }) => {
      const params = new URLSearchParams()
      params.set('section', 'nuevo')
      params.set('type', type)
      if (opts?.editId) params.set('edit', opts.editId)
      router.push(`/dashboard?${params.toString()}`)
    },
    [router],
  )

  const openDraft = useCallback(
    (item: DraftItem) => {
      if (!isSupportedType(item.type)) return
      openCompose(item.type as SupportedType, { editId: item.id })
    },
    [openCompose],
  )

  if (!hydrated) return null

  if (!isAuthed) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 py-20 text-center">
        <span
          className="inline-flex items-center gap-2 border px-3 py-1 font-mono text-[10px] tracking-widest"
          style={{ borderColor: '#E63329', color: '#E63329' }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-red" />
          ACCESO RESTRINGIDO
        </span>
        <h1 className="font-syne text-3xl font-black text-primary">
          IDENTIFÍCATE PARA CONTINUAR
        </h1>
        <p className="max-w-md font-mono text-xs leading-relaxed text-secondary">
          El dashboard está reservado para editores, redacción y partners del
          subsistema. Inicia sesión desde el badge en el header.
        </p>
        <button
          onClick={openLogin}
          className="mt-2 border px-4 py-2 font-mono text-[11px] tracking-widest transition-colors"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          ▶ ABRIR LOGIN
        </button>
      </div>
    )
  }

  // ── Compose mode (form) ──────────────────────────────────────────────────
  if (composeType) {
    return (
      <ExplorerShell
        active="nuevo"
        onPick={navigateSection}
        draftCount={draftCount}
        publishedCount={publishedCount}
        savedCount={savedCount}
        lastEditedAt={lastEditedAt}
        breadcrumbs={[
          { label: `UNIT·AUTHED · @${username ?? '—'}`, variant: 'badge-green' },
          { label: 'admin', variant: 'accent' },
          { label: 'Dashboard', onClick: () => navigateSection('home') },
          {
            label: 'Nuevo contenido',
            onClick: () => navigateSection('nuevo'),
          },
          { label: composeType.toUpperCase() + (editingId ? ' · EDITAR' : '') },
        ]}
        hideDetails
      >
        <ExplorerWindow
          title={`COMPONER · ${composeType.toUpperCase()}`}
          toolbar={
            <button
              type="button"
              onClick={() => navigateSection('nuevo')}
              className="ml-1 flex items-center gap-2 border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-secondary hover:text-primary"
            >
              ← VOLVER A PLANTILLAS
            </button>
          }
        >
          <FormForType type={composeType} />
        </ExplorerWindow>
      </ExplorerShell>
    )
  }

  // ── Section view ─────────────────────────────────────────────────────────
  return (
    <ExplorerShell
      active={section}
      onPick={navigateSection}
      draftCount={draftCount}
      publishedCount={publishedCount}
      savedCount={savedCount}
      lastEditedAt={lastEditedAt}
      breadcrumbs={breadcrumbsFor({ section, username })}
      selection={selectionForCurrent({
        section,
        selectedTplType,
        selectedDraftId,
        draftItems,
      })}
      detailsCta={detailsCtaFor({
        section,
        selectedTplType,
        selectedDraftId,
        draftItems,
        openCompose,
        openDraft,
      })}
      hideDetails={section === 'profile' || section === 'home'}
    >
      <ExplorerWindow
        title={SECTION_WINDOW_TITLE[section]}
        toolbar={
          <ExplorerToolbar
            actions={defaultToolbarActions({
              onNew:
                section === 'drafts' || section === 'publicados' || section === 'nuevo'
                  ? () => navigateSection('nuevo')
                  : undefined,
              onUp: section !== 'home' ? () => navigateSection('home') : undefined,
              hasSelection: !!selectedDraftId,
              onDelete:
                section === 'drafts' && selectedDraftId
                  ? () => {
                      removeItem(selectedDraftId)
                      setSelectedDraftId(null)
                    }
                  : undefined,
            })}
          />
        }
        countLabel={countLabelFor({ section, draftItems })}
        viewControls={
          shouldShowViewControls(section) ? (
            <ViewControls mode={viewMode} onChange={setViewMode} />
          ) : null
        }
      >
        <SectionBody
          section={section}
          username={username}
          draftCount={draftCount}
          publishedCount={publishedCount}
          draftItems={draftItems}
          selectedTplType={selectedTplType}
          selectedDraftId={selectedDraftId}
          onPickType={(t) => setSelectedTplType(t)}
          onOpenType={(t) => openCompose(t)}
          onSelectDraft={(id) => setSelectedDraftId(id)}
          onOpenDraft={openDraft}
          navigate={navigateSection}
        />
      </ExplorerWindow>
    </ExplorerShell>
  )
}

// ── Section body dispatch ───────────────────────────────────────────────────

function SectionBody({
  section,
  username,
  draftCount,
  publishedCount,
  draftItems,
  selectedTplType,
  selectedDraftId,
  onPickType,
  onOpenType,
  onSelectDraft,
  onOpenDraft,
  navigate,
}: {
  section: ExplorerSection
  username: string | null
  draftCount: number
  publishedCount: number
  draftItems: DraftItem[]
  selectedTplType: SupportedType | null
  selectedDraftId: string | null
  onPickType: (t: SupportedType) => void
  onOpenType: (t: SupportedType) => void
  onSelectDraft: (id: string | null) => void
  onOpenDraft: (item: DraftItem) => void
  navigate: (s: ExplorerSection) => void
}) {
  switch (section) {
    case 'home':
      return (
        <HomeSection
          username={username}
          draftCount={draftCount}
          publishedCount={publishedCount}
          onPick={navigate}
        />
      )
    case 'nuevo':
      return (
        <NuevoSection
          supported={SUPPORTED}
          selectedType={selectedTplType}
          onSelect={onPickType}
          onOpen={onOpenType}
        />
      )
    case 'drafts':
      return (
        <DraftsSection
          items={draftItems}
          selectedId={selectedDraftId}
          onSelect={onSelectDraft}
          onOpen={onOpenDraft}
          stateFilter="draft"
          namespace="drafts"
        />
      )
    case 'publicados':
      return (
        <DraftsSection
          items={draftItems}
          selectedId={selectedDraftId}
          onSelect={onSelectDraft}
          onOpen={onOpenDraft}
          stateFilter="published"
          namespace="publicados"
        />
      )
    case 'profile':
      return <ProfileSection />
    case 'guardados-feed':
      return <GuardadosSection filter={null} />
    case 'guardados-agenda':
      return <GuardadosSection filter="evento" />
    case 'guardados-noticias':
      return <GuardadosSection filter="noticia" />
    case 'guardados-reviews':
      return <GuardadosSection filter="review" />
    case 'guardados-mixes':
      return <GuardadosSection filter="mix" />
    case 'guardados-editoriales':
      return <GuardadosSection filter="editorial" />
    case 'guardados-articulos':
      return <GuardadosSection filter="articulo" />
    case 'guardados-comentarios':
      return <SavedCommentsSection />
    default:
      return null
  }
}

// ── Helpers — selection / details / breadcrumb ──────────────────────────────

function breadcrumbsFor({
  section,
  username,
}: {
  section: ExplorerSection
  username: string | null
}) {
  const base = [
    { label: `UNIT·AUTHED · @${username ?? '—'}`, variant: 'badge-green' as const },
    { label: 'admin', variant: 'accent' as const },
  ]
  if (section === 'home') return [...base, { label: 'Dashboard' }]
  // Guardados sections show the folder in the trail.
  if (section.startsWith('guardados-')) {
    return [
      ...base,
      { label: 'Dashboard' },
      { label: 'Guardados' },
      { label: SECTION_LABEL[section].replace(/^Guardados · /, '') },
    ]
  }
  return [...base, { label: 'Dashboard' }, { label: SECTION_LABEL[section] }]
}

function selectionForCurrent({
  section,
  selectedTplType,
  selectedDraftId,
  draftItems,
}: {
  section: ExplorerSection
  selectedTplType: SupportedType | null
  selectedDraftId: string | null
  draftItems: DraftItem[]
}): SelectionMeta | null {
  if (section === 'nuevo' && selectedTplType) {
    return selectionForType(selectedTplType)
  }
  if ((section === 'drafts' || section === 'publicados') && selectedDraftId) {
    const item = draftItems.find((i) => i.id === selectedDraftId)
    if (!item) return null
    return draftSelection(item)
  }
  return null
}

function draftSelection(item: DraftItem): SelectionMeta {
  const color = categoryColor(item.type)
  const isDraft = item._draftState === 'draft'
  return {
    id: item.id,
    label: item.title || '[sin título]',
    kind: typeKindLabel(item.type),
    color,
    description: item.excerpt || '—',
    extra: [
      {
        key: 'ESTADO',
        value: isDraft ? 'Draft' : 'Publicado',
        valueColor: isDraft ? '#F97316' : '#4ADE80',
      },
      { key: 'SLUG', value: item.slug || '—' },
      { key: 'AUTOR', value: item.author ?? 'admin' },
      {
        key: 'MODIFICADO',
        value: fmtDateTime(item._updatedAt),
      },
      { key: 'VIBE', value: String(item.vibe ?? 0) },
    ],
  }
}

function typeKindLabel(t: ContentType): string {
  switch (t) {
    case 'mix': return 'Mix'
    case 'listicle': return 'Lista'
    case 'evento': return 'Evento'
    case 'review': return 'Review'
    case 'editorial': return 'Editorial'
    case 'opinion': return 'Opinión'
    case 'articulo': return 'Artículo'
    case 'noticia': return 'Noticia'
    case 'partner': return 'Partner'
  }
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 16).replace('T', ' ')
  } catch {
    return '—'
  }
}

function detailsCtaFor({
  section,
  selectedTplType,
  selectedDraftId,
  draftItems,
  openCompose,
  openDraft,
}: {
  section: ExplorerSection
  selectedTplType: SupportedType | null
  selectedDraftId: string | null
  draftItems: DraftItem[]
  openCompose: (t: SupportedType) => void
  openDraft: (item: DraftItem) => void
}) {
  if (section === 'nuevo' && selectedTplType) {
    return {
      label: 'USAR ESTA PLANTILLA',
      onClick: () => openCompose(selectedTplType),
    }
  }
  if (selectedDraftId) {
    const item = draftItems.find((i) => i.id === selectedDraftId)
    if (item) {
      return {
        label: 'ABRIR EN EDITOR',
        onClick: () => openDraft(item),
      }
    }
  }
  return undefined
}

function shouldShowViewControls(section: ExplorerSection): boolean {
  return ['nuevo', 'drafts', 'publicados'].includes(section)
}

function countLabelFor({
  section,
  draftItems,
}: {
  section: ExplorerSection
  draftItems: DraftItem[]
}): string | undefined {
  if (section === 'nuevo') return `▸ ${SUPPORTED.length} elementos`
  if (section === 'drafts') {
    const n = draftItems.filter((i) => i._draftState === 'draft').length
    return `▸ ${n} ${n === 1 ? 'elemento' : 'elementos'}`
  }
  if (section === 'publicados') {
    const n = draftItems.filter((i) => i._draftState === 'published').length
    return `▸ ${n} ${n === 1 ? 'elemento' : 'elementos'}`
  }
  return undefined
}

// ── Form dispatch ───────────────────────────────────────────────────────────

function FormForType({ type }: { type: SupportedType }) {
  switch (type) {
    case 'mix':
      return <MixForm />
    case 'listicle':
      return <ListicleForm />
    case 'articulo':
      return <ArticuloForm />
    case 'evento':
      return <EventoForm />
    case 'review':
      return <ReviewForm />
    case 'editorial':
      return <EditorialForm />
    case 'opinion':
      return <OpinionForm />
    case 'noticia':
      return <NoticiaForm />
  }
}
