'use client'

import { useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Chip, MarginNote, SpaceHead, SubTabs } from '@/components/admin/kit'
import type { AdminTab } from '@/lib/admin/tabs'

// ── ACCESO — el espacio de entrada ──────────────────────────────────────────
//
// The merge of two former top-level tabs (INVITACIONES + ESPERA) into one
// space. They were never two subjects: /api/admin/waitlist mints a row in
// invite_codes and hands back the same /welcome?codigo= link the code book
// generates, so ESPERA is a queue that FEEDS INVITACIONES. Two latches for one
// pipeline made the panel look like it had two ways in.
//
// Deliberately a thin wrapper. Both editors arrive as already-rendered
// children from the server page, so this file cannot fork, re-skin or drift
// from AdminInviteCodes / AdminWaitlist — it only decides which one is on
// screen and keeps the URL honest about that.

type Sub = 'invitaciones' | 'espera'

const SUBS: readonly Sub[] = ['invitaciones', 'espera']

// This component IS the acceso tab; typing the constant against AdminTab keeps
// it tied to lib/admin/tabs rather than being a loose string in a query write.
const TAB: AdminTab = 'acceso'

/**
 * Unknown ?sub= falls to INVITACIONES — the same philosophy as
 * resolveAdminTab(): land somewhere real instead of rendering a space with no
 * sub-tab latched. The legacy ?tab=espera / ?tab=invites mapping is NOT redone
 * here; the server page resolves it through LEGACY_SUBTAB and passes the
 * result in as `initialSub`.
 */
function resolveSub(raw: string): Sub {
  return SUBS.includes(raw as Sub) ? (raw as Sub) : 'invitaciones'
}

export function AccesoTab({
  initialSub,
  invitaciones,
  espera,
  counts,
}: {
  initialSub: string
  invitaciones: ReactNode
  espera: ReactNode
  /**
   * Real lengths of the two fetched lists. INVITACIONES is the code book as
   * loaded (the page caps it at 1000; production holds ~217) — if the book
   * ever reaches that ceiling this must become a `count: 'exact'` query
   * instead of silently plateauing.
   */
  counts: { invitaciones: number; espera: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Local state is authoritative and the URL mirrors it, not the other way
  // round: /admin is force-dynamic, so reading the active sub back out of
  // useSearchParams() would make every latch wait on a server round trip
  // before it moved.
  const [sub, setSub] = useState<Sub>(() => resolveSub(initialSub))

  const select = (next: Sub) => {
    setSub(next)
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    sp.set('sub', next)
    // Canonicalise the tab on the way out. A visitor arriving on the aliased
    // /admin?tab=espera keeps that value in the address bar, and the page reads
    // LEGACY_SUBTAB before ?sub= — so without this the URL we just wrote would
    // reopen on the OTHER sub-tab when shared or reloaded.
    sp.set('tab', TAB)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  return (
    <div className="flex w-full flex-col">
      <SpaceHead
        as="h2"
        eyebrow="ESPACIO"
        title="ACCESO"
        chips={<Chip>ENTRADA POR CÓDIGO</Chip>}
      />

      <div className="py-4">
        <MarginNote>
          {
            'LA LISTA DE ESPERA NO CREA CUENTAS: «GENERAR CÓDIGO» EMITE UNA INVITACIÓN REAL EN EL MISMO LIBRO Y ENTREGA EL MISMO ENLACE /WELCOME?CODIGO=. NO EXISTE UN SEGUNDO CAMINO DE REGISTRO.'
          }
        </MarginNote>
      </div>

      <SubTabs
        tabs={[
          { id: 'invitaciones', label: 'INVITACIONES', count: counts.invitaciones },
          { id: 'espera', label: 'ESPERA', count: counts.espera },
        ]}
        active={sub}
        onChange={select}
        ariaLabel="Secciones de acceso"
      />

      {/* Only the active half is mounted. Both children are already built on
          the server, but mounting both would boot two full editors — two
          filter states, two fetch surfaces — for one visible table. */}
      <div className="pt-4">{sub === 'invitaciones' ? invitaciones : espera}</div>
    </div>
  )
}
