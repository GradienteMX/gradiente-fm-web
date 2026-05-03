'use client'

// ── Poll votes — module-level cache ─────────────────────────────────────────
//
// Holds all known poll_votes rows keyed by pollId → userId → vote. The first
// hook subscriber for a pollId triggers a fetch (`ensurePollVotesFetched`);
// concurrent subscribers share the in-flight promise. Optimistic writes
// (castVote / clearVote in lib/polls.ts) update the cache immediately, then
// the API confirms or rolls back.
//
// One cache covers both consumers:
//   - useUserVote(pollId, userId) reads the user's row.
//   - usePollResults(pollId, choices) aggregates over all rows.
//
// Listener-based React subscription matches lib/savedCommentsCache.ts /
// lib/itemSavesCache.ts / lib/reactionsCache.ts — re-renders on any cache
// mutation regardless of the caller.

import { createClient } from '@/lib/supabase/client'
import type { PollVote } from './types'

const cache = new Map<string, Record<string, PollVote>>()
const fetched = new Set<string>()
const inFlight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Reads ──────────────────────────────────────────────────────────────────

export function getPollVotesSync(pollId: string): Record<string, PollVote> {
  return cache.get(pollId) ?? {}
}

export function getUserVoteSync(pollId: string, userId: string): PollVote | null {
  return cache.get(pollId)?.[userId] ?? null
}

// ── Writes (server truth) ──────────────────────────────────────────────────

export function setPollVotes(pollId: string, votes: Record<string, PollVote>) {
  cache.set(pollId, votes)
  fetched.add(pollId)
  notify()
}

// ── Writes (optimistic local) ──────────────────────────────────────────────

export function setLocalVote(pollId: string, userId: string, vote: PollVote) {
  const existing = cache.get(pollId) ?? {}
  cache.set(pollId, { ...existing, [userId]: vote })
  notify()
}

export function removeLocalVote(pollId: string, userId: string) {
  const existing = cache.get(pollId)
  if (!existing || !(userId in existing)) return
  const { [userId]: _drop, ...rest } = existing
  cache.set(pollId, rest)
  notify()
}

export function clearAllPollVotes() {
  if (cache.size === 0 && fetched.size === 0) return
  cache.clear()
  fetched.clear()
  notify()
}

// ── Subscription ───────────────────────────────────────────────────────────

export function subscribePollVotes(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// ── Lazy fetch ─────────────────────────────────────────────────────────────
//
// First subscriber for a pollId triggers a fetch; concurrent subscribers
// await the same in-flight promise. Refetching is left to manual callers
// (e.g. realtime subscriptions) — for now the optimistic cache is the only
// post-mount mutator.

export function ensurePollVotesFetched(pollId: string): Promise<void> {
  if (fetched.has(pollId)) return Promise.resolve()
  const existing = inFlight.get(pollId)
  if (existing) return existing
  const p = fetchPollVotes(pollId).finally(() => inFlight.delete(pollId))
  inFlight.set(pollId, p)
  return p
}

async function fetchPollVotes(pollId: string): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('poll_votes')
    .select('user_id, choice_ids, voted_at')
    .eq('poll_id', pollId)
  if (error) {
    console.error(`[pollVotesCache] fetch ${pollId}:`, error)
    return
  }
  const map: Record<string, PollVote> = {}
  for (const row of data ?? []) {
    map[row.user_id] = { choiceIds: row.choice_ids, votedAt: row.voted_at }
  }
  setPollVotes(pollId, map)
}
