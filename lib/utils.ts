import { format, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem, ContentType, VibeRange } from './types'

// ── Vibe helpers ─────────────────────────────────────────────────────────────

export function categoryColor(type: ContentType): string {
  switch (type) {
    case 'evento':    return '#E63329'
    case 'mix':       return '#22D3EE'
    case 'review':    return '#F59E0B'
    case 'editorial': return '#84CC16'
    case 'noticia':   return '#F5F5F5'
    case 'opinion':   return '#A78BFA'
    case 'articulo':  return '#FDE68A'
    case 'listicle':  return '#FB923C'
    case 'partner':   return '#6B7280'
  }
}

// Thermo-diverging instrument ramp (redesign 2026). Two hue arms — glacial
// cyan and ember orange — hinged through a near-neutral "estática" gray at
// slot 5, with strictly monotonic OKLCH lightness (0.515 → 0.815) so dim=cold
// and bright=hot reads as a thermal instrument, not a rainbow. Slots 8–10 sit
// on the brand-orange family at the sRGB gamut cusp: the brand color IS the
// meter's overload zone. Every slot clears 3:1 non-text contrast on #0D0D0D.
// Hue never transits green/purple/magenta and never folds back (the rainbow
// tells). OKLCH anchors recorded beside each hex for future P3 upgrades.
export const VIBE_SLOT_COLORS = [
  '#087487', // 0 GLACIAL oklch(0.515 0.089 215)
  '#217B98', // 1 POLAR   oklch(0.545 0.092 224)
  '#48819E', // 2 CHILL   oklch(0.575 0.075 233)
  '#6586A0', // 3 COOL    oklch(0.605 0.055 243)
  '#7A8A9D', // 4 FRESH   oklch(0.628 0.034 253)
  '#948E85', // 5 GROOVE  oklch(0.648 0.014 75) — the hinge: signal dying into static
  '#C38174', // 6 WARM    oklch(0.668 0.085 32)
  '#E17756', // 7 HOT     oklch(0.684 0.140 38)
  '#FC6C0F', // 8 FUEGO   oklch(0.700 0.196 45) — brand orange, gamut cusp
  '#FC9414', // 9 BRASA   oklch(0.760 0.171 62) — broadcast amber
  '#FEB225', // 10 VOLCÁN oklch(0.815 0.163 76) — heading white-hot
] as const

export function vibeToColor(vibe: number): string {
  const slot = Math.max(0, Math.min(10, Math.round(vibe)))
  return VIBE_SLOT_COLORS[slot]
}

// Canonical 11-slot vibe names — one per integer from 0 to 10. The slider,
// fader, composer and overlay chips all read from this single source so
// adjacent slots never share a label.
export const VIBE_SLOT_NAMES = [
  'GLACIAL', 'POLAR', 'CHILL', 'COOL', 'FRESH', 'GROOVE',
  'WARM', 'HOT', 'FUEGO', 'BRASA', 'VOLCÁN',
] as const

export function vibeToLabel(vibe: number): string {
  const slot = Math.max(0, Math.min(10, Math.round(vibe)))
  return VIBE_SLOT_NAMES[slot]
}

export function vibeToPercent(vibe: number): number {
  return (vibe / 10) * 100
}

// Two ranges overlap when neither sits entirely above or entirely below the
// other. Used by the vibe filter against an item's [vibeMin, vibeMax] band.
export function rangesOverlap(
  a: { vibeMin: number; vibeMax: number },
  range: VibeRange
): boolean {
  return a.vibeMax >= range[0] && a.vibeMin <= range[1]
}

// Threshold above which crowd vibe checks override the author's range as the
// item's "displayed" / "effective" band. Mirrors VIBE_CHECK_THRESHOLD in
// lib/vibeChecks.ts — duplicated here so this module stays server-safe (the
// checks module is `'use client'`).
export const VIBE_CHECK_THRESHOLD = 5

// What the home grid filters against and the fader displays at rest. Falls
// through to author until the crowd reaches threshold.
//
// See `Vibe Checks` decision (2026-05-05): vibe checks affect eligibility,
// not just visual chrome — a popular reframing of an item's vibe will move
// it in/out of the slider's range.
export function effectiveVibeBand(item: {
  vibeMin: number
  vibeMax: number
  vibeCheckCount?: number
  vibeCheckMedianMin?: number
  vibeCheckMedianMax?: number
}): [number, number] {
  if (
    item.vibeCheckCount != null &&
    item.vibeCheckCount >= VIBE_CHECK_THRESHOLD &&
    item.vibeCheckMedianMin != null &&
    item.vibeCheckMedianMax != null
  ) {
    return [item.vibeCheckMedianMin, item.vibeCheckMedianMax]
  }
  return [item.vibeMin, item.vibeMax]
}

// Single representative number for the few sites that can't render a band
// (sort proxies, narrow chrome). Most displays should use the gradient.
export function vibeMid(item: { vibeMin: number; vibeMax: number }): number {
  return Math.round((item.vibeMin + item.vibeMax) / 2)
}

// Display label for a vibe range. Collapses to the point form when min===max
// so the common case stays compact. Used by card chips and overlay headers.
export function vibeRangeLabel(item: { vibeMin: number; vibeMax: number }): string {
  // Word labels only — no numeric values shown anywhere in the vibe UI.
  if (item.vibeMin === item.vibeMax) {
    return vibeToLabel(item.vibeMin)
  }
  return `${vibeToLabel(item.vibeMin)} → ${vibeToLabel(item.vibeMax)}`
}

// Band strips are rendered by <VibeMeter> (components/VibeMeter.tsx) — the
// 11-segment stepped meter replaced the old vibeBandGradient CSS-gradient
// helper in the 2026 redesign (zero call sites remained after the swap).

// ── Date helpers ─────────────────────────────────────────────────────────────

export function isExpired(item: ContentItem, now = new Date()): boolean {
  const today = startOfDay(now)
  if (item.type === 'evento') {
    const end = item.endDate ?? item.date
    if (!end) return false
    return isBefore(parseISO(end), today)
  }
  if (item.expiresAt) {
    return isBefore(parseISO(item.expiresAt), today)
  }
  return false
}

export function isUpcoming(item: ContentItem, now = new Date()): boolean {
  return !isExpired(item, now)
}

// True if an evento ended within the last `graceDays` days. Used by the home
// feed to surface recently-passed events alongside upcoming ones — keeps the
// page from looking empty in slow weeks and serves as a lightweight archive.
// Non-eventos return false (their `expiresAt` is an explicit, type-specific
// signal we don't want to override at the home level).
export function isRecentlyPast(
  item: ContentItem,
  graceDays: number,
  now = new Date(),
): boolean {
  if (item.type !== 'evento') return false
  const end = item.endDate ?? item.date
  if (!end) return false
  const endTime = parseISO(end).getTime()
  const nowTime = now.getTime()
  if (endTime >= startOfDay(now).getTime()) return false  // upcoming, not past
  const cutoff = nowTime - graceDays * 24 * 60 * 60 * 1000
  return endTime >= cutoff
}

export function getItemDate(item: ContentItem): Date {
  const raw = item.date ?? item.publishedAt
  return parseISO(raw)
}

// Grace window for recently-past eventos. Past events that ended within this
// many days show up on home + EventosRail with a //PASADO marker. Older
// events are still in the DB but stay filtered from the live feed — the
// PartnerOverlay archive surfaces them without a date cap.
export const HOME_PAST_GRACE_DAYS = 30

export function filterForHome(
  items: ContentItem[],
  now = new Date(),
  graceDays = HOME_PAST_GRACE_DAYS,
): ContentItem[] {
  return items
    .filter((i) => isUpcoming(i, now) || isRecentlyPast(i, graceDays, now))
    .sort((a, b) => getItemDate(a).getTime() - getItemDate(b).getTime())
}

export function filterForCategory(items: ContentItem[], type: ContentItem['type']): ContentItem[] {
  return items
    .filter((i) => i.type === type)
    .sort((a, b) => getItemDate(b).getTime() - getItemDate(a).getTime())
}

export function filterByVibe(items: ContentItem[], range: VibeRange): ContentItem[] {
  return items.filter((i) => {
    const [min, max] = effectiveVibeBand(i)
    return max >= range[0] && min <= range[1]
  })
}

export function filterByDate(items: ContentItem[], date: Date): ContentItem[] {
  return items.filter((i) => {
    const d = parseISO(i.date ?? i.publishedAt)
    return isSameDay(d, date)
  })
}

// Prefers pinned items, falls back to most-recent editorial-flagged non-evento.
export function getPinnedHero(items: ContentItem[]): ContentItem | null {
  const heroTypes: ContentItem['type'][] = ['editorial', 'review', 'noticia', 'opinion']
  const pinned = items
    .filter((i) => i.pinned && heroTypes.includes(i.type))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
  if (pinned.length > 0) return pinned[0]

  return (
    items
      .filter((i) => i.editorial && heroTypes.includes(i.type))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      )[0] ?? null
  )
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtDateShort(iso: string): string {
  return format(parseISO(iso), "d MMM", { locale: es }).toUpperCase()
}

export function fmtDateFull(iso: string): string {
  return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es })
}

export function fmtDayNumber(iso: string): string {
  return format(parseISO(iso), 'd')
}

export function fmtMonthShort(iso: string): string {
  return format(parseISO(iso), 'MMM', { locale: es }).toUpperCase()
}

export function fmtDayName(iso: string): string {
  return format(parseISO(iso), 'EEE', { locale: es }).toUpperCase()
}

export function fmtTime(iso: string): string {
  // iso can be "2026-04-18T22:00:00" — returns "22:00"
  try {
    return format(parseISO(iso), 'HH:mm')
  } catch {
    return ''
  }
}

export function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Whether a keyboard event originated inside an editable element (input,
// textarea, contenteditable). Use to gate global window-level keydown
// listeners so they don't hijack normal typing — e.g. ReaderOverlay's `f`
// hotkey for the flyer lightbox would otherwise fire when the user types
// 'f' in the dashboard composer that mounts ReaderOverlay as a preview.
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}
