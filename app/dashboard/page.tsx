'use client'

// ── /dashboard — «EL PLIEGO» (FINAL_SPEC §3.0/§7 — WP1 shell + dispatch) ────
//
// The page composes: DashboardDataProvider (the single data layer) →
// DashMasthead (48px black strip) → IdentitySpine + StatusStrip → the WP3
// WidgetGrid mount point, with DashOverlayHost resolving
// cold `?item=` deep links in place.
//
// URL contracts that survive the rebuild (§7.5):
//   ?type=&edit=   compose dispatch — forms read ?edit themselves
//   ?item=&comment= overlay host (in-place open, zero ejections)
//   ?section=      legacy explorer values → widget scroll / guardados facet
//   /dashboard/drafts → redirects to ?section=drafts (untouched)
// Role guards stay two-layered: `canCreateContent` bounces unauthorized
// `?type=`, and admin/franja-only legacy sections fall back to the plain
// grid — never an error.

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { canAssignRoles, canCreateContent } from '@/lib/permissions'
import type { ContentType } from '@/lib/types'
import type { WidgetId } from '@/lib/dashboard/layout'

import { DashboardDataProvider, useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { DashMasthead } from '@/components/dashboard/shell/DashMasthead'
import { IdentitySpine } from '@/components/dashboard/shell/IdentitySpine'
import { StatusStrip, scrollToDashWidget } from '@/components/dashboard/shell/StatusStrip'
import { MiniTransport } from '@/components/dashboard/shell/MiniTransport'
import { DashOverlayHost } from '@/components/dashboard/overlayhost/DashOverlayHost'
import { WidgetGrid } from '@/components/dashboard/grid/WidgetGrid'
import { DASH_WIDGETS } from '@/components/dashboard/widgetRegistry'
import { ComposeSheet } from '@/components/dashboard/compose/ComposeSheet'

// ── Compose types (unchanged contract) ──────────────────────────────────────

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

function isSupportedType(t: string | null): t is SupportedType {
  return !!t && (SUPPORTED as string[]).includes(t)
}

// ── Legacy `?section=` map (§7.5, revision-2) ───────────────────────────────
// GUARDADOS lost its facets (revision-2 point 12), so the old facet values
// collapse onto their owning widget: mixes → REPRODUCTOR, everything else →
// GUARDADOS. 'profile' scrolls to the top — the identity spine absorbed the
// PERFIL widget (point 6).

interface LegacyTarget {
  widget?: WidgetId
  top?: boolean
}

function resolveLegacySection(
  raw: string,
  flags: { isAdmin: boolean; isFranjaTeam: boolean },
): LegacyTarget {
  switch (raw) {
    case 'nuevo': // the CREAR widget owns composition now
    case 'drafts': // drafts live in CREAR's BORRADORES popup
      return { widget: 'crear' }
    case 'publicados':
      return { widget: 'cultivar' }
    case 'guardados-feed':
    case 'guardados-noticias':
    case 'guardados-reviews':
    case 'guardados-editoriales':
    case 'guardados-articulos':
    case 'guardados-comentarios':
      return { widget: 'guardados' }
    case 'guardados-mixes':
      return { widget: 'reproductor' }
    case 'guardados-agenda':
      return { widget: 'agenda' }
    case 'profile':
      return { top: true }
    case 'mi-franja':
      return flags.isFranjaTeam ? { widget: 'mercado' } : {}
    case 'aprobaciones-mkt': // the key the old explorer actually used
    case 'approvals': // spec alias
      return flags.isAdmin ? { widget: 'mercado' } : {}
    default:
      // home / unknown / inapplicable → plain grid, no error.
      return {}
  }
}


// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <DashboardDataProvider>
      <DashboardPageInner />
    </DashboardDataProvider>
  )
}

function DashboardPageInner() {
  const { currentUser, isAuthed, authResolved, username, openLogin } = useAuth()
  const { layoutReady } = useDashboardData()
  const router = useRouter()
  const search = useSearchParams()

  const rawSection = search?.get('section') ?? null
  const rawType = search?.get('type') ?? null
  const composeType: SupportedType | null = isSupportedType(rawType) ? rawType : null
  const editingId = search?.get('edit') ?? null

  const isAdmin = canAssignRoles(currentUser)
  const isFranjaTeam = !!currentUser?.franjaId
  const composeBlocked =
    composeType !== null && !canCreateContent(currentUser, composeType)

  const [hydrated, setHydrated] = useState(false)
  // Edit mode is page state (§2.3 — a mode, not a widget). The masthead
  // toggles it; Stage 3 hands the same pair to WidgetGrid/EditModeBar.
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || !authResolved) return
    if (!isAuthed) openLogin()
  }, [hydrated, authResolved, isAuthed, openLogin])

  // Compose URL guard — the second gate layer (chips are the first). A
  // non-authorized `?type=` bounces to the legacy `nuevo` anchor, which the
  // dispatch below resolves to a CULTIVAR scroll.
  useEffect(() => {
    if (!hydrated || !authResolved || !isAuthed) return
    if (composeBlocked) router.replace('/dashboard?section=nuevo')
  }, [hydrated, authResolved, isAuthed, composeBlocked, router])

  // Legacy `?section=` dispatch (§7.5): resolve → scroll (and/or keep the
  // facet param) → clean the URL. replace() drops the param, so this can
  // never loop. Compose URLs that still carry the old `section=nuevo`
  // alongside `type=` let compose win.
  useEffect(() => {
    if (!hydrated || !authResolved || !isAuthed) return
    if (!rawSection || composeType) return
    const target = resolveLegacySection(rawSection, { isAdmin, isFranjaTeam })
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('section')
    const qs = params.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard')
    if (target.widget) scrollToDashWidget(target.widget)
    else if (target.top) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    hydrated,
    authResolved,
    isAuthed,
    rawSection,
    composeType,
    isAdmin,
    isFranjaTeam,
    search,
    router,
  ])

  const closeCompose = useCallback(() => {
    // Autosave already ran (useDraftWorkbench) — closing is consequence-free.
    router.push('/dashboard')
  }, [router])

  if (!hydrated) return null

  const composing = composeType !== null && !composeBlocked && isAuthed

  return (
    <>
      <DashMasthead editing={editing} onEditPanel={() => setEditing((e) => !e)} />

      {authResolved && !isAuthed ? (
        <AccessGate onLogin={() => openLogin()} />
      ) : composing && composeType ? (
        // §4: the grid is UNMOUNTED beneath the sheet (no background rAF).
        <ComposeSheet type={composeType} editingId={editingId} onClose={closeCompose} />
      ) : (
        <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
          <IdentitySpine />
          <StatusStrip />

          <section className="min-h-[32rem] py-6">
            {layoutReady ? (
              <WidgetGrid widgets={DASH_WIDGETS} editing={editing} onEditingChange={setEditing} />
            ) : (
              // Loading register: one hairline shimmer, stepped opacity
              // (blink is step-end) — never a spinner (§2.6). motion-safe:
              // reduced-motion gets the settled static hairline.
              <div aria-hidden className="h-px w-full bg-ink motion-safe:animate-blink" />
            )}
          </section>

        </div>
      )}

      <MiniTransport />
      <DashOverlayHost />
    </>
  )
}

// ── Access gate (paper register — same authResolved+openLogin contract) ─────

function AccessGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[1440px] flex-col items-center justify-center gap-4 px-4 py-20 text-center md:px-8">
      <span className="inline-flex items-center gap-2 border border-ink px-3 py-1 font-mono text-d11 tracking-widest text-sys-red-paper">
        ACCESO RESTRINGIDO
      </span>
      <h1 className="font-syne text-d28 font-extrabold text-ink">
        IDENTIFÍCATE PARA CONTINUAR
      </h1>
      <p className="max-w-md font-grotesk text-d15 text-ink-soft">
        El panel de usuario está reservado para cuentas del subsistema. Inicia
        sesión para continuar.
      </p>
      <button
        type="button"
        onClick={onLogin}
        className="mt-2 border border-ink px-4 py-2 font-mono text-d13 tracking-widest text-ink hover:bg-paper-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        ABRIR LOGIN
      </button>
    </div>
  )
}

