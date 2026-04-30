'use client'

// ── Frontend-only poll vote store ──────────────────────────────────────────
//
// Polls themselves are part of the ContentItem (see PollAttachment in
// lib/types.ts) — this module only tracks per-user *votes*. The poll
// definition rides along with the parent item through the seed / draft
// pipeline; only the cast votes are session-scoped.
//
// Anonymous-until-vote: callers that want to render results MUST first
// check whether the viewer has voted (`useUserVote` returns non-null) and
// branch on that. The aggregation helper (`usePollResults`) returns the
// counts unconditionally; the UI handles the reveal gate.
//
// When the real backend (see [[Supabase Migration]]) lands, swap castVote /
// clearVote for Supabase RPCs and replace the listener pattern with
// Realtime subscriptions on the `poll_votes` table. Hook signatures stay.

import { useEffect, useState } from 'react'
import type {
  ArticleBlock,
  ContentItem,
  PollAttachment,
  PollChoice,
  PollKind,
  PollVote,
} from './types'

const STORAGE_KEY = 'gradiente:polls'

interface SessionState {
  // Per-poll, per-user vote map. One vote per (pollId, userId); revoting
  // replaces the previous record outright (the poll's `multiChoice` knob
  // controls whether choiceIds can hold more than one id).
  votes: Record<string, Record<string, PollVote>>
}

function emptyState(): SessionState {
  return { votes: {} }
}

function readSession(): SessionState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      votes:
        parsed?.votes && typeof parsed.votes === 'object' ? parsed.votes : {},
    }
  } catch {
    return emptyState()
  }
}

function writeSession(s: SessionState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

// ── Read API ───────────────────────────────────────────────────────────────

export function getUserVote(pollId: string, userId: string): PollVote | null {
  const s = readSession()
  return s.votes[pollId]?.[userId] ?? null
}

// All votes for a poll, keyed by userId. Used for aggregation.
export function getPollVotes(pollId: string): Record<string, PollVote> {
  return readSession().votes[pollId] ?? {}
}

// ── Write API ──────────────────────────────────────────────────────────────

// Cast (or replace) the user's vote on a poll. `choiceIds` length is 1 for
// single-choice polls. Caller must validate that the choice ids exist in
// the resolved choice list — the storage layer doesn't re-check.
export function castVote(pollId: string, userId: string, choiceIds: string[]) {
  if (choiceIds.length === 0) return
  const s = readSession()
  s.votes = {
    ...s.votes,
    [pollId]: {
      ...(s.votes[pollId] ?? {}),
      [userId]: { choiceIds, votedAt: new Date().toISOString() },
    },
  }
  writeSession(s)
  notify()
}

// Drop the user's vote — re-anonymizes them. Useful for an "undo" affordance
// on the card, not exposed yet.
export function clearVote(pollId: string, userId: string) {
  const s = readSession()
  if (!s.votes[pollId]?.[userId]) return
  const { [userId]: _drop, ...rest } = s.votes[pollId]
  s.votes = { ...s.votes, [pollId]: rest }
  writeSession(s)
  notify()
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
// this poll (or when userId is null — logged-out viewer).
export function useUserVote(
  pollId: string | null,
  userId: string | null,
): PollVote | null {
  const [vote, setVote] = useState<PollVote | null>(null)
  useEffect(() => {
    if (!pollId || !userId) {
      setVote(null)
      return
    }
    const refresh = () => setVote(getUserVote(pollId, userId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
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
  const [results, setResults] = useState<PollResults>(() => ({
    totalVotes: 0,
    perChoice: Object.fromEntries(choices.map((c) => [c.id, 0])),
  }))
  useEffect(() => {
    if (!pollId) {
      setResults({
        totalVotes: 0,
        perChoice: Object.fromEntries(choices.map((c) => [c.id, 0])),
      })
      return
    }
    const refresh = () => setResults(aggregateVotes(getPollVotes(pollId), choices))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
    // `choices` shape is supplied externally; rebuild when its length changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, choices.length])
  return results
}
