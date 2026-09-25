/**
 * The foro.
 *
 *   thread         POST /api/foro/threads { id, subject, body, imageUrls, genres, tags }
 *   reply          POST /api/foro/threads/[id]/replies { id, body, imageUrl, quotedReplyIds }
 *   foro-tombstone POST|DELETE /api/foro/{threads|replies}/[id]/tombstone { reason }
 *
 * Ids: threads and replies are uuid rows; the composer mints the uuid and
 * the route stores it, so `>>id` quotes, a reply to a thread opened a second
 * ago and a moderator's stub all name the right row. A reply waits for its
 * thread's create (lane `thread:<id>`), a stub for its post's.
 *
 * Images: the composer prepares them in the browser as data: URLs; before
 * the post is written they're stored (/api/ingest-image → WebP in the
 * uploads bucket, http.ts uploadImage), so the row — and the public world
 * every member downloads — carries a URL, never the bytes.
 */

import { registerEffect } from '../effects'
import { requestRefresh } from '../refresh'
import { inOrder, send, uploadImage } from './http'
import { foroTombstoneRequest } from './mapping'

const enc = encodeURIComponent
export const threadLane = (id: string) => `thread:${id}`
const replyLane = (id: string) => `reply:${id}`

registerEffect('thread', (a) => {
  const t = a.thread
  return inOrder(threadLane(t.id), async () => {
    const imageUrls = await Promise.all(t.imageUrls.map((src) => uploadImage(src, 'foro')))
    await send(
      'POST',
      '/api/foro/threads',
      { id: t.id, subject: t.subject, body: t.body, imageUrls, genres: t.genres, tags: t.tags },
      { fallback: 'No se pudo pegar el hilo en el muro. El cambio se deshizo.' },
    )
    requestRefresh()
  })
})

registerEffect('reply', (a) => {
  const r = a.reply
  return inOrder(
    replyLane(r.id),
    async () => {
      const imageUrl = r.imageUrl ? await uploadImage(r.imageUrl, 'foro') : undefined
      await send(
        'POST',
        `/api/foro/threads/${enc(r.threadId)}/replies`,
        { id: r.id, body: r.body, imageUrl, quotedReplyIds: r.quotedReplyIds ?? [] },
        { fallback: 'No se pudo publicar tu respuesta. El cambio se deshizo.', messages: { 404: 'Ese hilo ya no está.' } },
      )
      requestRefresh()
    },
    [threadLane(r.threadId), ...(r.quotedReplyIds ?? []).map(replyLane)],
  )
})

registerEffect('foro-tombstone', (a) =>
  inOrder(a.target === 'thread' ? threadLane(a.id) : replyLane(a.id), async () => {
    const r = foroTombstoneRequest(a.target, a.id, a.reason)
    await send(r.method, r.url, r.body, {
      fallback: a.reason === null ? 'No se pudo restaurar. El cambio se deshizo.' : 'No se pudo retirar. El cambio se deshizo.',
      messages: { 404: a.target === 'thread' ? 'Ese hilo ya no está.' : 'Esa respuesta ya no está.' },
    })
  }),
)
