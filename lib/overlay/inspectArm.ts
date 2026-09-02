// ── Inspection arming — the one-shot state machine ──────────────────────────
//
// Extracted from OverlayProvider so it can be tested without a renderer. It is
// ten lines of logic, and it is here precisely BECAUSE it is ten lines: the
// first version was a boolean, and a boolean is wrong in a way nothing visible
// would ever reveal.
//
// The failure it exists to prevent: `?item=X&inspect=1` arms the flag, but
// OverlayRouter only consumes it when an item actually MOUNTS. A deep-linked
// `?item=` regularly resolves to nothing on a cold load (resolveSlug reads an
// items cache ContentGrid fills later, and the open effect does not re-run when
// it does). A boolean armed by such an open is never consumed, stays armed for
// the rest of the session, and silently mutes the next GENUINE open. The
// symptom would be missing engagement — invisible, unattributable, and
// indistinguishable from "nobody read it".
//
// Keying on the slug bounds the damage to nothing: a stale arm can only match
// the item it was armed for, and every other open clears it on the way past.

export interface InspectArm {
  /** Arm suppression for one specific slug. */
  arm: (slug: string) => void
  /** Drop any arming — a programmatic open is always a real one. */
  disarm: () => void
  /**
   * True only if `slug` is the armed one. ALWAYS clears, whatever the answer:
   * a non-matching open proves the armed slug never mounted, so keeping it can
   * only mislead a later open.
   */
  consume: (slug: string) => boolean
  /** Current arming, for tests and debugging. */
  peek: () => string | null
}

export function createInspectArm(): InspectArm {
  let armed: string | null = null
  return {
    arm: (slug: string) => {
      armed = slug
    },
    disarm: () => {
      armed = null
    },
    consume: (slug: string) => {
      const hit = armed === slug
      armed = null
      return hit
    },
    peek: () => armed,
  }
}
