'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useAuth } from './useAuth'

// Slots into the Navigation header next to the MAGI/timer cluster.
// Swaps LOGIN button ↔ DASHBOARD link + LOGOUT when authed.
//
// Treated as a primary action region, not decorative chrome — the rest of the
// header uses very dim colors and sub-6px captions, but the auth controls have
// to read clearly. So we drop the dim "UNIT·ACCESS" / "ID·NULL" captions and
// give the button itself the weight it needs to be tappable at a glance.
export function AuthBadge() {
  const { isAuthed, username, openLogin, logout } = useAuth()

  if (!isAuthed) {
    return (
      <div
        className="hidden items-stretch md:flex"
        style={{ borderLeft: '1px solid #140B00' }}
      >
        <button
          onClick={openLogin}
          aria-label="Iniciar sesión"
          className="group flex items-center justify-center gap-2 px-4 transition-colors hover:bg-[#1A0900]"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: '#FF6600',
              boxShadow: '0 0 6px #FF6600, 0 0 12px #FF660066',
              animation: 'blink 1.6s step-end infinite',
            }}
          />
          <span
            className="font-syne text-[13px] font-black tracking-widest"
            style={{
              color: '#FF8C00',
              textShadow: '0 0 6px #FF6600, 0 0 14px #FF440055',
            }}
          >
            LOGIN
          </span>
          <span
            className="font-mono text-[9px] tracking-widest"
            style={{ color: '#7A4400' }}
          >
            ⏎
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="hidden items-stretch md:flex"
      style={{ borderLeft: '1px solid #140B00' }}
    >
      {/* Dashboard access — primary action, treated as a real button. */}
      <Link
        href="/dashboard"
        className="group flex items-center gap-2 px-4 transition-colors hover:bg-[#011a0c]"
        aria-label="Abrir dashboard"
      >
        <span
          className="h-2 w-2 animate-pulse rounded-full"
          style={{
            backgroundColor: '#4ADE80',
            boxShadow: '0 0 6px #4ADE80, 0 0 12px #4ADE8066',
          }}
        />
        <div className="flex flex-col items-start leading-tight">
          <span
            className="font-syne text-[13px] font-black tracking-widest"
            style={{
              color: '#4ADE80',
              textShadow: '0 0 6px #4ADE8088, 0 0 14px #4ADE8044',
            }}
          >
            DASHBOARD
          </span>
          <span
            className="font-mono text-[9px] tracking-wider"
            style={{ color: '#888' }}
          >
            @{username ?? 'user'}
          </span>
        </div>
      </Link>

      {/* Logout — secondary, but labeled so it's discoverable. */}
      <button
        onClick={logout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="group flex items-center gap-1.5 border-l border-[#140B00] px-3 transition-colors hover:bg-[#1A0000]"
      >
        <LogOut
          size={12}
          strokeWidth={1.75}
          className="transition-colors"
          style={{ color: '#777' }}
        />
        <span
          className="font-mono text-[10px] font-bold tracking-widest transition-colors group-hover:text-[#E63329]"
          style={{ color: '#999' }}
        >
          SALIR
        </span>
      </button>
    </div>
  )
}
