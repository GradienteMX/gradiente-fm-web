import { createClient } from '@/lib/supabase/client'
import { inviteCodeCandidates } from '@/lib/identity'

// Invitación-3D integration · the data contract the holo card consumes.
// `peekInviteCard` resolves a ?codigo= into this shape via the anon-safe
// `peek_invite_card` RPC (migration 0028). The card reads `name/code/folio/
// issued/role/franja`; `qrTarget` is derived by the card per state
// (pre-signup → /welcome?codigo=, post-signup → /u/<username>).

export type InviteCardStatus = 'active' | 'used' | 'expired' | 'invalid'

export type InviteRole = 'user' | 'curator' | 'guide' | 'insider' | 'admin'

export interface InviteCard {
  name: string
  code: string
  folio: string // "007/150" — empty when the code carries no folio
  issued: string // "JUN 2026" — issued_label, else derived from created_at
  role: InviteRole
  franja: { title: string; logoUrl: string | null } | null
  status: InviteCardStatus
}

const MESES = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
]

function issuedFrom(label: string | null, isoDate: string | null): string {
  if (label && label.trim()) return label.trim()
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// Resolves an invite code into card data. Never throws — an unknown/empty code
// returns a well-formed object with status:'invalid' so the UI can branch
// without try/catch. `peek_invite_card` matches exactly, so we try the code as
// given first and fall back to its normalized spelling: a code retyped on a
// phone (auto-capitalized) or pasted with a trailing period resolves instead
// of reading as "CÓDIGO NO RECONOCIDO". The returned `code` is the spelling
// that matched — RegistroCard submits that, not what was typed.
export async function peekInviteCard(code: string): Promise<InviteCard> {
  const trimmed = code.trim()
  const base: InviteCard = {
    name: '',
    code: trimmed,
    folio: '',
    issued: '',
    role: 'user',
    franja: null,
    status: 'invalid',
  }
  if (!trimmed) return base

  const supabase = createClient()
  const peek = async (candidate: string) => {
    const { data, error } = await supabase.rpc('peek_invite_card', { p_code: candidate })
    return error || !data || data.length === 0 ? null : data[0]
  }

  let matched = trimmed
  let row: Awaited<ReturnType<typeof peek>> = null
  for (const candidate of inviteCodeCandidates(trimmed)) {
    row = await peek(candidate)
    if (row) {
      matched = candidate
      break
    }
  }
  if (!row) return base

  const folio =
    row.folio != null
      ? `${String(row.folio).padStart(3, '0')}/${row.folio_denominator ?? 150}`
      : ''

  return {
    name: row.card_name?.trim() || '',
    code: matched,
    folio,
    issued: issuedFrom(row.issued_label, row.issued_at),
    role: row.role,
    franja: row.franja_title
      ? { title: row.franja_title, logoUrl: row.franja_logo_url }
      : null,
    status: (row.status as InviteCardStatus) ?? 'active',
  }
}
