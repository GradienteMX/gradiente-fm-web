'use client'

import { createContext, useContext } from 'react'
import type { ContentItem, EntityRef, User } from '@/lib/types'
import type { Formato, Need, PlannedSection, Prior } from './model'

/** What the table knows about the world while you write. */
export interface Knowledge {
  /** Lineup names already on the field (artist suggestions). */
  artists: string[]
  /** Venues already on the field, with their city line. */
  venues: Array<{ name: string; city?: string }>
  /** Entity refs already attached to pieces (reused, not duplicated). */
  entities: EntityRef[]
  /** Every franja on the dial (subject links). */
  franjas: ContentItem[]
  /** User-created tags already in use (shared vocabulary with the foro). */
  customTags: string[]
}

export interface MesaEnv {
  me: User
  type: Formato
  flyers: string[]
  /** The published piece when editing (`?editar=`), else null. */
  existing: ContentItem | null
  knowledge: Knowledge
  plan: PlannedSection[]
  needs: Need[]
  prior: Prior | null
  /** Another piece already uses this slug. */
  slugTaken: (slug: string) => boolean
  /** Slug follows the title until the author edits the link. */
  slugFollows: boolean
  setSlugFollows: (v: boolean) => void
  /** Jump to a field (readiness links, index rail). */
  jump: (needOrSection: string) => void
  /** The energy band under the author's hand, before it settles. */
  onEnergyLive: (band: [number, number] | null) => void
  /** The section a jump is heading to (opens disclosures on the way). */
  reveal: { key: string; n: number } | null
}

export interface FormApi {
  item: ContentItem
  /** Shallow patch; title edits keep an auto slug in step. */
  patch: (p: Partial<ContentItem>) => void
  env: MesaEnv
}

export const MesaContext = createContext<MesaEnv | null>(null)

export function useMesa(): MesaEnv {
  const v = useContext(MesaContext)
  if (!v) throw new Error('MesaContext missing')
  return v
}
