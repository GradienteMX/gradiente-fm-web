// Server-only foro reads. Mirrors the shape lib/data/items.ts uses for
// content items. Browser-side reads + writes live in lib/hooks/useForo.ts +
// the route handlers under /api/foro/*.

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { ForoReply, ForoThread } from '@/lib/types'

type ThreadRow = Database['public']['Tables']['foro_threads']['Row']
type ReplyRow = Database['public']['Tables']['foro_replies']['Row']

function rowToThread(row: ThreadRow): ForoThread {
  const out: ForoThread = {
    id: row.id,
    authorId: row.author_id,
    subject: row.subject,
    body: row.body,
    imageUrl: row.image_url,
    genres: row.genres,
    createdAt: row.created_at,
    bumpedAt: row.bumped_at,
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

function rowToReply(row: ReplyRow): ForoReply {
  const out: ForoReply = {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    body: row.body,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
    quotedReplyIds: (row.quoted_reply_ids as string[] | null) ?? undefined,
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

// Catalog order: bumped_at desc, with the partial index (no archived, no
// tombstoned) doing the heavy lifting at the policy layer. RLS hides
// seed=true threads from anon; staff (guide/admin) see everything.
export async function getThreads(): Promise<ForoThread[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('foro_threads')
    .select('*')
    .eq('archived', false)
    .order('bumped_at', { ascending: false })

  if (error) {
    console.error('[getThreads]', error)
    return []
  }
  return (data ?? []).map(rowToThread)
}

export async function getThreadById(id: string): Promise<ForoThread | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('foro_threads')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error(`[getThreadById] ${id}`, error)
    return null
  }
  return data ? rowToThread(data) : null
}

export async function getRepliesForThread(threadId: string): Promise<ForoReply[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('foro_replies')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error(`[getRepliesForThread] ${threadId}`, error)
    return []
  }
  return (data ?? []).map(rowToReply)
}
