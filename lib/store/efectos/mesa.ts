/**
 * La Mesa: drafts and publishing — and the two Central desks that publish
 * without a draft.
 *
 *   draft-save    POST /api/drafts { item }             upsert on (author, item id)
 *   draft-delete  DELETE /api/drafts/[itemId]           idempotent
 *   publish       POST /api/items { item, mode }        a piece (create | edit), a new franja (admin)
 *                 POST /api/admin/events { event }      Central's event desk (draftId null, evento)
 *
 * Ids: a draft is its item — production's drafts are keyed by the item id
 * inside the payload, and so are V2's (`local-<type>-<ms>-<rand>`, the
 * format production's composer used). Publishing keeps the id: `mode:
 * 'create'` makes the route refuse (409) rather than overwrite a row that
 * already has it. Everything for one item runs in its lane (`item:<id>`), so
 * the last autosave lands before the publish that deletes the draft, and a
 * save or comment on the new piece waits for its row.
 *
 * Before the item is sent: entities the composer named but that aren't rows
 * yet (`ent-<kind>-<slug>`) are resolved or created through /api/entities —
 * creating is for guides and admins (RLS); one that can't be created is left
 * off the piece (its name still reads in the text) and the person is told.
 * A poll keeps the uuid the composer minted; one from an older draft is named
 * by the server, and the effect hands that name back (ids.ts).
 */

import type { ContentItem, EntityRef } from '@/lib/types'
import { registerEffect } from '../effects'
import { isUuid, rememberIds } from '../ids'
import { requestRefresh } from '../refresh'
import { useUI } from '../ui'
import { HttpError, inOrder, send } from './http'
import { publishBody, unresolvedEntities } from './mapping'
import { itemLane } from './piezas'

const enc = encodeURIComponent

registerEffect('draft-save', (a) =>
  inOrder(itemLane(a.draft.id), async () => {
    // keepalive: an autosave fired by closing the tab still arrives (small drafts only; see http.ts).
    await send('POST', '/api/drafts', { item: a.draft.item }, { fallback: 'No se pudo guardar el borrador. Tus cambios siguen en esta pestaña.', keepalive: true })
  }),
)

registerEffect('draft-delete', (a) =>
  inOrder(itemLane(a.id), async () => {
    await send('DELETE', `/api/drafts/${enc(a.id)}`, undefined, { fallback: 'No se pudo descartar el borrador. Sigue en tu taller.' })
  }),
)

/** The composer's entities, as rows: resolved or created through /api/entities; the ones that can't be are left off. */
async function resolveEntities(list: EntityRef[] | undefined): Promise<{ list: EntityRef[] | undefined; left: string[] }> {
  if (!list?.length) return { list, left: [] }
  const pending = unresolvedEntities(list, isUuid)
  if (!pending.length) return { list, left: [] }
  const named = new Map<string, EntityRef | null>()
  await Promise.all(
    pending.map(async (e) => {
      try {
        const r = await send<{ entity?: EntityRef }>('POST', '/api/entities', { kind: e.kind, name: e.name })
        named.set(e.id, r.entity && isUuid(r.entity.id) ? { ...e, id: r.entity.id, slug: r.entity.slug, name: r.entity.name } : null)
      } catch (err) {
        if (!(err instanceof HttpError)) throw err
        named.set(e.id, null)
      }
    }),
  )
  const out: EntityRef[] = []
  const left: string[] = []
  for (const e of list) {
    if (isUuid(e.id)) out.push(e)
    else {
      const got = named.get(e.id)
      if (got) out.push(got)
      else left.push(e.name)
    }
  }
  return { list: out, left }
}

registerEffect('publish', (a, { before }) => {
  const existing = before.items[a.item.id] ?? null
  const me = before.viewer ? (before.users[before.viewer] ?? null) : null
  return inOrder(itemLane(a.item.id), async () => {
    const { list: entities, left } = await resolveEntities(a.item.entities)
    const item: ContentItem = { ...a.item, entities }

    // Central's event desk edits nights it didn't write (scraped ones
    // included) without re-stamping them: its own admin route.
    if (a.draftId === null && item.type === 'evento' && me?.role === 'admin') {
      await send('POST', '/api/admin/events', { event: publishBody(item, { me, existing }).item }, {
        fallback: 'No se pudo guardar el evento. El cambio se deshizo.',
        messages: { 403: 'Solo administración edita eventos desde Central.' },
      })
      requestRefresh()
      return
    }

    const body = publishBody(item, { me, existing })
    // The route says why in Spanish (a 409 names the id or the slug, a 422 what's missing).
    const res = await send<{ pollId?: unknown; warning?: unknown }>('POST', '/api/items', body, {
      fallback: existing ? 'No se pudo actualizar la pieza. Tus cambios siguen en el borrador.' : 'No se pudo publicar. Tu pieza sigue en el borrador.',
      messages: { 403: item.type === 'franja' ? 'Solo administración crea franjas.' : 'No puedes publicar esto con tu rol.' },
    })
    if (left.length) {
      useUI.getState().notify(`Publicada. ${left.length === 1 ? `«${left[0]}» no se pudo enlazar` : `${left.length} nombres no se pudieron enlazar`}: crear fichas nuevas es de guías y administración.`)
    }
    if (typeof res.warning === 'string' && res.warning) console.warn('[world] publish: la encuesta no se guardó:', res.warning)
    requestRefresh()
    // A poll from an older draft is named by the server: known before this
    // effect settles (a vote waiting on this piece's lane asks right after).
    const clientPoll = item.poll?.id
    if (clientPoll && typeof res.pollId === 'string' && res.pollId !== clientPoll) {
      const ids = { [clientPoll]: res.pollId }
      rememberIds(ids)
      return { ids }
    }
  })
})
