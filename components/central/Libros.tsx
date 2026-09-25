'use client'

/**
 * LIBROS — lays Central's ledgers into the world while /central is open.
 *
 * The 180-day HL ledger, every creator's presence rows, the save counts, the
 * waitlist and the code book are read by /central's own page
 * (loadAdminWorld, admins only) — never by the root layout, so an admin's
 * ordinary page loads weigh what anyone's do. This lays them in before paint
 * and takes them out on the way out; a refresh of the page hands newer ones.
 * Renders nothing.
 */

import { useLayoutEffect } from 'react'
import type { AdminWorld } from '@/lib/store/snapshot'
import { useWorldStore } from '@/lib/store/world'

export function Libros({ admin }: { admin: AdminWorld | null }) {
  const store = useWorldStore()
  useLayoutEffect(() => {
    store.getState().attachAdmin(admin)
  }, [store, admin])
  useLayoutEffect(() => () => store.getState().attachAdmin(null), [store])
  return null
}
