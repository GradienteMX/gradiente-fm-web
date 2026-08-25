'use client'

// ── NOVEDADES — explicit follows, mechanical feed (FINAL_SPEC §3.5) ─────────
//
// Follows are EXPLICIT `{kind: 'partner' | 'genre', key}` choices stored in
// localStorage (lib/dashboard/localState — private-class data, addendum v3).
// This module is deliberately mechanical: one global browser query for the
// recent-published pool, one pure filter over the user's follows.
//
// No-Algorithm law: `published = true`, ordered `published_at` desc, filtered
// ONLY by the user's explicit follow choices. No scoring, no weights, no
// «recomendado para ti». The affinity table is never imported (grep gate).
// Public feeds stay global — the personalization here is a client-side lens
// over a global pool, derived from choices the user typed, not inferred taste.

import { createClient } from '@/lib/supabase/client'
import { ITEM_ROW_SELECT, mapItemRowToContentItem } from '@/lib/dashboard/openItem'
import type { ContentItem } from '@/lib/types'

// Structurally identical to lib/dashboard/localState's follow entries —
// duplicated as a named type so this module stays importable on its own.
export interface FollowRef {
  kind: 'partner' | 'genre'
  key: string
}

export interface PartnerOption {
  id: string // ContentItem id of the partner row — the follow key for kind 'partner'
  slug: string
  title: string
  imageUrl?: string
}

const POOL_DAYS = 30
const POOL_LIMIT = 60

// The global recent-published pool (provider slice `novedades`, shares the
// 60s tick). Partners never enter content feeds — their profile rows are the
// picker's catalogue, not novedades material.
export async function fetchNovedadesPool(): Promise<ContentItem[]> {
  const supabase = createClient()
  const since = new Date(Date.now() - POOL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_ROW_SELECT)
    .eq('published', true)
    .neq('type', 'partner')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(POOL_LIMIT)
  if (error) {
    console.error('[fetchNovedadesPool]', error)
    return []
  }
  return ((data ?? []) as any[]).map(mapItemRowToContentItem)
}

// The picker's real partner catalogue (§3.5 — the empty state IS the picker).
// Partner rows are `items` type='partner'; the row id doubles as the
// `partner_id` content items carry, so it IS the follow key.
export async function fetchPartnerOptions(): Promise<PartnerOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('items')
    .select('id, slug, title, image_url')
    .eq('type', 'partner')
    .eq('published', true)
    .order('title', { ascending: true })
  if (error) {
    console.error('[fetchPartnerOptions]', error)
    return []
  }
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.image_url ?? undefined,
  }))
}

// Pure mechanical filter — order preserved (published_at desc from the
// query). A partner follow matches attribution (`item.partnerId`); a genre
// follow matches taxonomy membership. Nothing else.
export function filterByFollows(
  items: readonly ContentItem[],
  follows: readonly FollowRef[],
): ContentItem[] {
  if (follows.length === 0) return []
  const partnerKeys = new Set<string>()
  const genreKeys = new Set<string>()
  for (const f of follows) {
    if (f.kind === 'partner') partnerKeys.add(f.key)
    else genreKeys.add(f.key)
  }
  return items.filter(
    (item) =>
      (item.partnerId !== undefined && partnerKeys.has(item.partnerId)) ||
      item.genres.some((g) => genreKeys.has(g)),
  )
}

// «N NUEVOS» — derives from the single localStorage watermark (state, not a
// second ledger). Same key ACTIVIDAD advances; this module never writes it.
export function countNewSince(
  items: readonly ContentItem[],
  watermarkIso: string | null,
): number {
  if (!watermarkIso) return items.length
  let n = 0
  for (const item of items) if (item.publishedAt > watermarkIso) n += 1
  return n
}
