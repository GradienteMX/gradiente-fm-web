/**
 * People: your own profile, what Central and a franja's admins change about
 * someone, the franjas you follow, and the activity you've seen.
 *
 *   profile     PATCH /api/users/me { display_name, bio, firma, location, avatar_url }
 *   user-admin  site admin      → PATCH /api/admin/users/[id] { role, is_mod, is_og, franja_id, franja_admin }
 *               franja's admin  → POST | DELETE | PATCH /api/franjas/[franja]/team { user_id[, franja_admin] }
 *   follow      POST | DELETE /api/follows/[franjaId]    (migration 0053 — private, never counted)
 *   seen        this device only (localStorage, device.ts) — production kept the
 *               watermark per device too, and no table holds it
 */

import { EffectError, registerEffect } from '../effects'
import { advanceSeenWatermark } from '../device'
import { requestRefresh } from '../refresh'
import { inOrder, send } from './http'
import { followRequest, profileBody, userAdminRequests } from './mapping'

registerEffect('profile', (a) =>
  inOrder(`user:${a.userId}`, async () => {
    const body = profileBody(a.patch)
    if (!Object.keys(body).length) return
    if (body.display_name === '') throw new EffectError('display_name vacío', 'Tu nombre no puede quedar vacío.')
    await send('PATCH', '/api/users/me', body, { fallback: 'No se pudo guardar tu perfil. El cambio se deshizo.' })
  }),
)

registerEffect('user-admin', (a, { before }) => {
  const viewer = before.viewer ? before.users[before.viewer] : undefined
  const target = before.users[a.userId]
  const reqs = userAdminRequests(a.userId, a.patch, { viewerIsAdmin: viewer?.role === 'admin', targetFranjaId: target?.franjaId || null })
  if ('refused' in reqs) throw new EffectError(`user-admin rechazado: ${reqs.refused}`, reqs.refused)
  if (!reqs.length) return
  return inOrder(`user:${a.userId}`, async () => {
    for (const r of reqs) {
      await send(r.method, r.url, r.body, {
        fallback: 'No se pudo guardar el cambio de permisos. El cambio se deshizo.',
        messages: { 403: 'No tienes permiso para cambiar a esta persona.', 404: 'Esa persona ya no está (o ya no está en el equipo).' },
      })
    }
    // Roles and teams decide what each surface lets people do.
    requestRefresh()
  })
})

registerEffect('follow', (a, { before }) => {
  const was = (before.follows[a.userId] ?? []).includes(a.franjaId)
  if (was === a.on) return
  return inOrder(`follow:${a.userId}:${a.franjaId}`, async () => {
    const r = followRequest(a.franjaId, a.on)
    await send(r.method, r.url, undefined, {
      fallback: a.on ? 'No se pudo seguir a la franja. El cambio se deshizo.' : 'No se pudo dejar de seguir. El cambio se deshizo.',
      messages: { 404: 'Esa franja ya no está.' },
    })
  })
})

/** The «visto» watermark: on this device, advance-only. Never a request. */
registerEffect(
  'seen',
  (a) => {
    advanceSeenWatermark(a.userId, a.at)
  },
  { local: true },
)
