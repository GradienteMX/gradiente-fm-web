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
//   ?espacio=      FASE D — which SPACE is open (panel|publicar|franja|mercado)
//   ?section=      legacy explorer values → space + widget scroll
//   /dashboard/drafts → redirects to ?section=drafts (untouched)
//
// FASE D — «espacios». The panel became four spaces. The structural call that
// keeps this cheap: **only PANEL is a widget grid**; PUBLICAR/FRANJA/MERCADO
// are bespoke sheets. So the layout schema stays at v:4, the packer is
// untouched, and edit mode still operates on the one and only grid — a drag
// can never silently re-pack widgets the user cannot see.
// Role guards stay two-layered: `canCreateContent` bounces unauthorized
// `?type=`, and admin/franja-only legacy sections fall back to the plain
// grid — never an error.

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { DashTabBar } from '@/components/dashboard/shell/DashTabBar'
import { PublicarSpace } from '@/components/dashboard/espacios/PublicarSpace'
import { FranjaSpace } from '@/components/dashboard/espacios/FranjaSpace'
import { MercadoSpace } from '@/components/dashboard/espacios/MercadoSpace'
import {
  DEFAULT_ESPACIO,
  ESPACIO_PARAM,
  espacioHref,
  resolveEspacio,
  visibleEspacios,
  type EspacioId,
} from '@/lib/dashboard/espacios'

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
  /** Which space to open. Absent = stay on the default (PANEL). */
  espacio?: EspacioId
  /** Widget anchor to scroll to — only meaningful inside PANEL. */
  widget?: WidgetId
  top?: boolean
  /** A destination that LEAVES /dashboard (the retired admin approvals queue). */
  href?: string
}

function resolveLegacySection(
  raw: string,
  flags: { isAdmin: boolean; isFranjaTeam: boolean },
): LegacyTarget {
  switch (raw) {
    case 'nuevo': // authoring moved into its own space (fase D)
    case 'drafts': // drafts are the PUBLICAR space's EN CURSO table
      return { espacio: 'publicar' }
    case 'publicados':
      return { espacio: 'panel', widget: 'cultivar' }
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
      return flags.isFranjaTeam ? { espacio: 'franja' } : {}
    case 'aprobaciones-mkt': // the key the old explorer actually used
    case 'approvals': // spec alias
      // The approvals queue RETIRED in fase D: marketplace activation is
      // self-service for the franja team (MERCADO › AJUSTES), so what an
      // admin still needs is the abuse kill-switch, which lives on /admin.
      // Send them there rather than dropping the link on the floor.
      return flags.isAdmin ? { href: '/admin?tab=franjas' } : {}
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
  const { layoutReady, franja } = useDashboardData()
  const router = useRouter()
  const search = useSearchParams()

  const rawSection = search?.get('section') ?? null
  const rawType = search?.get('type') ?? null
  const composeType: SupportedType | null = isSupportedType(rawType) ? rawType : null
  const editingId = search?.get('edit') ?? null

  const isAdmin = canAssignRoles(currentUser)
  const isFranjaTeam = !!currentUser?.franjaId

  // ── Spaces (fase D) ───────────────────────────────────────────────────────
  // Tab state lives in the URL so every space deep-links and survives the back
  // button. An unknown or ungranted value resolves to PANEL — never an error,
  // the same rule the legacy `?section=` resolver follows.
  const espacios = visibleEspacios({ isFranjaTeam })
  const espacio = resolveEspacio(search?.get(ESPACIO_PARAM) ?? null, { isFranjaTeam })

  const selectEspacio = useCallback(
    (next: EspacioId) => {
      const params = new URLSearchParams(search?.toString() ?? '')
      if (next === DEFAULT_ESPACIO) params.delete(ESPACIO_PARAM)
      else params.set(ESPACIO_PARAM, next)
      const qs = params.toString()
      router.push(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false })
    },
    [router, search],
  )
  const composeBlocked =
    composeType !== null && !canCreateContent(currentUser, composeType)

  const [hydrated, setHydrated] = useState(false)
  // Edit mode is page state (§2.3 — a mode, not a widget). The masthead
  // toggles it; Stage 3 hands the same pair to WidgetGrid/EditModeBar.
  const [editing, setEditing] = useState(false)

  // Edit mode belongs to the grid, and the grid is PANEL. Leaving PANEL exits
  // it, so the masthead can never read LISTO over a sheet that has nothing to
  // edit.
  useEffect(() => {
    if (espacio !== 'panel' && editing) setEditing(false)
  }, [espacio, editing])

  // Remembered across the compose round-trip. DashboardPageInner stays mounted
  // through a search-param change (soft nav), so a ref is enough — no storage,
  // no extra param riding along on every compose URL.
  const lastEspacioRef = useRef<EspacioId>(DEFAULT_ESPACIO)

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
    // A target that leaves /dashboard wins outright (retired approvals queue).
    if (target.href) {
      router.replace(target.href)
      return
    }
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('section')
    if (target.espacio && target.espacio !== DEFAULT_ESPACIO) {
      params.set(ESPACIO_PARAM, target.espacio)
    } else if (target.espacio === DEFAULT_ESPACIO) {
      params.delete(ESPACIO_PARAM)
    }
    const qs = params.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard')
    // scrollToDashWidget retries on rAF for 4s, which covers the space's
    // render — so switching tab and scrolling need no coordination.
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
    // Return to the space the user composed FROM: PUBLICAR and FRANJA both
    // open the sheet, and landing back on PANEL would lose their place.
    router.push(espacioHref(lastEspacioRef.current))
  }, [router])

  if (!hydrated) return null

  const composing = composeType !== null && !composeBlocked && isAuthed
  // Only record a real space visit — never the compose detour itself.
  if (!composing) lastEspacioRef.current = espacio

  return (
    <>
      <DashMasthead
        editing={editing}
        onEditPanel={() => setEditing((e) => !e)}
        // EDITAR PANEL edits the grid, and the grid is PANEL. On a sheet the
        // control would be a lever attached to nothing, so it is absent.
        canEdit={!composing && espacio === 'panel'}
      />

      {authResolved && !isAuthed ? (
        <AccessGate onLogin={() => openLogin()} />
      ) : composing && composeType ? (
        // §4: the grid is UNMOUNTED beneath the sheet (no background rAF).
        <ComposeSheet type={composeType} editingId={editingId} onClose={closeCompose} />
      ) : (
        <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
          <IdentitySpine />
          <StatusStrip />
          <DashTabBar
            espacios={espacios}
            active={espacio}
            onSelect={selectEspacio}
            franjaName={franja?.title ?? null}
            ofertas={franja?.unansweredListingIds.length ?? 0}
            profileHref={username ? `/u/${encodeURIComponent(username)}` : null}
          />

          <section className="min-h-[32rem] py-6">
            {espacio === 'panel' ? (
              layoutReady ? (
                <WidgetGrid
                  widgets={DASH_WIDGETS}
                  editing={editing}
                  onEditingChange={setEditing}
                />
              ) : (
                // Loading register: one hairline shimmer, stepped opacity
                // (blink is step-end) — never a spinner (§2.6). motion-safe:
                // reduced-motion gets the settled static hairline.
                <div aria-hidden className="h-px w-full bg-ink motion-safe:animate-blink" />
              )
            ) : espacio === 'publicar' ? (
              <PublicarSpace />
            ) : espacio === 'franja' ? (
              <FranjaSpace />
            ) : (
              <MercadoSpace />
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

