import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ContentGrid } from '@/components/ContentGrid'
import { TrophyGrid, trophyCountLine } from '@/components/profile/TrophyGrid'
import { VibeMeterLight } from '@/components/dashboard/widgets/shared/VibeMeterLight'
import { getUserByUsername, getUserRankServer, getTrophyKeysByUserId } from '@/lib/data/users'
import { getItemsByCreatedBy } from '@/lib/data/items'
import { effectiveVibeBand, vibeRangeLabel } from '@/lib/utils'
import {
  ROLE_LABEL,
  ROLE_COLOR,
  RANK_LABEL,
  RANK_COLOR,
  FLAG_LABEL,
  FLAG_COLOR,
  flagsFor,
} from '@/lib/mockUsers'

// ── /u/[username] — the printed EXPEDIENTE (fase E) ─────────────────────────
//
// The public profile in the pliego register: a document about a person,
// stamped on paper. Per [[project_user_hp_visibility]] the ENTIRE public
// identity is: role/rank chips, bio/firma, trophies (earned dates are
// public by RLS design), published pieces, and the vibe of those pieces in
// WORDS. No HP scalar, no HL, no engagement counters — ever, on this page.

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const user = await getUserByUsername(decodeURIComponent(params.username))
  if (!user) return { title: 'Usuario no encontrado' }
  return {
    title: `@${user.username} — Gradiente`,
    description: user.bio ?? `Perfil público de @${user.username} en Gradiente.`,
  }
}

// «AGO 2026» — printed month stamp for ALTA / EN LA SEÑAL DESDE.
function monthStamp(iso: string): string {
  return format(parseISO(iso), 'MMM yyyy', { locale: es }).toUpperCase()
}

// The identity chip, spine pattern — ink-bordered chip, 8px swatch square
// carrying the badge color, ink label. Same anatomy as IdentitySpine's chip.
function IdentityChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-ink px-2 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink">
      <span aria-hidden className="h-2 w-2 border border-ink" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

export default async function UserProfilePage({ params }: PageProps) {
  const username = decodeURIComponent(params.username)
  const user = await getUserByUsername(username)
  if (!user) notFound()

  // Rank + published items + trophies in parallel — all keyed on user.id.
  const [rank, allItems, trophies] = await Promise.all([
    getUserRankServer(user.id),
    getItemsByCreatedBy(user.id),
    getTrophyKeysByUserId(user.id),
  ])
  // Franjas never enter a content grid (Franjas Isolation law) — admin-created
  // franja rows are identity surfaces, not this person's pieces.
  const items = allItems.filter((i) => i.type !== 'franja')
  const trophyKeys = trophies.map((t) => t.key)
  const trophyEarnedAt = new Map(trophies.map((t) => [t.key, t.earnedAt]))

  // Primary identity chip — staff role for guide/insider/curator/admin,
  // derived rank for plain users. Mirrors `badgeFor()` in mockUsers but
  // server-side so we don't need to ship the client helper.
  const isStaff = user.role !== 'user'
  const primaryBadge = isStaff
    ? { label: ROLE_LABEL[user.role], color: ROLE_COLOR[user.role] }
    : { label: RANK_LABEL[rank], color: RANK_COLOR[rank] }
  const flags = flagsFor(user)

  // Rank banner across the avatar plate — user-tier earned progression only
  // (same gate the old avatarFrameStyle used: staff carry their role chip,
  // normie has no progression to print yet).
  const rankBanner = !isStaff && rank !== 'normie' ? RANK_LABEL[rank] : null

  const altaLabel = monthStamp(user.joinedAt)

  // Aggregate vibe band of their published pieces — min/max of each item's
  // effective (crowd-corrected) band. Words only at render; null when the
  // expediente has no pieces so the block omits itself honestly.
  let vibeBand: [number, number] | null = null
  if (items.length > 0) {
    let lo = 10
    let hi = 0
    for (const item of items) {
      const [bandLo, bandHi] = effectiveVibeBand(item)
      lo = Math.min(lo, bandLo)
      hi = Math.max(hi, bandHi)
    }
    vibeBand = [lo, hi]
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        {/* ── CABECERA — the document head ─────────────────────────────── */}
        <header className="grid grid-cols-1 gap-6 border-b border-ink pb-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-0">
          <div className="flex flex-col gap-4 lg:pr-8">
            <p className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
              EXPEDIENTE · /U/{user.username.toUpperCase()}
            </p>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* Avatar plate — 2px ink border; rank word banners the base
                  when the reader has earned past normie. */}
              <div className="relative aspect-square w-[132px] shrink-0 overflow-hidden border-2 border-ink bg-paper-raised">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={`avatar ${user.username}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-syne text-5xl font-extrabold text-ink">
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {rankBanner && (
                  <div className="absolute inset-x-0 bottom-0 bg-ink px-1 py-0.5 text-center font-mono text-d11 font-bold tracking-widest text-paper">
                    {rankBanner}
                  </div>
                )}
              </div>

              {/* Identity block */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <h1 className="min-w-0 break-words font-syne text-display font-extrabold leading-none text-ink">
                  @{user.username}
                </h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <IdentityChip label={primaryBadge.label} color={primaryBadge.color} />
                  {flags.map((f) => (
                    <IdentityChip key={f} label={FLAG_LABEL[f]} color={FLAG_COLOR[f]} />
                  ))}
                  {user.location && (
                    <span className="font-mono text-d11 tracking-widest text-ink-faint">
                      ZONA · {user.location.toUpperCase()}
                    </span>
                  )}
                  <span className="font-mono text-d11 tracking-widest text-ink-faint">
                    ALTA · {altaLabel}
                  </span>
                </div>

                {user.bio && (
                  <p className="max-w-[58ch] font-grotesk text-d15 leading-relaxed text-ink-soft">
                    {user.bio}
                  </p>
                )}

                {/* Firma — the printed signature line */}
                {user.firma && (
                  <p className="max-w-[58ch] border-l-2 border-ink pl-3 font-mono text-d13 italic text-ink-faint">
                    {user.firma}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column — the ficha ─────────────────────────────────── */}
          <aside
            aria-label="Ficha del expediente"
            className="flex flex-col gap-4 border-t border-ink pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
          >
            {vibeBand && (
              <div className="flex flex-col gap-2">
                <h2 className="font-mono text-d11 font-bold tracking-widest text-ink-soft">
                  VIBE DE SUS PIEZAS
                </h2>
                <VibeMeterLight band={vibeBand} size="md" />
                <p className="font-mono text-d13 font-bold tracking-widest text-ink">
                  {vibeRangeLabel({ vibeMin: vibeBand[0], vibeMax: vibeBand[1] })}
                </p>
              </div>
            )}

            <dl className="flex flex-col">
              {items.length > 0 && (
                <div className="flex items-baseline justify-between gap-3 border-t border-ink py-2">
                  <dt className="font-mono text-d11 tracking-widest text-ink-faint">
                    PIEZAS PUBLICADAS
                  </dt>
                  <dd className="font-mono text-d13 font-bold text-ink">{items.length}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-ink py-2">
                <dt className="font-mono text-d11 tracking-widest text-ink-faint">TROFEOS</dt>
                <dd className="font-mono text-d13 font-bold text-ink">
                  {trophyCountLine(trophyKeys)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-ink py-2">
                <dt className="font-mono text-d11 tracking-widest text-ink-faint">
                  EN LA SEÑAL DESDE
                </dt>
                <dd className="font-mono text-d13 font-bold text-ink">{altaLabel}</dd>
              </div>
            </dl>
          </aside>
        </header>

        {/* ── TROFEOS ──────────────────────────────────────────────────── */}
        <section aria-labelledby="trofeos-head" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-2">
            <h2 id="trofeos-head" className="font-syne text-d28 font-extrabold text-ink">
              Trofeos
            </h2>
            <p className="font-mono text-d11 tracking-widest text-ink-faint">
              {trophyCountLine(trophyKeys)} DESBLOQUEADOS
            </p>
          </div>
          <TrophyGrid earnedKeys={trophyKeys} earnedAtByKey={trophyEarnedAt} />
        </section>

        {/* ── PUBLICADOS — the global vibe slider keeps filtering this grid
            (deliberate: the expediente's pieces live on the same dial). ── */}
        <section aria-labelledby="publicados-head" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-2">
            <h2 id="publicados-head" className="font-syne text-d28 font-extrabold text-ink">
              Publicados
            </h2>
            <p className="font-mono text-d11 tracking-widest text-ink-faint">
              {items.length === 0 ? 'SIN PUBLICACIONES TODAVÍA' : `${items.length} PIEZAS`}
            </p>
          </div>
          {items.length > 0 && (
            <ContentGrid
              items={items}
              mode="category"
              emptyLabel="SIN PIEZAS EN ESTE RANGO DE VIBE"
            />
          )}
        </section>
      </div>
    </>
  )
}
