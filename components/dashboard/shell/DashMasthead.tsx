'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth/useAuth'
import { useSearch } from '@/components/search/useSearch'
import { SystemObject } from '@/components/brand/SystemObject'
import { SmartImage } from '@/components/SmartImage'
import { canAssignRoles } from '@/lib/permissions'
import type { User } from '@/lib/types'

// ── DashMasthead — the 48px black strip (FINAL_SPEC §7.3) ───────────────────
//
// Chrome, sticky, exempt from the ≤3 black-data-panel ration (§1.2). Nav
// access is preserved here because ChromeFrame nulls the site Navigation on
// /dashboard (recon-7: nulling alone would delete login/search/nav access).
// Header carries ONLY working controls: wordmark+mark, four nav links,
// search (SearchProvider — `/` shortcut stays live), EDITAR PANEL, avatar.
// The admin chip renders exclusively for actual admins (canAssignRoles).
// Every interactive element spans the full 48px strip height so touch
// targets clear the 44px floor; visual chrome sits on inner spans.

const NAV_LINKS = [
  { href: '/', label: 'INICIO' },
  { href: '/agenda', label: 'AGENDA' },
  { href: '/foro', label: 'FORO' },
  { href: '/marketplace', label: 'MARKETPLACE' },
] as const

const FOCUS_ON_PANEL =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

export function DashMasthead({
  editing,
  onEditPanel,
  canEdit = true,
  userOverride,
}: {
  // Edit mode is page state (§2.3 — a mode, not a widget). Stage 3 wires the
  // same pair into WidgetGrid/EditModeBar; the masthead only toggles it.
  editing: boolean
  onEditPanel: () => void
  // FASE D: EDITAR PANEL edits the widget grid, and the grid is the PANEL
  // space. On the bespoke sheets (PUBLICAR/FRANJA/MERCADO) there is nothing
  // to arrange, so the control is ABSENT rather than disabled — a dead lever
  // is exactly the affordance this project bans.
  canEdit?: boolean
  // Lab-boundary injection (initialSlices door-discipline) — production never
  // sets it; only app/lab/dashboard does, so the avatar block renders unauth.
  userOverride?: User
}) {
  const { currentUser: authedUser, username: authedName } = useAuth()
  const { openSearch } = useSearch()
  const currentUser = authedUser ?? userOverride ?? null
  const username = authedUser ? authedName : null
  const isAdmin = canAssignRoles(currentUser)

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-ink bg-panel">
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-4 md:px-8">
        {/* Wordmark lockup — SystemObject is canvas-2D (zero GL). null signal
            = its documented calm baseline; the dashboard has no feed pulse. */}
        <Link
          href="/"
          className={`flex h-full shrink-0 items-center gap-2 ${FOCUS_ON_PANEL}`}
          aria-label="Inicio"
        >
          <SystemObject signalStrength={null} size={28} />
          <span className="font-syne text-d18 font-extrabold tracking-tight text-panel-text">
            GRADIENTE
          </span>
        </Link>

        {isAdmin && (
          <span className="hidden shrink-0 bg-acid px-1.5 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink sm:inline-block">
            ADMIN
          </span>
        )}

        {/* Nav — d13 mono panel-text; scrolls inside its own container on
            narrow viewports (no page horizontal scroll). */}
        <nav
          aria-label="Navegación"
          className="flex h-full min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex h-full items-center font-mono text-d13 tracking-widest text-panel-text hover:underline hover:underline-offset-4 ${FOCUS_ON_PANEL}`}
              data-cue="tick"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={openSearch}
          aria-label="Buscar"
          className={`flex h-full shrink-0 items-center font-mono text-d13 tracking-widest text-panel-text hover:underline hover:underline-offset-4 ${FOCUS_ON_PANEL}`}
          data-cue="tick"
        >
          BUSCAR
        </button>

        {/* Settings gear = EDITAR PANEL — the same action, nothing else (§3.0). */}
        {canEdit && (
          <button
            type="button"
            onClick={onEditPanel}
            className={`flex h-full shrink-0 items-center ${FOCUS_ON_PANEL}`}
            data-cue="latch"
          >
            <span
              className={`border border-panel-text px-2 py-1 font-mono text-d13 tracking-widest ${
                editing ? 'bg-paper text-ink' : 'text-panel-text'
              }`}
            >
              {editing ? 'LISTO' : 'EDITAR PANEL'}
            </span>
          </button>
        )}

        {currentUser && (
          <button
            type="button"
            // The identity document lives at the top of the page now (the
            // PERFIL widget was absorbed into the spine — revision-2 point 6).
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={`Perfil de @${username ?? currentUser.username}`}
            className={`flex h-full shrink-0 items-center ${FOCUS_ON_PANEL}`}
            data-cue="tick"
          >
            <span className="relative block h-7 w-7 overflow-hidden border border-panel-text">
              {currentUser.avatarUrl ? (
                <SmartImage
                  src={currentUser.avatarUrl}
                  alt={`@${currentUser.username}`}
                  className="object-cover"
                  sizes="28px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold uppercase text-panel-text">
                  {(username ?? currentUser.username).slice(0, 1)}
                </span>
              )}
            </span>
          </button>
        )}
      </div>
    </header>
  )
}
