/**
 * IDS — which name a row goes by, on the client and on the server.
 *
 * Most rows keep the id the client minted when the gesture happened, so a
 * follow-up on a row that was just created (a reply to a new thread, an edit
 * of a new comment, publishing a just-saved draft) needs nothing special:
 *
 *   comments, foro threads and replies,   uuid columns: the client mints a
 *   listing questions, new polls           uuid (`newUuid`), the route
 *                                          accepts it when it is a uuid
 *   items, marketplace listings           text columns: the client's id
 *   drafts                                keyed by their item's id
 *   invitation codes                      the code is the key
 *
 * Every route INSERTS a proposed id — never upserts it — so a collision is a
 * refusal (409), not an overwrite of someone else's row.
 *
 * Two kinds of row are named by the server: reports (a bigserial) and a poll
 * whose client id isn't a uuid (drafts written before V2). Their effects hand
 * the server's name to `trackId`; an effect that refers to such a row asks
 * `serverId` first (it waits for the create while it is in flight); and the
 * store replays its log through `remapIds` with `knownIds()`, so the world
 * calls the row by the server's name from the moment it is known.
 *
 * Module state, per tab — like the effect registry. Ids are unique across the
 * whole world, so one map serves every store.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

/**
 * A random (v4) uuid. `crypto.randomUUID` only exists in secure contexts
 * (https, localhost); a phone testing the dev server over the LAN gets the
 * same shape from `getRandomValues`.
 */
export function newUuid(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const resolved = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

/**
 * A create whose row the server names: `name` resolves to the server's id.
 * Until it does, `serverId(clientId)` waits for it; afterwards it answers at
 * once. Returns `name` (so the effect can await it).
 */
export function trackId(clientId: string, name: Promise<string>): Promise<string> {
  const p = name.then((id) => {
    if (id && id !== clientId) resolved.set(clientId, id)
    return id
  })
  pending.set(clientId, p)
  const clear = () => {
    if (pending.get(clientId) === p) pending.delete(clientId)
  }
  p.then(clear, clear)
  return p
}

/** Record names the server gave (an effect's `{ ids }` result). */
export function rememberIds(ids: Record<string, string>): boolean {
  let changed = false
  for (const [from, to] of Object.entries(ids)) {
    if (!from || !to || from === to || resolved.get(from) === to) continue
    resolved.set(from, to)
    changed = true
  }
  return changed
}

/**
 * The id the server knows a row by: the client's own for nearly everything;
 * the server's for a report or a legacy poll once its create has answered
 * (waiting for it while it is in flight). A create that failed leaves the
 * client id — the follow-up then fails honestly on its own.
 */
export async function serverId(id: string): Promise<string> {
  const p = pending.get(id)
  if (p) {
    try {
      return await p
    } catch {
      return id
    }
  }
  return resolved.get(id) ?? id
}

/** Every client id the server renamed so far (client id → server id). */
export function knownIds(): ReadonlyMap<string, string> {
  return resolved
}

/**
 * `value` with every string that is exactly a renamed client id replaced by
 * the server's id — deep, through arrays and plain objects. Returns the same
 * reference when nothing changed (so replaying an untouched log allocates
 * nothing). Pure.
 */
export function remapIds<T>(value: T, map: ReadonlyMap<string, string>): T {
  if (map.size === 0) return value
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return map.get(v) ?? v
    if (Array.isArray(v)) {
      let changed = false
      const out = v.map((x) => {
        const y = walk(x)
        if (y !== x) changed = true
        return y
      })
      return changed ? out : v
    }
    if (v && typeof v === 'object') {
      let changed = false
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const y = walk(x)
        if (y !== x) changed = true
        out[k] = y
      }
      return changed ? out : v
    }
    return v
  }
  return walk(value) as T
}
