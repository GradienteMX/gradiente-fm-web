'use client'

import { format } from 'date-fns'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'

// ── DashColophon — the print colophon footer (FINAL_SPEC §7.4) ──────────────
//
// One mono line on paper; every value real. The timestamp is the provider's
// `lastTickAt` (last fully-successful heartbeat) — when no tick has landed
// yet the segment is simply absent, never fabricated. Polling is the honest
// register: the cadence label states it (R8 — realtime-fiction labels are
// banned by grep gate, so this file names its cadence instead).

export function DashColophon() {
  const { lastTickAt } = useDashboardData()
  const stamp = lastTickAt ? format(new Date(lastTickAt), 'HH:mm:ss') : null

  return (
    <footer className="mt-12 border-t border-ink py-4">
      <p className="font-mono text-d11 tracking-widest text-ink-soft tabular-nums">
        GRADIENTE · PANEL DE USUARIO · SONDEO CADA 60S
        {stamp ? ` · ÚLTIMA ACTUALIZACIÓN ${stamp}` : ''}
      </p>
    </footer>
  )
}
