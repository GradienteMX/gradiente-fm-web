import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentGrid } from '@/components/ContentGrid'
import { getUserByUsername, getUserRankServer } from '@/lib/data/users'
import { getItemsByCreatedBy } from '@/lib/data/items'
import {
  ROLE_LABEL,
  ROLE_COLOR,
  RANK_LABEL,
  RANK_COLOR,
  FLAG_LABEL,
  FLAG_COLOR,
  flagsFor,
} from '@/lib/mockUsers'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const user = await getUserByUsername(decodeURIComponent(params.username))
  if (!user) return { title: 'Usuario no encontrado' }
  return {
    title: `@${user.username} — Gradiente FM`,
    description: user.bio ?? `Perfil público de @${user.username} en Gradiente FM.`,
  }
}

export default async function UserProfilePage({ params }: PageProps) {
  const username = decodeURIComponent(params.username)
  const user = await getUserByUsername(username)
  if (!user) notFound()

  // Rank + published items in parallel — both depend only on user.id.
  const [rank, items] = await Promise.all([
    getUserRankServer(user.id),
    getItemsByCreatedBy(user.id),
  ])

  // Primary identity chip — staff role for guide/insider/curator/admin,
  // derived rank for plain users. Mirrors `badgeFor()` in mockUsers but
  // server-side so we don't need to ship the client helper.
  const isStaff = user.role !== 'user'
  const primaryBadge = isStaff
    ? { label: ROLE_LABEL[user.role], color: ROLE_COLOR[user.role] }
    : { label: RANK_LABEL[rank], color: RANK_COLOR[rank] }
  const flags = flagsFor(user)

  const altaDate = user.joinedAt.slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <header className="border border-border bg-surface p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[120px_minmax(0,1fr)]">
          {/* Avatar */}
          <div className="aspect-square w-full max-w-[120px] overflow-hidden border border-border bg-base">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={`avatar ${user.username}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-syne text-5xl font-black text-sys-orange">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-syne text-2xl font-black text-primary lg:text-3xl">
                {user.displayName}
              </h1>
              <span className="font-mono text-sm text-muted">@{user.username}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="border px-1.5 py-px font-mono text-[10px] tracking-widest"
                style={{ borderColor: primaryBadge.color, color: primaryBadge.color }}
              >
                {primaryBadge.label}
              </span>
              {flags.map((f) => (
                <span
                  key={f}
                  className="border px-1.5 py-px font-mono text-[10px] tracking-widest"
                  style={{ borderColor: FLAG_COLOR[f], color: FLAG_COLOR[f] }}
                >
                  {FLAG_LABEL[f]}
                </span>
              ))}
            </div>

            <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted">
              {user.location && (
                <div className="flex items-baseline gap-1.5">
                  <dt className="tracking-widest text-muted/60">ZONA</dt>
                  <dd className="text-secondary">{user.location}</dd>
                </div>
              )}
              <div className="flex items-baseline gap-1.5">
                <dt className="tracking-widest text-muted/60">ALTA</dt>
                <dd className="text-secondary">{altaDate}</dd>
              </div>
            </dl>

            {user.bio && (
              <p className="mt-2 max-w-prose font-grotesk text-sm leading-relaxed text-secondary">
                {user.bio}
              </p>
            )}

            {user.firma && (
              <p className="mt-1 max-w-prose border-l-2 border-border pl-3 font-mono text-[11px] italic text-muted">
                {user.firma}
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">PUBLICADOS</span>
        </div>
        <p className="sys-label">
          {items.length === 0 ? 'SIN PUBLICACIONES TODAVÍA' : `${items.length} PIEZAS`}
        </p>
        {items.length > 0 && (
          <ContentGrid
            items={items}
            mode="category"
            emptyLabel="// SIN PUBLICACIONES"
          />
        )}
      </section>
    </div>
  )
}
