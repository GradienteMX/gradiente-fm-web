'use client'

// ── HP events — client helper ──────────────────────────────────────────────
//
// Fire-and-forget POST to /api/hp-events. The route is the only writer to
// `hp_events`; pg_cron's apply_hp_rollup batches the rows into items.hp
// every 5 min. See lib/curation.ts for the read-side decay math.
//
// All callers should ignore errors — engagement events are best-effort by
// design (a missed click shouldn't break a UI interaction). The fetch is
// keep-alive so brief navigations don't drop the request mid-flight.
//
// Auth is enforced server-side (the route rejects unauthenticated POSTs).
// Callers don't need to know whether the user is logged in — anonymous
// emissions silently 401 and the fire-and-forget swallows the error.

export type HpEventKind = 'click' | 'open' | 'save' | 'comment'

export function recordHpEvent(itemId: string, kind: HpEventKind): void {
  if (!itemId) return
  // keepalive so a click on a card followed by an immediate navigation still
  // delivers; small payload, well under the keepalive 64KB ceiling.
  void fetch('/api/hp-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, kind }),
    keepalive: true,
  }).catch(() => {
    // best-effort — swallow network/aborted errors silently
  })
}
