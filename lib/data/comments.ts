// Server-side comment reads. Pure server module — DO NOT import into client
// components. Browser-side fetching lives in lib/hooks/useComments.ts.

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { Comment, Reaction } from '@/lib/types'

type CommentRow = Database['public']['Tables']['comments']['Row']
type ReactionRow = Database['public']['Tables']['comment_reactions']['Row']

interface CommentWithReactions extends CommentRow {
  comment_reactions: ReactionRow[]
}

export function rowToComment(row: CommentWithReactions): Comment {
  const reactions: Reaction[] = (row.comment_reactions ?? []).map((r) => ({
    userId: r.user_id,
    kind: r.kind,
    createdAt: r.created_at,
  }))

  const out: Comment = {
    id: row.id,
    contentItemId: row.item_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    reactions,
  }

  if (row.deletion_at && row.deletion_moderator_id) {
    out.deletion = {
      moderatorId: row.deletion_moderator_id,
      reason: row.deletion_reason ?? '',
      deletedAt: row.deletion_at,
    }
  }
  return out
}

export async function getCommentsForItem(itemId: string): Promise<Comment[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('comments')
    .select('*, comment_reactions(*)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as CommentWithReactions[]).map(rowToComment)
}
