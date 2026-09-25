/**
 * The invitation code, read the same way at the door and in Acceso: typed
 * in any case, dashes or not; honest states only — «verificando» while the
 * lookup is on its way to the server, then valid, already activated, expired
 * or unknown (and «sin conexión» when the lookup itself didn't come back).
 */

import { normalizeInviteCode } from '@/lib/identity'
import type { InviteCardStatus } from '@/lib/invitations'

export type CodeStatus = 'vacio' | 'escribiendo' | 'verificando' | 'valido' | 'usado' | 'expirado' | 'desconocido' | 'sin-red'

/** A complete-looking code: prefix, dash, a body of hex. */
export const CODE_SHAPE = /^[A-Z]{2,8}-[0-9a-z]{8,}$/

/** What the field shows while typing: the code's own case, trimmed to its alphabet. */
export function displayCode(raw: string): string {
  const cleaned = (raw ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24)
  return cleaned.includes('-') ? normalizeInviteCode(cleaned) : cleaned.toUpperCase()
}

/** The lookup's answer (lib/invitations peekInviteCard), in the door's words. */
export function codeStatusOf(status: InviteCardStatus, error?: boolean): 'valido' | 'usado' | 'expirado' | 'desconocido' | 'sin-red' {
  if (error) return 'sin-red'
  return status === 'active' ? 'valido' : status === 'used' ? 'usado' : status === 'expired' ? 'expirado' : 'desconocido'
}

export const CODE_MESSAGE: Record<CodeStatus, string> = {
  vacio: 'Escribe o pega tu código tal como llegó.',
  escribiendo: 'Enter para abrir.',
  verificando: 'Verificando el código…',
  valido: 'Código válido. La puerta se abre.',
  usado: 'Este código ya fue activado.',
  expirado: 'Este código expiró.',
  desconocido: 'No reconocemos ese código. Revisa guiones, ceros y oes.',
  'sin-red': 'No pudimos verificar el código: sin conexión con el servidor. Intenta de nuevo.',
}
