/**
 * Cache tags of the server snapshots (lib/data/world.ts, lib/data/stickers.ts).
 *
 * A route handler whose write changes what every member sees expires the
 * public world before it answers:
 *
 *   revalidateTag(WORLD_TAG, { expire: 0 })
 *
 * Next 16 requires the second argument; `{ expire: 0 }` makes the next read
 * wait for fresh rows instead of serving the stale entry once more, so the
 * refresh the client asks for right after (lib/store/refresh.ts) already
 * holds the change. Kept apart from lib/data/world.ts so a route handler can
 * name the tag without bundling the world loaders.
 *
 * Writes that only touch the writer's own rows (saves, drafts, follows,
 * reports) don't expire it: the private overlay is read per request anyway.
 */

/** The cache tag of the public world. */
export const WORLD_TAG = 'world'
