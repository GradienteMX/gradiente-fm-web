/**
 * REFRESH — asking the server for a newer world, sparingly.
 *
 * The world arrives with the page (app/layout.tsx), so the only way to see
 * the server's truth after a write — the row as it was stored, a server id,
 * a count someone else moved — is `router.refresh()`: the layout reads the
 * snapshots again and WorldProvider rebases on them. Each refresh re-reads
 * the viewer's private rows and, when a write expired it, the whole public
 * world (~0.9 MB for 600 pieces), so effects never call it directly. They
 * call `requestRefresh()`, which folds a burst of writes into one refresh:
 *
 *   debounce   700 ms after the last request (the burst is over)
 *   max wait   3 s after the first request of a burst (a long burst still
 *              lands)
 *   min gap    2 s between two refreshes (a write every second never turns
 *              into a refresh every second)
 *   hidden     a tab in the background doesn't refresh; it does once it's
 *              looked at again
 *
 * Who asks: the effects of creates and deletes (a comment, a thread, a
 * publish, a listing, an invitation…) and of writes whose result the server
 * computes (a harvest, an HL adjustment). Toggles (save, react, vote, a
 * reading) don't: the optimistic state is already what the server holds, and
 * their aggregates arrive with the next refresh anyone asks for.
 *
 * The scheduler is plain (injected clock and timers) so it can be tested;
 * the one the app uses is at the bottom.
 */

export interface RefreshDeps {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
  /** The page isn't being looked at. */
  hidden: () => boolean
}

export interface RefreshTiming {
  debounceMs: number
  maxWaitMs: number
  minGapMs: number
}

export const REFRESH_TIMING: RefreshTiming = { debounceMs: 700, maxWaitMs: 3000, minGapMs: 2000 }

export interface RefreshScheduler {
  /** Who actually refreshes (WorldProvider installs `router.refresh`); null while nothing is mounted. */
  setRefresher: (fn: (() => void) | null) => void
  /** A write wants the server's truth soon. */
  request: () => void
  /** The page is looked at again: a refresh held back while hidden goes now. */
  visible: () => void
  /** A refresh is scheduled or held back. */
  pending: () => boolean
}

export function createRefreshScheduler(deps: RefreshDeps, timing: RefreshTiming = REFRESH_TIMING): RefreshScheduler {
  let refresher: (() => void) | null = null
  let timer: unknown = null
  let burstStart: number | null = null
  let lastFire = Number.NEGATIVE_INFINITY
  let held = false

  const fire = () => {
    timer = null
    burstStart = null
    if (!refresher) return
    if (deps.hidden()) {
      held = true
      return
    }
    held = false
    lastFire = deps.now()
    refresher()
  }

  const request = () => {
    const t = deps.now()
    if (burstStart === null) burstStart = t
    if (timer !== null) deps.clearTimeout(timer)
    const due = Math.max(Math.min(t + timing.debounceMs, burstStart + timing.maxWaitMs), lastFire + timing.minGapMs)
    timer = deps.setTimeout(fire, Math.max(0, due - t))
  }

  return {
    setRefresher: (fn) => {
      refresher = fn
    },
    request,
    visible: () => {
      if (!held || timer !== null) return
      held = false
      request()
    },
    pending: () => timer !== null || held,
  }
}

const scheduler = createRefreshScheduler({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
})

/** A write wants the server's truth soon (debounced — see above). */
export function requestRefresh(): void {
  scheduler.request()
}

/** WorldProvider installs the router's refresh here (null on unmount). */
export function setRefresher(fn: (() => void) | null): void {
  scheduler.setRefresher(fn)
}

/** The page became visible again. */
export function refreshOnVisible(): void {
  scheduler.visible()
}
