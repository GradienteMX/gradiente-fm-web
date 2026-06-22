import { createClient } from '@/lib/supabase/server'
import type { Entity, EntityKind, EntityLink } from '@/lib/types'

// Scene-entity reads (migration 0029). Write paths live in /api/entities.

type EntityRowShape = {
  id: string
  kind: EntityKind
  name: string
  slug: string
  bio: string | null
  image_url: string | null
  city: string | null
  links: unknown
  merged_into: string | null
}

function rowToEntity(row: EntityRowShape): Entity {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? undefined,
    imageUrl: row.image_url ?? undefined,
    city: row.city ?? undefined,
    links: Array.isArray(row.links) ? (row.links as EntityLink[]) : undefined,
  }
}

const ENTITY_SELECT =
  'id, kind, name, slug, bio, image_url, city, links, merged_into'

// Resolve an entity by slug. Follows a single `merged_into` hop so a link to a
// de-duped entity transparently lands on its canonical row. Slugs are unique
// per kind, so a bare slug can in theory collide across kinds — first match
// wins (acceptable until/if we route by kind).
export async function getEntityBySlug(slug: string): Promise<Entity | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('entities')
    .select(ENTITY_SELECT)
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error(`[getEntityBySlug] ${slug}:`, error)
    return null
  }
  if (!data) return null
  const row = data as EntityRowShape

  if (row.merged_into) {
    const { data: canonical } = await supabase
      .from('entities')
      .select(ENTITY_SELECT)
      .eq('id', row.merged_into)
      .maybeSingle()
    if (canonical) return rowToEntity(canonical as EntityRowShape)
  }
  return rowToEntity(row)
}
