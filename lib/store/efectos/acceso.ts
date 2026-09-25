/**
 * Central · Acceso: the code book and the waitlist that feeds it (admins).
 *
 *   invite           POST /api/admin/invite-codes { code, … }   the code the admin copied is the one stored
 *   waitlist-status  POST /api/admin/waitlist { id, code }      'invitado': links the entry to that code
 *   waitlist-delete  DELETE /api/admin/waitlist { id }
 *
 * Ids: an invitation's code IS its key, and the admin copies it the instant
 * it's generated — so the client mints it (INV- + 16 hex, production's
 * shape) and both routes store exactly that code. «Generar código» on a
 * waitlist row dispatches `invite` and `waitlist-status` together; whichever
 * route runs first inserts the code and the other one finds it (both are
 * idempotent for the admin who minted it), so it is always ONE invitation.
 * The folio is the server's (next free number); a refresh brings it.
 */

import { EffectError, registerEffect } from '../effects'
import { requestRefresh } from '../refresh'
import { inOrder, send } from './http'
import { inviteBody } from './mapping'

registerEffect('invite', (a) =>
  inOrder(`invite:${a.row.code}`, async () => {
    await send('POST', '/api/admin/invite-codes', inviteBody(a.row), {
      fallback: 'No se pudo emitir el código. No lo compartas: no existe.',
      messages: { 403: 'Solo administración emite códigos.', 409: 'Ese código ya existe. Genera otro.' },
    })
    requestRefresh()
  }),
)

registerEffect('waitlist-status', (a, { before }) => {
  if (a.status !== 'invitado') throw new EffectError(`waitlist-status ${a.status}`, 'Desde aquí solo se puede invitar.')
  // The invitation generated with it: the newest code for this person's alias.
  const row = before.waitlist.find((r) => r.id === a.id)
  const code = row ? [...before.invites].reverse().find((i) => i.name === row.alias && !i.usedBy)?.code : undefined
  return inOrder(`waitlist:${a.id}`, async () => {
    await send('POST', '/api/admin/waitlist', { id: a.id, ...(code ? { code } : {}) }, {
      fallback: 'No se pudo marcar la invitación. El cambio se deshizo.',
      messages: { 403: 'Solo administración invita desde la lista.', 404: 'Esa entrada ya no está en la lista.' },
    })
    requestRefresh()
  })
})

registerEffect('waitlist-delete', (a) =>
  inOrder(`waitlist:${a.id}`, async () => {
    await send('DELETE', '/api/admin/waitlist', { id: a.id }, {
      fallback: 'No se pudo borrar de la lista. El cambio se deshizo.',
      messages: { 403: 'Solo administración borra de la lista.' },
      okStatuses: [404],
    })
    requestRefresh()
  }),
)
