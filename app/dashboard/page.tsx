'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { canAssignRoles, canCreateContent } from '@/lib/permissions'
import { useDraftItems, type DraftItem } from '@/lib/drafts'
import { useMyPublishedItems } from '@/lib/hooks/useMyPublishedItems'
import { useSavedItems } from '@/lib/hooks/useSavedItems'
import { removePublishedItemLocal } from '@/lib/publishedItemsCache'
import { usePrompt } from '@/components/prompt/usePrompt'
import { categoryColor, vibeRangeLabel } from '@/lib/utils'

import { ExplorerShell } from '@/components/dashboard/explorer/ExplorerShell'
import { ExplorerWindow } from '@/components/dashboard/explorer/ExplorerWindow'
import {
  ExplorerToolbar,
  defaultToolbarActions,
} from '@/components/dashboard/explorer/ExplorerToolbar'
import { ViewControls, type ViewMode } from '@/components/dashboard/explorer/ViewControls'
import { ConfirmOverlay } from '@/components/dashboard/explorer/ConfirmOverlay'
import { HarvestConfirmModal } from '@/components/dashboard/HarvestConfirmModal'

import {
  NuevoSection,
  selectionForType,
} from '@/components/dashboard/explorer/sections/NuevoSection'
import { DraftsSection } from '@/components/dashboard/explorer/sections/DraftsSection'
import { ProfileSection } from '@/components/dashboard/explorer/sections/ProfileSection'
import { HomeSection } from '@/components/dashboard/explorer/sections/HomeSection'
import { GuardadosSection } from '@/components/dashboard/explorer/sections/GuardadosSection'
import { SavedCommentsSection } from '@/components/dashboard/explorer/sections/SavedCommentsSection'
import { PartnerApprovalsSection } from '@/components/dashboard/explorer/sections/PartnerApprovalsSection'
import { MiPartnerSection } from '@/components/dashboard/explorer/sections/MiPartnerSection'

import { MixForm } from '@/components/dashboard/forms/MixForm'
import { ListicleForm } from '@/components/dashboard/forms/ListicleForm'
import { EventoForm } from '@/components/dashboard/forms/EventoForm'
import { ReviewForm } from '@/components/dashboard/forms/ReviewForm'
import { EditorialForm } from '@/components/dashboard/forms/EditorialForm'
import { OpinionForm } from '@/components/dashboard/forms/OpinionForm'
import { ArticuloForm } from '@/components/dashboard/forms/ArticuloForm'
import { NoticiaForm } from '@/components/dashboard/forms/NoticiaForm'

import type { ContentType } from '@/lib/types'
import type {
  ExplorerSection,
  SelectionMeta,
} from '@/components/dashboard/explorer/types'

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
  'aprobaciones-mkt',
  'mi-partner',
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
  'aprobaciones-mkt': 'Marketplace',
  'mi-partner': 'Mi partner',
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
  'aprobaciones-mkt': 'MARKETPLACE · APROBACIONES',
  'mi-partner': 'MI PARTNER',
}

export default function DashboardPage() {
  const { currentUser, isAuthed, authResolved, username, openLogin } = useAuth()
  const router = useRouter()
  const search = useSearchParams()

  const rawSection = search?.get('section') ?? null
  const rawType = search?.get('type') ?? null
  const requestedSection: ExplorerSection = isSection(rawSection) ? rawSection : 'home'
  // Defense-in-depth: non-admin URL access to admin-only sections falls
  // back to home. The sidebar already hides the rows, but URL access
  // shouldn't bypass the gate.
  const isAdmin = canAssignRoles(currentUser)
  const isPartnerTeam = !!currentUser?.partnerId
  const adminOnlySections: ExplorerSection[] = ['aprobaciones-mkt']
  let section: ExplorerSection = requestedSection
  if (adminOnlySections.includes(section) && !isAdmin) section = 'home'
  // Partner-team-only section — only visible to users with partnerId set.
  // Non-partner-team URL access falls back to home, matching the admin
  // pattern.
  if (section === 'mi-partner' && !isPartnerTeam) section = 'home'
  const composeType: SupportedType | null = isSupportedType(rawType) ? rawType : null
  const editingId = search?.get('edit') ?? null

  const [hydrated, setHydrated] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  // Confirm overlay state — replaces the old selectedTplType / selectedDraftId
  // pair. Click on a card opens the overlay; confirm runs the actual action.
  const [confirming, setConfirming] = useState<
    | { kind: 'tpl'; type: SupportedType }
    | { kind: 'draft'; id: string }
    | null
  >(null)

  const dbDrafts = useDraftItems()
  const myPublished = useMyPublishedItems(currentUser?.id ?? null)
  // Synthesize DraftItem-shaped rows for the published items so the rest
  // of the dashboard (DraftsSection, counts, lastEditedAt) keeps consuming
  // a single uniform list. _createdAt/_updatedAt fall back to publishedAt
  // because items don't carry the explicit composer timestamps.
  const draftItems: DraftItem[] = useMemo(() => {
    const publishedAsDrafts: DraftItem[] = myPublished.map((it) => ({
      ...it,
      _draftState: 'published' as const,
      _createdAt: it.publishedAt,
      _updatedAt: it.publishedAt,
    }))
    return [...dbDrafts, ...publishedAsDrafts]
  }, [dbDrafts, myPublished])
  const draftCount = draftItems.filter((i) => i._draftState === 'draft').length
  const publishedCount = draftItems.filter((i) => i._draftState === 'published').length
  const savedItems = useSavedItems()
  const savedCount = savedItems.length

  // Owner-delete from "Publicados" — typed-confirmation gate (BORRAR <title>),
  // then DELETE /api/items/:id. RLS allows owner-or-admin. On success we
  // optimistically drop from the published-items cache (subscribers see the
  // tile vanish) and refresh server components so the home/type pages
  // re-fetch without the row.
  const { typeToConfirm } = usePrompt()
  const onDeletePublished = useCallback(
    async (item: DraftItem) => {
      const title = item.title?.trim() || 'sin título'
      const required = `BORRAR ${title}`
      const confirmed = await typeToConfirm({
        title: `Borrar ${title}`,
        body:
          'Esta acción es permanente. Se eliminará el ítem y por cascada de FK también sus comentarios, guardados, polls, vibe-checks y registros de HP.',
        requiredText: required,
        placeholder: required,
        confirmLabel: 'BORRAR PERMANENTE',
        cancelLabel: 'CANCELAR',
        destructive: true,
      })
      if (!confirmed) return
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        console.error('[delete published]', res.status, await res.text())
        return
      }
      removePublishedItemLocal(item.id)
      // Close the confirm overlay if it was open on this item.
      setConfirming((cur) =>
        cur && cur.kind === 'draft' && cur.id === item.id ? null : cur,
      )
      router.refresh()
    },
    [typeToConfirm, router],
  )

  // ── Harvest state ─────────────────────────────────────────────────────────
  // Track which item the user clicked "COSECHAR" on. When non-null the
  // HarvestConfirmModal renders against it; close + success both clear.
  const [harvestingItem, setHarvestingItem] = useState<DraftItem | null>(null)
  const onHarvestPublished = useCallback((item: DraftItem) => {
    setHarvestingItem(item)
  }, [])
  const onHarvestComplete = useCallback(() => {
    // Refresh server components so the new harvested_at/decay state
    // propagates everywhere the item appears.
    router.refresh()
  }, [router])

  // Content-creation gating. Filter the SUPPORTED template list down to the
  // types this user is authorized to create. See lib/permissions.ts
  // canCreateContent for the per-type tier map. The compose URL is also
  // guarded below — typing `?type=mix` as a non-guide bumps you back to
  // the picker (and shows whatever templates remain).
  const allowedTypes: SupportedType[] = useMemo(
    () => SUPPORTED.filter((t) => canCreateContent(currentUser, t)),
    [currentUser],
  )
  const composeBlocked =
    composeType !== null && !canCreateContent(currentUser, composeType)
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
    if (!hydrated || !authResolved) return
    if (!isAuthed) openLogin()
  }, [hydrated, authResolved, isAuthed, openLogin])

  // Reset confirm overlay when navigating between sections.
  useEffect(() => {
    setConfirming(null)
  }, [section])

  // Compose URL guard — bump a non-authorized user back to the picker when
  // they type `?type=…&edit=…` for a type they can't create. Done in an
  // effect so it triggers post-hydration once we know the real role.
  useEffect(() => {
    if (!hydrated || !isAuthed) return
    if (composeBlocked) {
      router.replace('/dashboard?section=nuevo')
    }
  }, [hydrated, isAuthed, composeBlocked, router])

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
          onClick={() => openLogin()}
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
  // The redirect effect above will bump composeBlocked back to the picker —
  // we render the picker in the meantime so there's no flash of the form.
  if (composeType && !composeBlocked) {
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
  const confirmContent = confirmOverlayContentFor({
    confirming,
    draftItems,
  })

  return (
    <>
      <ExplorerShell
        active={section}
        onPick={navigateSection}
        draftCount={draftCount}
        publishedCount={publishedCount}
        savedCount={savedCount}
        lastEditedAt={lastEditedAt}
        breadcrumbs={breadcrumbsFor({ section, username })}
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
              })}
            />
          }
          countLabel={countLabelFor({ section, draftItems, allowedTypes })}
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
            showMarketplace={isPartnerTeam}
            draftItems={draftItems}
            allowedTypes={allowedTypes}
            onPickType={(t) =>
              setConfirming({ kind: 'tpl', type: t as SupportedType })
            }
            onPickDraft={(id) => setConfirming({ kind: 'draft', id })}
            onDeletePublished={onDeletePublished}
            onHarvestPublished={onHarvestPublished}
            navigate={navigateSection}
          />
        </ExplorerWindow>
      </ExplorerShell>

      {/* Confirm overlay — single-click on any tile pops this. */}
      {confirmContent && (
        <ConfirmOverlay
          open
          header={confirmContent.header}
          selection={confirmContent.selection}
          ctaLabel={confirmContent.ctaLabel}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            confirmContent.onConfirm({ openCompose, openDraft })
            setConfirming(null)
          }}
        />
      )}

      {/* Harvest confirm — opens when user clicks the ◉ COSECHAR seal on
          a published tile. Modal handles its own POST + success state;
          we just provide the item and a close handler. */}
      {harvestingItem && (
        <HarvestConfirmModal
          item={harvestingItem}
          open
          onClose={() => setHarvestingItem(null)}
          onHarvested={onHarvestComplete}
        />
      )}
    </>
  )
}

// ── Section body dispatch ───────────────────────────────────────────────────

function SectionBody({
  section,
  username,
  draftCount,
  publishedCount,
  showMarketplace,
  draftItems,
  allowedTypes,
  onPickType,
  onPickDraft,
  onDeletePublished,
  onHarvestPublished,
  navigate,
}: {
  section: ExplorerSection
  username: string | null
  draftCount: number
  publishedCount: number
  showMarketplace: boolean
  draftItems: DraftItem[]
  allowedTypes: SupportedType[]
  onPickType: (t: ContentType) => void
  onPickDraft: (id: string) => void
  onDeletePublished: (item: DraftItem) => void
  onHarvestPublished: (item: DraftItem) => void
  navigate: (s: ExplorerSection) => void
}) {
  switch (section) {
    case 'home':
      return (
        <HomeSection
          username={username}
          draftCount={draftCount}
          publishedCount={publishedCount}
          showMarketplace={showMarketplace}
          onPick={navigate}
        />
      )
    case 'nuevo':
      return (
        <NuevoSection supported={allowedTypes} onPick={onPickType} />
      )
    case 'drafts':
      return (
        <DraftsSection
          items={draftItems}
          onOpen={(item) => onPickDraft(item.id)}
          stateFilter="draft"
          namespace="drafts"
        />
      )
    case 'publicados':
      return (
        <DraftsSection
          items={draftItems}
          onOpen={(item) => onPickDraft(item.id)}
          stateFilter="published"
          namespace="publicados"
          onDelete={onDeletePublished}
          onHarvest={onHarvestPublished}
        />
      )
    case 'profile':
      return <ProfileSection />
    case 'guardados-feed':
      return <GuardadosSection filter={null} filterKey="feed" />
    case 'guardados-agenda':
      return <GuardadosSection filter={['evento']} filterKey="agenda" />
    case 'guardados-noticias':
      return <GuardadosSection filter={['noticia']} filterKey="noticias" />
    case 'guardados-reviews':
      return <GuardadosSection filter={['review']} filterKey="reviews" />
    case 'guardados-mixes':
      return <GuardadosSection filter={['mix']} filterKey="mixes" />
    case 'guardados-editoriales':
      // Editoriales slot covers both `editorial` and `opinion` — they read
      // editorially, no need to fragment them in the saves view.
      return <GuardadosSection filter={['editorial', 'opinion']} filterKey="editoriales" />
    case 'guardados-articulos':
      // Articulos slot covers `articulo` and `listicle` — both are feature-
      // length pieces; listicles are just structured lists rather than prose.
      return <GuardadosSection filter={['articulo', 'listicle']} filterKey="articulos" />
    case 'guardados-comentarios':
      return <SavedCommentsSection />
    case 'aprobaciones-mkt':
      return <PartnerApprovalsSection />
    case 'mi-partner':
      return <MiPartnerSection />
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

// Resolve confirming state into header/selection/CTA for the ConfirmOverlay,
// plus an onConfirm closure that runs the actual action. Returns null when
// the overlay shouldn't be open.
function confirmOverlayContentFor({
  confirming,
  draftItems,
}: {
  confirming:
    | { kind: 'tpl'; type: SupportedType }
    | { kind: 'draft'; id: string }
    | null
  draftItems: DraftItem[]
}): {
  header: string
  selection: SelectionMeta
  ctaLabel: string
  onConfirm: (h: {
    openCompose: (t: SupportedType, opts?: { editId?: string }) => void
    openDraft: (item: DraftItem) => void
  }) => void
} | null {
  if (!confirming) return null
  if (confirming.kind === 'tpl') {
    const sel = selectionForType(confirming.type)
    return {
      header: `// SELECCIONANDO PLANTILLA · ${sel.label}`,
      selection: sel,
      ctaLabel: 'USAR ESTA PLANTILLA',
      onConfirm: ({ openCompose }) => openCompose(confirming.type),
    }
  }
  // confirming.kind === 'draft'
  const item = draftItems.find((i) => i.id === confirming.id)
  if (!item) return null
  const isDraft = item._draftState === 'draft'
  return {
    header: isDraft ? '// ABRIENDO BORRADOR' : '// ABRIENDO PUBLICACIÓN',
    selection: draftSelection(item),
    ctaLabel: 'ABRIR EN EDITOR',
    onConfirm: ({ openDraft }) => openDraft(item),
  }
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
      { key: 'VIBE', value: vibeRangeLabel(item) },
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

function shouldShowViewControls(section: ExplorerSection): boolean {
  return ['nuevo', 'drafts', 'publicados'].includes(section)
}

function countLabelFor({
  section,
  draftItems,
  allowedTypes,
}: {
  section: ExplorerSection
  draftItems: DraftItem[]
  allowedTypes: SupportedType[]
}): string | undefined {
  if (section === 'nuevo') {
    const n = allowedTypes.length
    return `▸ ${n} ${n === 1 ? 'plantilla' : 'plantillas'}`
  }
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
