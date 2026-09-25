import type { SupabaseClient } from '@supabase/supabase-js'
import type { FranjaKind, FranjaRef } from '@/lib/types'
import { chunked } from '@/lib/data/rows'

// ── Franja subject links — shared two-query resolver ─────────────────────────
//
// Works with either the server (cookies-aware) or the browser Supabase client,
// so lib/data/items.ts, useMyPublishedItems and openItem share one recipe.
// Two queries rather than a PostgREST embed on purpose: an embed would fail
// the WHOLE items select while migration 0051 is pending, and these links are
// decorative next to the item itself. Any error degrades to "no links".

export async function fetchFranjaRefsByItemIds(
  // Untyped on purpose — generated Database types lag hand-applied migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  itemIds: string[],
): Promise<Map<string, FranjaRef[]>> {
  const out = new Map<string, FranjaRef[]>()
  const ids = Array.from(new Set(itemIds.filter(Boolean)))
  if (ids.length === 0) return out

  // `.in()` lists travel in the URL: long ones are split (lib/data/rows.ts).
  const linkPages = await Promise.all(chunked(ids).map((part) => supabase.from('item_franjas').select('item_id, franja_id').in('item_id', part)))
  const linkRows: { item_id: string; franja_id: string }[] = []
  for (const { data: links, error: linkError } of linkPages) {
    if (linkError) {
      // 42P01 = table missing (migration 0051 not applied yet) — silent.
      if (linkError.code !== '42P01') console.error('[fetchFranjaRefsByItemIds] links', linkError)
      return out
    }
    linkRows.push(...((links ?? []) as { item_id: string; franja_id: string }[]))
  }
  if (linkRows.length === 0) return out

  const franjaIds = Array.from(new Set(linkRows.map((l) => l.franja_id)))
  const rowPages = await Promise.all(chunked(franjaIds).map((part) => supabase.from('items').select('id, title, slug, franja_kind').in('id', part)))
  const byId = new Map<string, FranjaRef>()
  for (const { data: rows, error: rowError } of rowPages) {
    if (rowError) {
      console.error('[fetchFranjaRefsByItemIds] franjas', rowError)
      return out
    }
    for (const r of (rows ?? []) as { id: string; title: string; slug: string; franja_kind: string | null }[]) {
      byId.set(r.id, { id: r.id, title: r.title, slug: r.slug, kind: (r.franja_kind ?? 'venue') as FranjaKind })
    }
  }
  for (const link of linkRows) {
    const ref = byId.get(link.franja_id)
    if (!ref) continue
    const list = out.get(link.item_id)
    if (list) list.push(ref)
    else out.set(link.item_id, [ref])
  }
  return out
}
