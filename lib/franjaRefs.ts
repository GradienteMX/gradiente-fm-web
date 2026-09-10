import type { SupabaseClient } from '@supabase/supabase-js'
import type { FranjaKind, FranjaRef } from '@/lib/types'

// ── Franja subject links — shared two-query resolver ─────────────────────────
//
// Works with either the server (cookies-aware) or the browser Supabase client,
// so lib/data/items.ts, useMyPublishedItems and openItem share one recipe.
// Two queries rather than a PostgREST embed on purpose: an embed would fail
// the WHOLE items select while migration 0051 is pending, and these links are
// decorative next to the item itself. Any error degrades to "no links".

export async function fetchFranjaRefsByItemIds(
  // Untyped on purpose — generated Database types lag hand-applied migrations.
  supabase: SupabaseClient<any, any, any>,
  itemIds: string[],
): Promise<Map<string, FranjaRef[]>> {
  const out = new Map<string, FranjaRef[]>()
  const ids = Array.from(new Set(itemIds.filter(Boolean)))
  if (ids.length === 0) return out

  const { data: links, error: linkError } = await supabase
    .from('item_franjas')
    .select('item_id, franja_id')
    .in('item_id', ids)
  if (linkError) {
    // 42P01 = table missing (migration 0051 not applied yet) — silent.
    if (linkError.code !== '42P01') console.error('[fetchFranjaRefsByItemIds] links', linkError)
    return out
  }
  const linkRows = (links ?? []) as { item_id: string; franja_id: string }[]
  if (linkRows.length === 0) return out

  const franjaIds = Array.from(new Set(linkRows.map((l) => l.franja_id)))
  const { data: rows, error: rowError } = await supabase
    .from('items')
    .select('id, title, slug, franja_kind')
    .in('id', franjaIds)
  if (rowError) {
    console.error('[fetchFranjaRefsByItemIds] franjas', rowError)
    return out
  }
  const byId = new Map<string, FranjaRef>()
  for (const r of (rows ?? []) as { id: string; title: string; slug: string; franja_kind: string | null }[]) {
    byId.set(r.id, { id: r.id, title: r.title, slug: r.slug, kind: (r.franja_kind ?? 'venue') as FranjaKind })
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
