'use client'

// ── FranjaAttributionRow — VINCULAR A MI PROMOTORA (rail row) ──────────────
//
// Gating ported verbatim from the dark FranjaAttributionField
// (components/dashboard/forms/shared/FranjaAttributionField.tsx —
// untouched, /admin keeps it): renders ONLY for franja-team members
// (currentUser.franjaId) and only on the 5 content types the publish route
// can stamp — otherwise null, never disabled-decoration. Value reflects
// reality: an explicit choice wins; otherwise it mirrors whether the item is
// currently franja-stamped. The route reads `attributeFranja`
// (true/false/undefined) — see app/api/items.
//
// Rail-ready: ToggleL is a full-width min-h-11 row, so PUBLICACIÓN can drop
// this in directly (label left, pliego switch right).

import type { ContentItem } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { ToggleL } from './fields'

const STAMPED_TYPES: ContentItem['type'][] = [
  'evento',
  'mix',
  'noticia',
  'opinion',
  'listicle',
]

export function FranjaAttributionRow({
  draft,
  onChange,
}: {
  draft: ContentItem
  onChange: (value: boolean) => void
}) {
  const { currentUser } = useAuth()
  if (!currentUser?.franjaId || !STAMPED_TYPES.includes(draft.type)) return null

  const value = draft.attributeFranja ?? !!draft.franjaId

  return (
    <ToggleL
      label="VINCULAR A MI PROMOTORA"
      value={value}
      onChange={onChange}
    />
  )
}
