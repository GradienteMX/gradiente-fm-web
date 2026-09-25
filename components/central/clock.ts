'use client'

import { useNowMs, useWorld } from '@/lib/store/world'

/**
 * Central's clock. The world clock ticks every 30 s, but an action carries
 * its own timestamp — right after an adjustment the clock can sit behind the
 * ledger row it just wrote, and a trajectory drawn "until now" would stop
 * short of the jump. Central reads time as never earlier than its own log.
 *
 * `now` moves with the world clock; `tick` is the same instant floored to
 * the minute (for heavy memos) but never earlier than the last action.
 */
export function useClock(): { now: number; tick: number } {
  const world = useNowMs()
  const last = useWorld((st) => (st.log.length ? Date.parse(st.log[st.log.length - 1].at) : 0))
  const now = Math.max(world, last)
  const tick = Math.max(Math.floor(world / 60_000) * 60_000, last)
  return { now, tick }
}
