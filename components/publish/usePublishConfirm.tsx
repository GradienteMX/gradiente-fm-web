'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { PublishMode } from '@/lib/drafts'

// Tiny global context driving the publish-confirmation modal. The modal is
// mounted once at layout level (see [[PublishConfirmOverlay]]); cards open
// it via openConfirm(itemId, mode).
//
// The pending URL param (`?pending=<id>`) is the source of truth for which
// item is in the pending-publish state on the home grid; this context just
// orchestrates whether the confirm modal is currently OPEN for it — and
// carries the create-vs-edit `mode` the composer resolved from its entry
// point, so the overlay can forward it to the publish guard.

interface PublishConfirmContextValue {
  confirmingId: string | null
  confirmingMode: PublishMode
  openConfirm: (id: string, mode?: PublishMode) => void
  closeConfirm: () => void
}

const Ctx = createContext<PublishConfirmContextValue | null>(null)

export function PublishConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  // Default 'edit' for callers that don't specify (e.g. publishing an existing
  // draft from a feed overlay) — permissive same-user re-publish, still
  // ownership-guarded server-side.
  const [confirmingMode, setConfirmingMode] = useState<PublishMode>('edit')
  const openConfirm = useCallback((id: string, mode: PublishMode = 'edit') => {
    setConfirmingId(id)
    setConfirmingMode(mode)
  }, [])
  const closeConfirm = useCallback(() => setConfirmingId(null), [])

  return (
    <Ctx.Provider
      value={{ confirmingId, confirmingMode, openConfirm, closeConfirm }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function usePublishConfirm(): PublishConfirmContextValue {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error('usePublishConfirm must be used inside <PublishConfirmProvider>')
  return ctx
}
