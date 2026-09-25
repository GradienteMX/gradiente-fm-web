'use client'

/**
 * UI orchestration: the reading surface (Lectura), the access sheet, the
 * search palette, dialogs and the transient notice line. Kept apart from the
 * world so animation state never re-renders data consumers.
 */

import { create } from 'zustand'

export interface OriginRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DialogSpec {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Require typing this exact text before confirming. */
  typeToConfirm?: string
  /** Ask for a line of text (moderation reasons, etc.). */
  input?: { label: string; placeholder?: string; minLength?: number; maxLength?: number }
}

export type ReportTarget = {
  type: 'item' | 'comment' | 'foro_thread' | 'foro_reply' | 'listing'
  id: string
  label: string
}

interface Notice {
  id: number
  text: string
  tone?: 'plain' | 'energy' | 'error'
  energy?: number
}

interface UIState {
  // Lectura
  lectura: { slug: string; origin: OriginRect | null; comments: boolean; focusComment: string | null } | null
  openLectura: (slug: string, origin?: OriginRect | null, opts?: { comments?: boolean; focusComment?: string | null }) => void
  closeLectura: () => void
  setLecturaComments: (open: boolean) => void

  // Access (login / register)
  access: { mode: 'entrar' | 'registro'; reason?: string } | null
  openAccess: (reason?: string, mode?: 'entrar' | 'registro') => void
  closeAccess: () => void

  // Search
  searchOpen: boolean
  setSearch: (open: boolean) => void

  // Dialog (promise-based)
  dialog: (DialogSpec & { resolve: (v: string | boolean | null) => void }) | null
  ask: (spec: DialogSpec) => Promise<string | boolean | null>
  settleDialog: (v: string | boolean | null) => void

  // Report
  report: ReportTarget | null
  openReport: (t: ReportTarget) => void
  closeReport: () => void

  // Notices
  notices: Notice[]
  notify: (text: string, opts?: { tone?: Notice['tone']; energy?: number }) => void
  dismiss: (id: number) => void
}

let noticeId = 0

export const useUI = create<UIState>((set, get) => ({
  lectura: null,
  openLectura: (slug, origin = null, opts) =>
    set({ lectura: { slug, origin, comments: opts?.comments ?? false, focusComment: opts?.focusComment ?? null } }),
  closeLectura: () => set({ lectura: null }),
  setLecturaComments: (open) => {
    const l = get().lectura
    if (l) set({ lectura: { ...l, comments: open } })
  },

  access: null,
  openAccess: (reason, mode = 'entrar') => set({ access: { mode, reason } }),
  closeAccess: () => set({ access: null }),

  searchOpen: false,
  setSearch: (searchOpen) => set({ searchOpen }),

  dialog: null,
  ask: (spec) =>
    new Promise((resolve) => {
      set({ dialog: { ...spec, resolve } })
    }),
  settleDialog: (v) => {
    const d = get().dialog
    if (d) d.resolve(v)
    set({ dialog: null })
  },

  report: null,
  openReport: (report) => set({ report }),
  closeReport: () => set({ report: null }),

  notices: [],
  notify: (text, opts) => {
    const id = ++noticeId
    set((s) => ({ notices: [...s.notices.slice(-2), { id, text, tone: opts?.tone ?? 'plain', energy: opts?.energy }] }))
    setTimeout(() => get().dismiss(id), 4200)
  },
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}))
