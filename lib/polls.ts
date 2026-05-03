'use client'

// ── Poll vote store ────────────────────────────────────────────────────────
//
// Polls themselves are part of the ContentItem (see PollAttachment in
// lib/types.ts and the join in lib/data/items.ts) — this module tracks
// per-user *votes* against the `poll_votes` table.
//
// MIGRATION STATE (2026-05-03):
//   - `castVote` / `clearVote` → API (POST/DELETE /api/polls/[pollId]/vote),
//     optimistic-local-then-confirm. Mirrors saves / reactions.
//   - `useUserVote` / `usePollResults` → read from lib/pollVotesCache.ts;
//     first subscriber per pollId triggers a fetch.
//   - `getUserVote` / `getPollVotes` → sync reads off the cache. Only
//     useful AFTER a hook subscription on the same poll has primed it.
//
// Anonymous-until-vote: callers that want to render results MUST first
// check whether the viewer has voted (`useUserVote` returns non-null) and
// branch on that. The aggregation helper (`usePollResults`) returns the
// counts unconditionally; the UI handles the reveal gate.

import { useEffect, useState } from 'react'
import type {
  ArticleBlock,
  ContentItem,
  PollAttachment,
  PollChoice,
  PollKind,
  PollVote,
} from './types'
import {
  ensurePollVotesFetched,
  getPollVotesSync,
  getUserVoteSync,
  removeLocalVote,
  setLocalVote,
  subscribePollVotes,
} from './pollVotesCache'

// ── Read API ───────────────────────────────────────────────────────────────

export function getUserVote(pollId: string, userId: string): PollVote | null {
  return getUserVoteSync(pollId, userId)
}

// All votes for a poll, keyed by userId. Used for aggregation.
export function getPollVotes(pollId: string): Record<string, PollVote> {
  return getPollVotesSync(pollId)
}

// ── Write API ──────────────────────────────────────────────────────────────

// Cast (or replace) the user's vote on a poll. Optimistic: cache flips
// immediately, then the API confirms; rollback on failure. `userId` is used
// for the local cache key — the server uses auth.uid() regardless.
export async function castVote(
  pollId: string,
  userId: string,
  choiceIds: string[],
) {
  if (choiceIds.length === 0) return
  const previous = getUserVoteSync(pollId, userId)
  setLocalVote(pollId, userId, {
    choiceIds,
    votedAt: new Date().toISOString(),
  })
  try {
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ choiceIds }),
    })
    if (!res.ok) throw new Error('vote api failed')
  } catch {
    // Rollback to whatever was there before (might be null = unvoted).
    if (previous) setLocalVote(pollId, userId, previous)
    else removeLocalVote(pollId, userId)
  }
}

// Drop the user's vote — re-anonymizes them. Optimistic + rollback.
export async function clearVote(pollId: string, userId: string) {
  const previous = getUserVoteSync(pollId, userId)
  if (!previous) return
  removeLocalVote(pollId, userId)
  try {
    const res = await fetch(`/api/polls/${pollId}/vote`, { method: 'DELETE' })
    if (!res.ok) throw new Error('clear-vote api failed')
  } catch {
    setLocalVote(pollId, userId, previous)
  }
}

// ── Per-type choice resolution ─────────────────────────────────────────────

// `from-list` → pull every `track` block out of the listicle's articleBody,
// label as "Artist — Title". Falls back to the block's pre-rendered text
// when artist/title are missing (defensive — seed data should always have
// both, but a session draft might not).
function choicesFromList(item: ContentItem): PollChoice[] {
  const blocks = item.articleBody ?? []
  return blocks
    .filter((b): b is Extract<ArticleBlock, { kind: 'track' }> => b.kind === 'track')
    .map((b, i) => ({
      id: `track-${i}`,
      label: `${b.artist} — ${b.title}`,
    }))
}

// `from-tracklist` → mix's tracklist as choices.
function choicesFromTracklist(item: ContentItem): PollChoice[] {
  return (item.tracklist ?? []).map((t, i) => ({
    id: `tk-${i}`,
    label: `${t.artist} — ${t.title}`,
  }))
}

// `attendance` → fixed VOY / TAL VEZ / NO PUEDO. Spanish UI; consistent
// with project copy in [[Voice and Copy]].
const ATTENDANCE_CHOICES: PollChoice[] = [
  { id: 'voy', label: 'VOY' },
  { id: 'tal-vez', label: 'TAL VEZ' },
  { id: 'no-puedo', label: 'NO PUEDO' },
]

// Returns the *live* choice list for a poll. For non-freeform kinds, this
// derives from the parent item (so editing the parent's tracklist updates
// the poll's choices automatically). Freeform polls return their stored
// `choices` array verbatim.
export function resolvePollChoices(
  item: ContentItem,
  poll: PollAttachment,
): PollChoice[] {
  switch (poll.kind) {
    case 'from-list':
      return choicesFromList(item)
    case 'from-tracklist':
      return choicesFromTracklist(item)
    case 'attendance':
      return ATTENDANCE_CHOICES
    case 'freeform':
      return poll.choices ?? []
  }
}

// ── Aggregation ────────────────────────────────────────────────────────────

export interface PollResults {
  totalVotes: number          // count of distinct voters (not choices)
  perChoice: Record<string, number>  // choice id → count of voters who picked it
}

export function aggregateVotes(
  votes: Record<string, PollVote>,
  choices: PollChoice[],
): PollResults {
  const perChoice: Record<string, number> = {}
  for (const c of choices) perChoice[c.id] = 0
  let totalVotes = 0
  for (const v of Object.values(votes)) {
    totalVotes++
    for (const id of v.choiceIds) {
      if (id in perChoice) perChoice[id]++
    }
  }
  return { totalVotes, perChoice }
}

// ── Closure logic ──────────────────────────────────────────────────────────

export function isPollClosed(poll: PollAttachment): boolean {
  if (!poll.closesAt) return false
  return new Date(poll.closesAt).getTime() <= Date.now()
}

// ── Default prompts per kind ───────────────────────────────────────────────
//
// Used by dashboard forms as the placeholder when a poll is added — editor
// can override.

export const POLL_DEFAULT_PROMPT: Record<PollKind, string> = {
  'from-list': 'Tu favorito?',
  'from-tracklist': 'Mejor track del set?',
  attendance: 'Vas?',
  freeform: '',
}

// ── Hooks ──────────────────────────────────────────────────────────────────

// Live user-vote subscription. Returns null when the user hasn't voted on
// this poll (or when userId is null — logged-out viewer). Triggers a fetch
// of the poll's votes on first subscription so anonymous viewers also
// prime the cache for the parallel usePollResults call.
export function useUserVote(
  pollId: string | null,
  userId: string | null,
): PollVote | null {
  const [vote, setVote] = useState<PollVote | null>(() =>
    pollId && userId ? getUserVoteSync(pollId, userId) : null,
  )
  useEffect(() => {
    if (!pollId) {
      setVote(null)
      return
    }
    void ensurePollVotesFetched(pollId)
    if (!userId) {
      setVote(null)
      return
    }
    const refresh = () => setVote(getUserVoteSync(pollId, userId))
    refresh()
    return subscribePollVotes(refresh)
  }, [pollId, userId])
  return vote
}

// Live aggregated results for a poll. The caller passes the resolved choice
// list (because choices may be derived from the parent — only the caller
// has the parent in hand).
export function usePollResults(
  pollId: string | null,
  choices: PollChoice[],
): PollResults {
  const [results, setResults] = useState<PollResults>(() =>
    pollId
      ? aggregateVotes(getPollVotesSync(pollId), choices)
      : {
          totalVotes: 0,
          perChoice: Object.fromEntries(choices.map((c) => [c.id, 0])),
        },
  )
  useEffect(() => {
    if (!pollId) {
      setResults({
        totalVotes: 0,
        perChoice: Object.fromEntries(choices.map((c) => [c.id, 0])),
      })
      return
    }
    void ensurePollVotesFetched(pollId)
    const refresh = () =>
      setResults(aggregateVotes(getPollVotesSync(pollId), choices))
    refresh()
    return subscribePollVotes(refresh)
    // `choices` shape is supplied externally; rebuild when its length changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, choices.length])
  return results
}
