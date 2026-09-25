/**
 * Franjas: their card, their market, the questions under a listing.
 *
 *   franja-patch            PATCH /api/admin/franjas/[id]                  a site admin (Central): any field
 *                           PATCH /api/franjas/[id]                        the franja's team: links, logo, storefront
 *   listing-upsert          POST /api/franjas/[id]/listings                new (the client's `mkl-…` id is kept)
 *                           PATCH /api/franjas/[id]/listings/[lid]         existing
 *   listing-delete          DELETE /api/franjas/[id]/listings/[lid]        its questions go with it
 *   listing-comment         POST /api/listings/[lid]/comments { id, body, parentId }
 *   listing-comment-delete  DELETE /api/listings/[lid]/comments/[cid]      a question takes its answers
 *
 * Ids: listings are text rows (the client's id is kept); listing questions
 * are uuid rows (the client mints the uuid, the route keeps it). A question
 * waits for its listing's create, an answer for its question's.
 */

import { EffectError, registerEffect } from '../effects'
import { requestRefresh } from '../refresh'
import { inOrder, send } from './http'
import { franjaPatchRequest, listingBody } from './mapping'

const enc = encodeURIComponent
const listingLane = (id: string) => `listing:${id}`
const questionLane = (id: string) => `lc:${id}`

registerEffect('franja-patch', (a, { before }) => {
  const viewer = before.viewer ? before.users[before.viewer] : undefined
  const r = franjaPatchRequest(a.franjaId, a.patch, viewer?.role === 'admin')
  if ('refused' in r) throw new EffectError(`franja-patch rechazado: ${r.refused}`, r.refused)
  return inOrder(`item:${a.franjaId}`, async () => {
    await send(r.method, r.url, r.body, {
      fallback: 'No se pudo guardar la franja. El cambio se deshizo.',
      messages: { 403: 'Solo su equipo (o administración) cambia esta franja.', 404: 'Esa franja ya no está.' },
    })
  })
})

registerEffect('listing-upsert', (a, { before }) => {
  const l = a.listing
  const exists = Boolean(before.items[a.franjaId]?.marketplaceListings?.some((x) => x.id === l.id))
  return inOrder(
    listingLane(l.id),
    async () => {
      if (exists) {
        await send('PATCH', `/api/franjas/${enc(a.franjaId)}/listings/${enc(l.id)}`, listingBody(l, false), {
          fallback: 'No se pudo guardar el anuncio. El cambio se deshizo.',
          messages: { 403: 'Solo el equipo de la franja edita sus anuncios.', 404: 'Ese anuncio ya no está.' },
        })
        return
      }
      await send('POST', `/api/franjas/${enc(a.franjaId)}/listings`, listingBody(l, true), {
        fallback: 'No se pudo publicar el anuncio. El cambio se deshizo.',
        messages: { 403: 'Solo el equipo de la franja publica en su mercado.', 404: 'Esa franja ya no está.', 409: 'Ya hay un anuncio con ese identificador. Vuelve a intentarlo.' },
      })
      requestRefresh()
    },
    [`item:${a.franjaId}`],
  )
})

registerEffect('listing-delete', (a) =>
  inOrder(listingLane(a.listingId), async () => {
    await send('DELETE', `/api/franjas/${enc(a.franjaId)}/listings/${enc(a.listingId)}`, undefined, {
      fallback: 'No se pudo eliminar el anuncio. Sigue en el catálogo.',
      messages: { 403: 'Solo el equipo de la franja elimina sus anuncios.' },
      okStatuses: [404],
    })
    requestRefresh()
  }),
)

registerEffect('listing-comment', (a) => {
  const c = a.comment
  return inOrder(
    questionLane(c.id),
    async () => {
      await send('POST', `/api/listings/${enc(c.listingId)}/comments`, { id: c.id, body: c.body, parentId: c.parentId }, {
        fallback: 'No se pudo enviar tu mensaje. El cambio se deshizo.',
        messages: { 404: 'Ese anuncio (o la pregunta que respondías) ya no está.' },
      })
      requestRefresh()
    },
    [listingLane(c.listingId), ...(c.parentId ? [questionLane(c.parentId)] : [])],
  )
})

registerEffect('listing-comment-delete', (a, { before }) => {
  const c = before.listingComments.find((x) => x.id === a.id)
  if (!c) return
  return inOrder(questionLane(a.id), async () => {
    await send('DELETE', `/api/listings/${enc(c.listingId)}/comments/${enc(a.id)}`, undefined, {
      fallback: 'No se pudo borrar tu mensaje. El cambio se deshizo.',
      messages: { 403: 'Solo quien lo escribió puede borrarlo.' },
      okStatuses: [404],
    })
    requestRefresh()
  })
})
