'use client'

// ── PartnerAttributionRow — VINCULAR A MI PROMOTORA (rail row) ──────────────
//
// Gating ported verbatim from the dark PartnerAttributionField
// (components/dashboard/forms/shared/PartnerAttributionField.tsx —
// untouched, /admin keeps it): renders ONLY for partner-team members
// (currentUser.partnerId) and only on the 5 content types the publish route
// can stamp — otherwise null, never disabled-decoration. Value reflects
// reality: an explicit choice wins; otherwise it mirrors whether the item is
// currently partner-stamped. The route reads `attributePartner`
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

export function PartnerAttributionRow({
  draft,
  onChange,
}: {
  draft: ContentItem
  onChange: (value: boolean) => void
}) {
  const { currentUser } = useAuth()
  if (!currentUser?.partnerId || !STAMPED_TYPES.includes(draft.type)) return null

  const value = draft.attributePartner ?? !!draft.partnerId

  return (
    <ToggleL
      label="VINCULAR A MI PROMOTORA"
      value={value}
      onChange={onChange}
    />
  )
}
