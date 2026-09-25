/**
 * The pieces: reading them (touch · save · reading · vote), and what their
 * author and Central do to them (harvest · pin · hp-adjust · item-delete).
 *
 *   touch        POST /api/hp-events { item_id, kind }         best effort, keepalive
 *   save         POST|DELETE /api/saves/items/[id]             + HL «save» on a new save
 *   reading      PUT|DELETE /api/vibe-checks/[id]              the crowd band is the server's
 *   vote         POST|DELETE /api/polls/[pollId]/vote
 *   harvest      POST /api/items/[id]/harvest                  the echo is computed there
 *   pin          PATCH /api/admin/items/[id]/portada { pinned }
 *   hp-adjust    POST /api/admin/items/[id]/hp { delta, reason }
 *   item-delete  DELETE /api/items/[id]                        a franja too (admin)
 *
 * Every write about a piece waits for anything still in flight on that piece
 * (lane `item:<id>` — a publish, its drafts), so a save or a vote on a piece
 * published a second ago finds its row.
 *
 * HL, presence and trophies are the server's to compute (hp_events +
 * pg_cron rollup, user_hp_events triggers, apply_trophy_unlocks): what the
 * reducer shows is an optimistic delta that the next snapshot replaces.
 */

import { registerEffect } from '../effects'
import { requestRefresh } from '../refresh'
import { serverId } from '../ids'
import { hpEvent, inOrder, send } from './http'
import { readingRequest, saveItemRequest, voteRequest } from './mapping'

const enc = encodeURIComponent
export const itemLane = (id: string) => `item:${id}`

/**
 * Clicks and opens count once an hour per person and piece — the reducer's
 * rule (world-core THROTTLE_MS), kept here too because the reducer forgets
 * its throttle whenever a new snapshot arrives.
 */
const TOUCH_EVERY_MS = 60 * 60 * 1000
const lastTouch = new Map<string, number>()

registerEffect('touch', (a, { before }) => {
  const item = before.items[a.itemId]
  // Franjas carry no HL (the reducer skips them too).
  if (!item || item.type === 'franja') return
  const key = `${a.userId}:${a.itemId}:${a.kind}`
  const t = Date.parse(a.at)
  const prev = lastTouch.get(key)
  if (prev !== undefined && t - prev < TOUCH_EVERY_MS) return
  lastTouch.set(key, t)
  void inOrder(`touch:${key}`, async () => hpEvent(a.itemId, a.kind), [itemLane(a.itemId)])
})

registerEffect('save', (a, { before }) => {
  const was = Boolean(before.saves[a.userId]?.[a.itemId])
  if (was === a.on) return
  return inOrder(
    `save:${a.userId}:${a.itemId}`,
    async () => {
      const r = saveItemRequest(a.itemId, a.on)
      await send(r.method, r.url, undefined, {
        fallback: a.on ? 'No se pudo guardar la pieza. El cambio se deshizo.' : 'No se pudo quitar de tu colección. El cambio se deshizo.',
        messages: { 404: 'Esa pieza ya no está.' },
      })
      // As production: a save that landed is also an HL gesture on the piece
      // (franjas carry no HL — the reducer skips them too).
      if (a.on && before.items[a.itemId]?.type !== 'franja') hpEvent(a.itemId, 'save')
    },
    [itemLane(a.itemId)],
  )
})

registerEffect('reading', (a, { before }) => {
  const had = before.readings[a.itemId]?.[a.userId] ?? null
  if (!a.band && !had) return
  return inOrder(
    `reading:${a.userId}:${a.itemId}`,
    async () => {
      const r = readingRequest(a.itemId, a.band)
      await send(r.method, r.url, r.body, { fallback: 'No se pudo guardar tu lectura. El cambio se deshizo.', messages: { 404: 'Esa pieza ya no está.' } })
    },
    [itemLane(a.itemId)],
  )
})

registerEffect('vote', (a, { before }) => {
  const item = Object.values(before.items).find((i) => i.poll?.id === a.pollId)
  return inOrder(
    `vote:${a.userId}:${a.pollId}`,
    async () => {
      // A poll published from an old draft is named by the server (ids.ts).
      const r = voteRequest(await serverId(a.pollId), a.choiceIds)
      await send(r.method, r.url, r.body, { fallback: 'No se pudo guardar tu voto. El cambio se deshizo.', messages: { 404: 'Esa encuesta ya no está.' } })
    },
    item ? [itemLane(item.id)] : [],
  )
})

registerEffect('harvest', (a) =>
  inOrder(itemLane(a.itemId), async () => {
    await send('POST', `/api/items/${enc(a.itemId)}/harvest`, undefined, {
      fallback: 'No se pudo cosechar. El cambio se deshizo.',
      messages: {
        403: 'Solo quien publicó la pieza puede cosecharla.',
        404: 'Esa pieza ya no está.',
        409: 'Esta pieza ya se cosechó.',
      },
    })
    // The echo is what the server measured at its instant, not ours.
    requestRefresh()
  }),
)

registerEffect('pin', (a) =>
  inOrder(itemLane(a.itemId), async () => {
    await send('PATCH', `/api/admin/items/${enc(a.itemId)}/portada`, { pinned: a.on }, {
      fallback: a.on ? 'No se pudo llevar a portada.' : 'No se pudo quitar de portada.',
      messages: { 403: 'La portada la decide administración.', 404: 'Esa pieza ya no está.' },
    })
  }),
)

registerEffect('hp-adjust', (a) =>
  inOrder(itemLane(a.itemId), async () => {
    await send('POST', `/api/admin/items/${enc(a.itemId)}/hp`, { delta: a.delta, reason: a.note }, {
      fallback: 'No se pudo registrar el ajuste. El cambio se deshizo.',
      messages: { 403: 'Solo administración ajusta la HL.', 404: 'Esa pieza ya no está.' },
    })
    // admin_adjust_item_hp decays to its own instant and clamps at zero.
    requestRefresh()
  }),
)

registerEffect('item-delete', (a) =>
  inOrder(itemLane(a.itemId), async () => {
    await send('DELETE', `/api/items/${enc(a.itemId)}`, undefined, {
      fallback: 'No se pudo borrar. La pieza sigue ahí.',
      messages: { 403: 'Solo quien la publicó (o administración) puede borrarla.' },
      // Already gone is gone.
      okStatuses: [404],
    })
    requestRefresh()
  }),
)
