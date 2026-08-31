'use client'

import type { ContentItem } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { Toggle } from './Fields'

// Per-content franja-attribution toggle. Renders only for franja-team members
// and only on the content types the publish route can stamp. Lets the author
// explicitly link (or unlink) a piece with their promotora — and flip it later
// by re-publishing/editing.
//
// Renders a bare Toggle: every form drops it inside the IDENTIDAD section right
// below the EDITORIAL toggle, so it shares that card's chrome. Returns null for
// non-franja users (no stray control).
//
// Value reflects reality: an explicit choice wins; otherwise it mirrors whether
// the item is currently franja-stamped (so editing a branded item shows ON and
// can be turned OFF, while a brand-new item shows OFF until opted in). The
// route reads `attributeFranja` (true/false/undefined) — see app/api/items.
const STAMPED_TYPES: ContentItem['type'][] = [
  'evento',
  'mix',
  'noticia',
  'opinion',
  'listicle',
]

export function FranjaAttributionField({
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
    <Toggle
      label="VINCULAR ESTE CONTENIDO CON MI PROMOTORA"
      value={value}
      onChange={onChange}
    />
  )
}
