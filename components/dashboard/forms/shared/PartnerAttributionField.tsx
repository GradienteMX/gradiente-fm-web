'use client'

import type { ContentItem } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { Toggle } from './Fields'

// Per-content partner-attribution toggle. Renders only for partner-team members
// and only on the content types the publish route can stamp. Lets the author
// explicitly link (or unlink) a piece with their promotora — and flip it later
// by re-publishing/editing.
//
// Value reflects reality: an explicit choice wins; otherwise it mirrors whether
// the item is currently partner-stamped (so editing a branded item shows ON and
// can be turned OFF, while a brand-new item shows OFF until opted in). The
// route reads `attributePartner` (true/false/undefined) — see app/api/items.
const STAMPED_TYPES: ContentItem['type'][] = [
  'evento',
  'mix',
  'noticia',
  'opinion',
  'listicle',
]

export function PartnerAttributionField({
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
    <Toggle
      label="VINCULAR ESTE CONTENIDO CON MI PROMOTORA"
      value={value}
      onChange={onChange}
    />
  )
}
