'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { SmartImage } from '@/components/SmartImage'

// ── AuthBadge — the masthead's identity slot (desktop) ──────────────────────
//
// Anon: a bordered INICIAR SESIÓN chip → LoginOverlay. Authed: avatar +
// @username trigger that drops a paper panel (the one paper object on the
// ink strip — bg-paper, ink border, shadow-lift) with the three identity
// rows: PANEL, VER PERFIL PÚBLICO, SALIR. Hover is fill inversion, rows
// clear the 44px floor, and the menu closes on outside click, Esc, and any
// row activation. Phones never see this — the Navigation mobile menu owns
// the auth controls there.

const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'
const FOCUS_ON_PAPER =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function AuthBadge() {
  const { isAuthed, username, currentUser, openLogin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Outside click + Esc close the dropdown; listeners exist only while open.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (root && e.target instanceof Node && !root.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!isAuthed) {
    return (
      <div className="hidden items-center md:flex">
        <button
          type="button"
          onClick={() => openLogin()}
          className={`flex min-h-11 items-center border border-panel-text/60 px-3 font-mono text-d13 uppercase tracking-widest text-panel-text hover:bg-panel-text hover:text-panel ${FOCUS_ON_PANEL}`}
        >
          INICIAR SESIÓN
        </button>
      </div>
    )
  }

  const handle = username ?? currentUser?.username ?? 'usuario'

  return (
    <div ref={rootRef} className="relative hidden items-center md:flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Cuenta de @${handle}`}
        className={`flex min-h-11 items-center gap-2 px-1 text-panel-text ${FOCUS_ON_PANEL}`}
      >
        {/* 28px avatar — image when the profile has one, Syne initial block
            otherwise. SmartImage is a fill image, so the span is positioned. */}
        <span className="relative block h-7 w-7 shrink-0 overflow-hidden border border-panel-text">
          {currentUser?.avatarUrl ? (
            <SmartImage
              src={currentUser.avatarUrl}
              alt=""
              className="object-cover"
              sizes="28px"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-panel-text font-syne text-d13 font-bold uppercase text-panel">
              {handle.slice(0, 1)}
            </span>
          )}
        </span>
        <span className="font-mono text-d13 tracking-widest">@{handle}</span>
        <span aria-hidden className="font-mono text-d11">
          ⌄
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Cuenta de @${handle}`}
          className="absolute right-0 top-full z-50 min-w-[220px] border border-ink bg-paper text-ink shadow-lift"
        >
          <Link
            role="menuitem"
            href="/dashboard"
            onClick={() => setOpen(false)}
            className={`flex min-h-11 items-center px-4 font-mono text-d13 uppercase tracking-widest hover:bg-ink hover:text-paper ${FOCUS_ON_PAPER}`}
          >
            PANEL
          </Link>
          <Link
            role="menuitem"
            href={`/u/${handle}`}
            onClick={() => setOpen(false)}
            className={`flex min-h-11 items-center gap-2 border-t border-ink px-4 font-mono text-d13 uppercase tracking-widest hover:bg-ink hover:text-paper ${FOCUS_ON_PAPER}`}
          >
            VER PERFIL PÚBLICO <span aria-hidden>↗</span>
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
            className={`flex min-h-11 w-full items-center border-t border-ink px-4 text-left font-mono text-d13 uppercase tracking-widest text-sys-red-paper hover:bg-sys-red-paper hover:text-paper ${FOCUS_ON_PAPER}`}
          >
            SALIR
          </button>
        </div>
      )}
    </div>
  )
}
