/**
 * THE WRITE SEAM — where a world action meets the backend.
 *
 * `dispatch(action)` (world.tsx) applies the reducer at once, so every
 * gesture shows instantly, then looks up the effect registered for the
 * action's type and runs it:
 *
 *   resolves  the server has it. The action stays applied until a server
 *             snapshot read after that moment replaces it (see world.tsx).
 *   throws    the world is rebuilt without it (the gesture is undone) and
 *             the person is told it didn't go through.
 *   none      nothing is registered for that type yet: the change stays in
 *             this tab only and is gone on reload. Development warns:
 *             `[world] sin backend todavía: <type>`.
 *
 * An effect is a plain async function over the action — typically one fetch
 * to an app/api route — registered once at module load:
 *
 *   registerEffect('save', async (a) => {
 *     const res = await fetch('/api/saves', { method: a.on ? 'POST' : 'DELETE', … })
 *     if (!res.ok) throw new Error(`save ${res.status}`)
 *   })
 *
 * `ctx.before` is the world the action was applied to (for rows the action
 * only names by id — e.g. a draft-delete's item id) and `ctx.after` the world
 * it produced. A route that changes what the PUBLIC snapshot shows (comments,
 * publishing, polls, trophies…) must also expire the cache it lives in —
 * `revalidateTag(WORLD_TAG, { expire: 0 })` (Next 16 needs the profile
 * argument; lib/data/tags.ts) — before it responds, so the next snapshot a
 * refresh reads already contains the change. An effect that created or
 * deleted something asks for that refresh with `requestRefresh()`
 * (lib/store/refresh.ts, debounced).
 *
 * When the server names a row itself (a report's bigserial), the effect
 * resolves with `{ ids: { [clientId]: serverId } }`: the store replays its
 * log under the server's names (lib/store/ids.ts).
 *
 * The domain modules live in ./efectos (index.ts lists them).
 */

import type { Action, ActionType, World } from './world-core'

export interface EffectContext {
  /** The world the action was applied to. */
  before: World
  /** The world the action produced (what the person is looking at now). */
  after: World
}

/** What an effect may hand back: the server's names for rows it created (client id → server id). */
export type EffectResult = void | { ids?: Record<string, string> }

export type Effect<T extends ActionType = ActionType> = (action: Extract<Action, { t: T }>, ctx: EffectContext) => Promise<EffectResult> | EffectResult

export interface EffectOptions {
  /**
   * The action never reaches a server: the effect only keeps it on this
   * device (localStorage). The action stays in the log for the whole session
   * — no snapshot will ever contain it — and a failure undoes nothing.
   */
  local?: boolean
}

/**
 * A failure the person should read as it is (the server's own reason — «No te
 * quedan vales», «Edición agotada»). Any other throw shows the generic notice.
 */
export class EffectError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message)
  }
}

/**
 * POST JSON to an app/api route; a non-2xx answer throws an EffectError with
 * the route's `{ error }` message (or `fallback`).
 */
export async function postJson<T = unknown>(url: string, body: unknown, fallback = 'No se pudo guardar. El cambio se deshizo.'): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as { error?: unknown }
  if (!res.ok) throw new EffectError(`${url} → ${res.status}`, typeof data.error === 'string' && data.error ? data.error : fallback)
  return data as T
}

const registry = new Map<ActionType, Effect>()
const options = new Map<ActionType, EffectOptions>()

/** Register the backend call for an action type. Returns an unregister function. */
export function registerEffect<T extends ActionType>(t: T, fn: Effect<T>, opts: EffectOptions = {}): () => void {
  if (registry.has(t) && process.env.NODE_ENV !== 'production') console.warn(`[world] efecto duplicado para «${t}»: el último gana`)
  registry.set(t, fn as unknown as Effect)
  options.set(t, opts)
  return () => {
    if (registry.get(t) === (fn as unknown as Effect)) {
      registry.delete(t)
      options.delete(t)
    }
  }
}

export function effectFor(t: ActionType): Effect | undefined {
  return registry.get(t)
}

export function effectOptions(t: ActionType): EffectOptions {
  return options.get(t) ?? {}
}

/** The action types that reach the backend today. */
export function registeredEffects(): ActionType[] {
  return [...registry.keys()]
}
