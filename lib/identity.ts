// Shared normalization for the two invite-signup fields users get wrong most:
// the invite code and the username. Both live here — no imports, safe on the
// server and in the browser — so the /welcome forms, the `/api/auth/signup`
// route handler and `lib/invitations.ts` all agree on one definition.
// Disagreement between them is exactly what made a mistyped code or a
// phone-capitalized username look unrecoverable to an invitee.

// ── Invite codes ────────────────────────────────────────────────────────────

// Codes are stored as `<PREFIX>-<lowercase hex>` (INV-…, plus one legacy
// BOOT-…) and matched exactly, both by `peek_invite_card` and by the signup
// route. But invitees paste them out of WhatsApp/mail with a trailing period,
// smart quotes or a non-breaking space, and the manual código input sets
// `autoCapitalize="characters"` — so a hand-typed code arrives uppercased and
// never resolves. Strip anything that can't belong to a code, then rebuild the
// stored casing: prefix upper, body lower.
export function normalizeInviteCode(raw: string): string {
  const cleaned = (raw ?? '').replace(/[^a-zA-Z0-9-]/g, '')
  const dash = cleaned.indexOf('-')
  if (dash === -1) return cleaned.toLowerCase()
  return `${cleaned.slice(0, dash).toUpperCase()}-${cleaned.slice(dash + 1).toLowerCase()}`
}

// Both spellings worth trying, raw first so an exact stored value always wins
// and normalization can only ever widen what resolves — never redirect one
// code onto another. Deduped; feed to an `in` lookup or try in order.
export function inviteCodeCandidates(raw: string): string[] {
  const trimmed = (raw ?? '').trim()
  const normalized = normalizeInviteCode(trimmed)
  return trimmed && trimmed !== normalized ? [trimmed, normalized] : [normalized]
}

// ── Usernames ───────────────────────────────────────────────────────────────

// The gate the signup route enforces. Username is load-bearing for
// /u/[username], the CreatorChip and the user-HP surfaces — it stays a slug,
// but a slug that carries dots: `nombre.apellido` and `.nombre` are how people
// actually write handles, and prohibiting them just pushed invitees into
// spellings they didn't want.
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/

export const USERNAME_RULE_ES =
  'El usuario va en minúsculas: 3 a 30 caracteres, solo letras, números, punto, guion y guion bajo.'

// Extensions the root middleware matcher skips (static assets). A username
// ending in one of them would put /u/<username> outside the auth gate — RLS
// still blocks the data, but there's no reason to hand out the hole.
const ASSET_SUFFIX_RE =
  /\.(svg|png|jpg|jpeg|gif|webp|glb|gltf|hdr|ktx2|bin|ttf|otf|woff|woff2)$/

// Everything the alphabet alone can't express. Returns a Spanish complaint or
// null — one source for the signup route and the forms, so the invitee never
// gets bounced by a rule the field let them type.
export function usernameProblemEs(username: string): string | null {
  if (!USERNAME_RE.test(username)) return USERNAME_RULE_ES
  if (!/[a-z0-9]/.test(username)) {
    return 'El usuario necesita al menos una letra o número.'
  }
  if (username.includes('..')) return 'El usuario no puede llevar dos puntos seguidos.'
  if (ASSET_SUFFIX_RE.test(username)) {
    return 'El usuario no puede terminar como un archivo (.png, .svg, …).'
  }
  return null
}

// Slug-safe username derived from whatever the user typed. The signup fields
// run this on every keystroke so the invitee *sees* the username that will be
// created and can edit it, instead of being bounced by the gate after the
// fact: accents fold to ASCII (sofía → sofia), whitespace becomes an
// underscore (ana sofia → ana_sofia), the capital every phone keyboard adds is
// lowered, and anything outside the alphabet is dropped. Dots survive —
// nombre.apellido is the whole point.
export function normalizeUsername(raw: string): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining accents
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30)
}
