import type { ActivityRow } from '@/lib/dashboard/activity'
import type { ContentType } from '@/lib/types'

export interface ActivityItemRef {
  id: string
  slug: string
  title: string
  image_url?: string | null
  type?: ContentType
}

// Incoming replies have their own comment IDs. Resolve those IDs to their
// parent publication as well as resolving the viewer's own reacted comments.
export function resolveActivityItem(
  row: ActivityRow,
  items: ReadonlyMap<string, ActivityItemRef>,
  commentItems: ReadonlyMap<string, string>,
): ActivityRow {
  const itemId = row.commentId ? commentItems.get(row.commentId) : undefined
  const item = itemId ? items.get(itemId) : undefined
  return item ? { ...row, targetTitle: item.title, itemSlug: item.slug,
    imageUrl: item.image_url ?? undefined, itemType: item.type } : row
}
