'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

// Tiny global context driving the publish-confirmation modal. The modal is
// mounted once at layout level (see [[PublishConfirmOverlay]]); cards open
// it via openConfirm(itemId).
//
// The pending URL param (`?pending=<id>`) is the source of truth for which
// item is in the pending-publish state on the home grid; this context just
// orchestrates whether the confirm modal is currently OPEN for it.

interface PublishConfirmContextValue {
  confirmingId: string | null
  openConfirm: (id: string) => void
  closeConfirm: () => void
}

const Ctx = createContext<PublishConfirmContextValue | null>(null)

export function PublishConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const openConfirm = useCallback((id: string) => setConfirmingId(id), [])
  const closeConfirm = useCallback(() => setConfirmingId(null), [])

  return (
    <Ctx.Provider value={{ confirmingId, openConfirm, closeConfirm }}>
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
