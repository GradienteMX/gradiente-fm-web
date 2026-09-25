/**
 * What this device remembers — and nothing else does.
 *
 * The activity watermark («visto»: everything in your ACTIVIDAD up to this
 * instant reads as seen) lives per device, in localStorage, exactly as
 * production kept it (main:lib/dashboard/localState.ts): it is private, it
 * has no table, and `users.profile_meta` is member-readable, so it can't live
 * there. The key is production's own, so the watermark a person set in the
 * old dashboard carries over. Namespaced per user so two accounts on one
 * browser never share it. Advance-only: a stale tab can't make seen rows new.
 *
 * A browser that refuses storage (private mode, quota) simply forgets: the
 * watermark then lasts for the session, in the world's log.
 */

const seenKey = (uid: string) => `gradiente:dashboard:lastSeenActivity:${uid}`

export function readSeenWatermark(uid: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(seenKey(uid))
    return v && !Number.isNaN(Date.parse(v)) ? v : null
  } catch {
    return null
  }
}

export function advanceSeenWatermark(uid: string, iso: string): void {
  if (typeof window === 'undefined' || Number.isNaN(Date.parse(iso))) return
  const cur = readSeenWatermark(uid)
  if (cur && cur >= iso) return
  try {
    window.localStorage.setItem(seenKey(uid), iso)
  } catch {
    // Storage refused: this session still has it in the world.
  }
}
