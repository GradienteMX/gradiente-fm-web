/**
 * CREDENCIAL — the data a card carries, in both of its states.
 *
 * «La credencial es el perfil es la credencial»: one shape feeds the GL card,
 * the CSS fallback and the expediente beside it. Everything here is derived
 * from the world — nothing is invented:
 *
 *   · folio   the order of arrival to the beta (a serial, never a score);
 *             an invitation shows its own number, as it was issued
 *   · issued  the month someone arrived (or the invitation was issued)
 *   · pins    earned trophies only — locked ones are absent from the card
 *   · hue     the iridescent family, compressed by role (see ROLE_HUE)
 *   · energy  the name is set at the energy of their published pieces
 *             (the mid of the band they span); no pieces → the role's own
 */

import type { ContentItem, Role, User, UserRank } from '@/lib/types'
import { TROPHY_CATALOG, type TrophyKey } from '@/lib/trophies'
import { libreaDeRol } from '@/lib/librea'
import { effectiveBand } from '@/lib/vibe'
import { fmt } from '@/lib/logic/time'

export type Surface = 'invitation' | 'public'

export interface CredencialPin {
  key: TrophyKey
  label: string
  /** Month earned, «AGO 2026». */
  earned: string
}

export interface CredencialData {
  surface: Surface
  name: string
  /** Without the @. Null on an invitation until a username is chosen. */
  handle: string | null
  role: Role
  rank: UserRank
  isMod: boolean
  isOG: boolean
  /** Franja team, by name. */
  team: string | null
  /** «007/150» — order of arrival. */
  folio: string
  /** «SEP 2026». */
  issued: string
  firma: string | null
  /** Invitation code (invitation state only). */
  code: string | null
  /** Invitation expiry, ISO (invitation state only). */
  expires: string | null
  /** 0–10: the energy the name is typeset at. */
  energy: number
  pins: CredencialPin[]
  /** Whose case this is: their stickers ride on it. Null on an invitation. */
  userId?: string | null
  /** ISO arrival; the case scuffs with time in the signal. */
  joinedAt?: string | null
}

// ── the iridescent family ───────────────────────────────────────────────────
//
// Hue is energy. A role has no energy of its own, so its family is a stretch
// of the spectrum chosen by how much voice the role carries — the access
// layers climb the thermometer: curador (cold blues) → guía (violets) →
// insider (rosa mexicano into red, the scene's own heat) → admin
// (incandescent). Readers carry the whole spectrum: they can listen at any
// temperature. `half` is the half-width of the family on the 0–10 axis.

export const ROLE_HUE: Record<Role, { center: number; half: number }> = {
  user: { center: 5, half: 5 },
  curator: { center: 2, half: 1.2 },
  guide: { center: 4.5, half: 1.2 },
  insider: { center: 6.6, half: 1.2 },
  admin: { center: 8.9, half: 1.1 },
}

/** The family as a [lo, hi] band — the wordmark on the card spans it. */
export function roleBand(role: Role): [number, number] {
  const h = ROLE_HUE[role]
  return [Math.max(0, h.center - h.half), Math.min(10, h.center + h.half)]
}

// ── the stock ───────────────────────────────────────────────────────────────
//
// The card is printed on its role's colour: the livery of a format in the
// feed (`libreaDeRol` — lector on reseña yellow, curador on opinión violet,
// guía on editorial green, insider on mix cyan, admin on evento red) — but
// DYED into a matte cotton board, not lit on a screen: the hue kept, its
// chroma taken down and its lightness drawn toward a pale mid, the way a
// coloured stock sits next to the flat livery. The type prints in the
// livery's own ink where that still reads on the washed board, else in the
// other one. The board is a triplex: the core between the two coloured
// plies is that ink, so the cut edge shows a stripe.

export interface CardStock {
  /** The board's colour (hex): the livery, washed. */
  stock: string
  /** What prints on it (hex). */
  ink: string
  /** The triplex core (hex), seen at the cut edge. */
  core: string
}

const WASH_CHROMA = 0.6
const WASH_L = 0.72
const WASH_PULL = 0.25
const INK = '#111111'
const PAPER = '#edebe3'

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

/** Hue kept, chroma × WASH_CHROMA, lightness pulled toward WASH_L (OKLab). */
function washed(hex: string): string {
  const [r, g, b] = channels(hex).map(toLin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  let L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * WASH_CHROMA
  const B = (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) * WASH_CHROMA
  L += (WASH_L - L) * WASH_PULL
  const l2 = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m2 = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s2 = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const out = [
    4.0767416621 * l2 - 3.3077115913 * m2 + 0.2309699292 * s2,
    -1.2684380046 * l2 + 2.6097574011 * m2 - 0.3413193965 * s2,
    -0.0041960863 * l2 - 0.7034186147 * m2 + 1.707614701 * s2,
  ]
  return '#' + out.map((c) => Math.round(Math.max(0, Math.min(1, toSrgb(Math.max(0, c)))) * 255).toString(16).padStart(2, '0')).join('')
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = channels(hex).map(toLin)
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

export function cardStock(role: Role): CardStock {
  const livery = libreaDeRol(role)
  const stock = washed(livery.color)
  const other = livery.on.toLowerCase() === INK ? PAPER : INK
  const ink = contrast(stock, livery.on) >= 4 ? livery.on : other
  return { stock, ink, core: ink }
}

// ── folio ───────────────────────────────────────────────────────────────────

/** Seats in the closed beta. Past it the serial simply keeps counting. */
export const BETA_SEATS = 150

export function folioLabel(n: number): string {
  const s = String(Math.max(1, n)).padStart(3, '0')
  return n <= BETA_SEATS ? `${s}/${BETA_SEATS}` : s
}

/** User ids in order of arrival (joinedAt, then id — deterministic). */
export function joinOrder(users: Record<string, User>): string[] {
  return Object.values(users)
    .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt) || a.id.localeCompare(b.id))
    .map((u) => u.id)
}

// ── stamps ──────────────────────────────────────────────────────────────────

/** «SEP 2026» */
export function monthStamp(iso: string): string {
  try {
    return fmt.monthYear(iso)
  } catch {
    return '—'
  }
}

/** The band a person's published pieces span (effective bands), or null. */
export function bandOfPieces(items: ContentItem[]): { min: number; max: number } | null {
  if (!items.length) return null
  let min = 10
  let max = 0
  for (const it of items) {
    const b = effectiveBand(it)
    min = Math.min(min, b.min)
    max = Math.max(max, b.max)
  }
  return { min, max }
}

// ── builders ────────────────────────────────────────────────────────────────

interface EarnedTrophy {
  key: string
  label: string
  earnedAt: string | null
}

export function pinsFrom(trophies: EarnedTrophy[]): CredencialPin[] {
  return trophies
    .filter((t): t is EarnedTrophy & { earnedAt: string } => Boolean(t.earnedAt))
    .map((t) => ({ key: t.key as TrophyKey, label: t.label, earned: monthStamp(t.earnedAt) }))
}

/** Every catalog trophy with its earned date for one person (null = locked). */
export function trophyStates(earned: Partial<Record<TrophyKey, string>> | undefined) {
  return TROPHY_CATALOG.map((t) => ({ ...t, earnedAt: earned?.[t.key] ?? null }))
}

export function credencialForUser(args: {
  user: User
  rank: UserRank
  folio: number
  team: string | null
  pins: CredencialPin[]
  band: { min: number; max: number } | null
}): CredencialData {
  const { user, rank, folio, team, pins, band } = args
  return {
    surface: 'public',
    name: user.displayName || user.username,
    handle: user.username,
    role: user.role,
    rank,
    isMod: Boolean(user.isMod),
    isOG: Boolean(user.isOG),
    team,
    folio: folioLabel(folio),
    issued: monthStamp(user.joinedAt),
    firma: user.firma?.trim() || null,
    code: null,
    expires: null,
    energy: band ? (band.min + band.max) / 2 : ROLE_HUE[user.role].center,
    pins,
    userId: user.id,
    joinedAt: user.joinedAt,
  }
}

/**
 * An invitation as La Puerta can know it before anyone signs up — the card
 * `peek_invite_card` returns (lib/invitations), never the invite row itself.
 */
export interface InvitePreview {
  code: string
  name: string
  role: Role
  /** «007/150», the invitation's own number; empty when it carries none. */
  folio: string
  /** «SEP 2026». */
  issued: string
  expiresAt?: string | null
  isMod?: boolean
}

export function credencialForInvite(args: {
  invite: InvitePreview
  team: string | null
  /** The username being chosen during registration, live. */
  handle?: string | null
  /** The identity was just minted from it: the card turns public. */
  minted?: boolean
}): CredencialData {
  const { invite, team, handle, minted } = args
  const h = handle?.trim() || null
  return {
    surface: minted ? 'public' : 'invitation',
    name: invite.name?.trim() || h || 'Invitación abierta',
    handle: h,
    role: invite.role,
    rank: 'normie',
    isMod: Boolean(invite.isMod),
    isOG: false,
    team,
    folio: invite.folio || '—',
    issued: invite.issued || '—',
    firma: null,
    code: minted ? null : invite.code,
    expires: minted ? null : (invite.expiresAt ?? null),
    energy: ROLE_HUE[invite.role].center,
    pins: [],
    userId: null,
    joinedAt: null,
  }
}

/** One line for assistive tech — the card itself is drawn. */
export function describeCredencial(d: CredencialData, roleLabel: string, rankLabel: string): string {
  const who = d.handle ? `${d.name}, @${d.handle}` : d.name
  const badge = d.role === 'user' ? rankLabel : roleLabel
  const flags = [d.isMod ? 'MOD' : null, d.isOG ? 'OG' : null].filter(Boolean).join(', ')
  const pins = d.pins.length ? `Insignias: ${d.pins.map((p) => p.label.toLowerCase()).join(', ')}.` : 'Sin insignias todavía.'
  if (d.surface === 'invitation') {
    return `Invitación para ${who}. Rol: ${badge}. Folio ${d.folio}, emitida ${d.issued}. Código ${d.code ?? ''}.`
  }
  return `Credencial de ${who}. ${badge}${flags ? `, ${flags}` : ''}. Folio ${d.folio} (orden de llegada), en la señal desde ${d.issued}. ${pins}`
}
