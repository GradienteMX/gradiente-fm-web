/**
 * Comments under the pieces.
 *
 *   comment            POST /api/comments { id, itemId, parentId, body }   + HL «comment»
 *   comment-edit       PATCH /api/comments/[id] { body }                   author, 15 minutes
 *   comment-tombstone  POST /api/comments/[id]/tombstone { reason }        author (15 min) or moderation
 *   comment-restore    DELETE /api/comments/[id]/tombstone                 moderation only
 *   react              POST|DELETE /api/comments/[id]/reactions
 *   save-comment       POST|DELETE /api/saves/comments/[id]
 *
 * Ids: the composer mints a uuid (comments.id is uuid) and the route stores
 * it as it comes — so an edit, a reaction or a reply to a comment posted a
 * second ago names the right row. Anything about a comment waits for its
 * create while that is in flight (lane `comment:<id>`); a comment waits for
 * its piece (lane `item:<id>`) and for the comment it answers.
 */

import { registerEffect } from '../effects'
import { requestRefresh } from '../refresh'
import { hpEvent, inOrder, send } from './http'
import { commentTombstoneRequest, reactRequest, saveCommentRequest } from './mapping'
import { itemLane } from './piezas'

const enc = encodeURIComponent
export const commentLane = (id: string) => `comment:${id}`

registerEffect('comment', (a) => {
  const c = a.comment
  return inOrder(
    commentLane(c.id),
    async () => {
      await send(
        'POST',
        '/api/comments',
        { id: c.id, itemId: c.contentItemId, parentId: c.parentId, body: c.body },
        {
          fallback: 'No se pudo publicar tu comentario. El cambio se deshizo.',
          messages: { 404: 'Esa pieza (o el comentario al que respondías) ya no está.' },
        },
      )
      // As production: a comment that landed is also an HL gesture on the piece.
      hpEvent(c.contentItemId, 'comment')
      requestRefresh()
    },
    [itemLane(c.contentItemId), ...(c.parentId ? [commentLane(c.parentId)] : [])],
  )
})

registerEffect('comment-edit', (a) =>
  inOrder(commentLane(a.id), async () => {
    await send('PATCH', `/api/comments/${enc(a.id)}`, { body: a.body }, {
      fallback: 'No se pudo guardar la edición. El cambio se deshizo.',
      messages: { 404: 'Ese comentario ya no está.' },
    })
  }),
)

registerEffect('comment-tombstone', (a, { before }) =>
  inOrder(commentLane(a.id), async () => {
    const byAuthor = before.comments[a.id]?.authorId === a.moderatorId
    const r = commentTombstoneRequest(a.id, a.reason, byAuthor)
    await send(r.method, r.url, r.body, {
      fallback: 'No se pudo retirar el comentario. El cambio se deshizo.',
      messages: { 404: 'Ese comentario ya no está.' },
    })
  }),
)

registerEffect('comment-restore', (a) =>
  inOrder(commentLane(a.id), async () => {
    const r = commentTombstoneRequest(a.id, null, false)
    await send(r.method, r.url, undefined, {
      fallback: 'No se pudo restaurar el comentario. El cambio se deshizo.',
      messages: { 404: 'Ese comentario ya no está.' },
    })
  }),
)

registerEffect('react', (a, { before }) => {
  const had = before.comments[a.commentId]?.reactions.find((r) => r.userId === a.userId)?.kind ?? null
  if (had === a.kind) return
  return inOrder(commentLane(a.commentId), async () => {
    const r = reactRequest(a.commentId, a.kind)
    await send(r.method, r.url, r.body, { fallback: 'No se pudo guardar tu reacción. El cambio se deshizo.', messages: { 404: 'Ese comentario ya no está.' } })
  })
})

registerEffect('save-comment', (a, { before }) => {
  const was = Boolean(before.savedComments[a.userId]?.[a.commentId])
  if (was === a.on) return
  return inOrder(commentLane(a.commentId), async () => {
    const r = saveCommentRequest(a.commentId, a.on)
    await send(r.method, r.url, undefined, {
      fallback: a.on ? 'No se pudo guardar el comentario. El cambio se deshizo.' : 'No se pudo quitar el comentario de tu colección.',
      messages: { 404: 'Ese comentario ya no está.' },
    })
  })
})
