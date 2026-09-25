'use client'

import { createClient } from '@/lib/supabase/client'
import { inviteCodeCandidates } from '@/lib/identity'
import type { Role } from '@/lib/types'

// The invitation as the door may know it before anyone signs up — ported from
// production (main:lib/invitations.ts). `peek_invite_card` (migration 0028,
// reshaped in 0048) is a SECURITY DEFINER lookup granted to `anon`: one code
// in, that code's card out (name, role, folio, issue month, team) and a
// status. The invite table itself never reaches the browser, and neither does
// any other code.

export type InviteCardStatus = 'active' | 'used' | 'expired' | 'invalid'

export interface InviteCard {
  name: string
  /** The spelling that matched — what signup must submit. */
  code: string
  /** «007/150» — empty when the code carries no folio. */
  folio: string
  /** «SEP 2026» — issued_label, else the month it was created. */
  issued: string
  role: Role
  franja: { title: string; logoUrl: string | null } | null
  status: InviteCardStatus
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

function issuedFrom(label: string | null, isoDate: string | null): string {
  if (label && label.trim()) return label.trim()
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Resolves a code into its card. Never throws: an unknown or empty code — or
 * a network failure, reported as `error` so the door can say so honestly —
 * comes back with status 'invalid'. The RPC matches exactly, so the code is
 * tried as typed first and then in its normalized spelling (a code retyped on
 * a phone, auto-capitalized, or pasted with a trailing period still resolves).
 */
export async function peekInviteCard(code: string): Promise<InviteCard & { error?: boolean }> {
  const trimmed = code.trim()
  const base: InviteCard = { name: '', code: trimmed, folio: '', issued: '', role: 'user', franja: null, status: 'invalid' }
  if (!trimmed) return base

  const supabase = createClient()
  let failed = false
  const peek = async (candidate: string) => {
    const { data, error } = await supabase.rpc('peek_invite_card', { p_code: candidate })
    if (error) failed = true
    return error || !data || data.length === 0 ? null : data[0]
  }

  let matched = trimmed
  let row: Awaited<ReturnType<typeof peek>> = null
  try {
    for (const candidate of inviteCodeCandidates(trimmed)) {
      row = await peek(candidate)
      if (row) {
        matched = candidate
        break
      }
    }
  } catch {
    return { ...base, error: true }
  }
  if (!row) return failed ? { ...base, error: true } : base

  const folio = row.folio != null ? `${String(row.folio).padStart(3, '0')}/${row.folio_denominator ?? 150}` : ''
  return {
    name: row.card_name?.trim() || '',
    code: matched,
    folio,
    issued: issuedFrom(row.issued_label, row.issued_at),
    role: row.role,
    franja: row.franja_title ? { title: row.franja_title, logoUrl: row.franja_logo_url } : null,
    status: (row.status as InviteCardStatus) ?? 'active',
  }
}
