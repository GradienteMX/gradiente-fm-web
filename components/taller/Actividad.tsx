'use client'

/**
 * ACTIVIDAD — what happened to your work and your words, newest first.
 * Everything below the «visto» watermark reads as seen. A row with a
 * destination opens it in place (the piece with its thread open and the
 * comment addressed); a row without one is information, not a control.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ActivityRow, ContentItem, User } from '@/lib/types'
import { useDispatch, useItems, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { activityFor, type World } from '@/lib/store/world-core'
import { trophyByKey } from '@/lib/trophies'
import { ago, fmt } from '@/lib/logic/time'
import { Avatar } from '@/components/kit/Persona'
import { Accion, Panel, Vacio } from './kit'
import { TrophyGlyph } from './Trofeos'
import styles from './Panel.module.css'

type Row = ActivityRow & { listingId?: string; franjaId?: string }

const FIRST = 7
const TITLE_MAX = 44

/** Titles inside a sentence stay a line long; the full one is on hover. */
function short(t: string): string {
  if (t.length <= TITLE_MAX) return t
  const cut = t.slice(0, TITLE_MAX)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), TITLE_MAX - 12)).replace(/[\s,.:;—–-]+$/, '') + '…'
}

/** Trophies the seed already held carry the seed's own instant: they predate this record. */
export function isSeedTrophy(r: ActivityRow, seedIso: string): boolean {
  return r.kind === 'trophy' && r.at === seedIso
}

/**
 * activityFor + the buyer messages waiting on your franja's market, newest
 * first — except trophies the seed already held, which are not news and sit
 * at the end instead of on top of what actually just happened.
 */
export function buildActivity(w: World, me: User): Row[] {
  const rows: Row[] = [...activityFor(w, me.id)]
  if (me.franjaId) {
    const seenIds = new Set<string>()
    for (const c of w.listingComments) {
      // Ids are unique by construction; a repeated one is a replayed row, not a new message.
      if (seenIds.has(c.id)) continue
      seenIds.add(c.id)
      if (c.franjaId !== me.franjaId || c.isSeller || c.authorId === me.id) continue
      rows.push({ id: 'o:' + c.id, userId: me.id, kind: 'offer', actorId: c.authorId, text: c.body, at: c.at, listingId: c.listingId, franjaId: c.franjaId })
    }
  }
  const seedIso = new Date(w.seedNow).toISOString()
  return rows.sort((a, b) => Number(isSeedTrophy(a, seedIso)) - Number(isSeedTrophy(b, seedIso)) || b.at.localeCompare(a.at))
}

export function isUnread(r: ActivityRow, seen: string, seedIso: string): boolean {
  return r.at > seen && !isSeedTrophy(r, seedIso)
}

export function Actividad({ me, now, onOfertas, index }: { me: User; now: Date; onOfertas: (listingId?: string) => void; index?: string }) {
  const world = useWorld((s) => s.world)
  const items = useItems()
  const dispatch = useDispatch()
  const [all, setAll] = useState(false)

  const rows = useMemo(() => buildActivity(world, me), [world, me])
  const seen = world.activitySeen[me.id] ?? ''
  const seedIso = useMemo(() => new Date(world.seedNow).toISOString(), [world.seedNow])
  const unreadOf = (r: Row) => isUnread(r, seen, seedIso)
  const unread = rows.filter(unreadOf).length
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const visible = all ? rows : rows.slice(0, FIRST)
  const firstSeen = visible.findIndex((r) => !unreadOf(r))

  return (
    <Panel
      label="Actividad"
      index={index}
      area="actividad"
      flush
      meta={unread ? <span className={styles.unreadMeta}>{unread === 1 ? '1 nueva' : `${unread} nuevas`}</span> : rows.length ? 'Al día' : undefined}
      actions={
        unread ? (
          <Accion tone="strong" onClick={() => dispatch({ t: 'seen', userId: me.id, at: new Date().toISOString() })}>
            Marcar visto
          </Accion>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <Vacio>Aquí aparecerá lo que pase con tu trabajo: comentarios, respuestas, reacciones, citas en el foro y trofeos.</Vacio>
      ) : (
        <>
          <ul className={styles.feed}>
            {visible.map((r, i) => (
              <li key={r.id} className={styles.feedItem}>
                {i === firstSeen && i > 0 ? <p className={styles.seenLine}>Ya visto</p> : null}
                <FeedRow row={r} unread={unreadOf(r)} item={r.itemId ? byId.get(r.itemId) ?? null : null} world={world} now={now} onOfertas={onOfertas} />
              </li>
            ))}
          </ul>
          {rows.length > FIRST ? (
            <div className={styles.more}>
              <Accion onClick={() => setAll((a) => !a)}>{all ? 'Mostrar menos' : `Mostrar todo (${rows.length})`}</Accion>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  )
}

function FeedRow({
  row,
  unread,
  item,
  world,
  now,
  onOfertas,
}: {
  row: Row
  unread: boolean
  item: ContentItem | null
  world: World
  now: Date
  onOfertas: (listingId?: string) => void
}) {
  const openLectura = useUI((s) => s.openLectura)
  const router = useRouter()
  const actor = row.actorId ? world.users[row.actorId] ?? null : null
  const thread = row.threadId ? world.threads[row.threadId] ?? null : null
  const listing = row.kind === 'offer' && row.franjaId ? world.items[row.franjaId]?.marketplaceListings?.find((l) => l.id === row.listingId) ?? null : null
  const trophy = row.kind === 'trophy' ? trophyByKey(row.trophyKey ?? row.text) : undefined

  const who: ReactNode = actor ? <b className={styles.who}>@{actor.username}</b> : <b className={styles.who}>Alguien</b>
  const title = item ? (
    <em className={styles.what} title={item.title.length > TITLE_MAX ? item.title : undefined}>
      «{short(item.title)}»
    </em>
  ) : null
  let sentence: ReactNode
  switch (row.kind) {
    case 'comment':
      sentence = <>{who} comentó en {title ?? 'tu pieza'}</>
      break
    case 'reply':
      sentence = (
        <>
          {who} respondió a tu comentario{title ? <> en {title}</> : null}
        </>
      )
      break
    case 'reaction':
      sentence = (
        <>
          {who} reaccionó <span className={styles.rx}>[{row.text === '?' ? '?' : '!'}]</span> a tu comentario{title ? <> en {title}</> : null}
        </>
      )
      break
    case 'quote':
      sentence = (
        <>
          {who} te citó en el foro{thread ? <> · <em className={styles.what}>«{short(thread.subject)}»</em></> : null}
        </>
      )
      break
    case 'trophy':
      sentence = (
        <>
          Trofeo: <b className={styles.who}>{trophy?.label ?? row.text}</b>
        </>
      )
      break
    case 'offer':
      sentence = (
        <>
          {who} escribió sobre {listing ? <em className={styles.what}>«{listing.title}»</em> : 'una pieza de tu mercado'}
        </>
      )
      break
  }
  const excerpt = row.kind === 'comment' || row.kind === 'reply' || row.kind === 'quote' || row.kind === 'offer' ? row.text : null
  const when = row.kind === 'trophy' ? fmt.monthYear(row.at) : ago(row.at, now)

  const onItem = (row.kind === 'comment' || row.kind === 'reply' || row.kind === 'reaction') && item ? item : null
  const threadId = row.kind === 'quote' ? row.threadId : undefined
  const open: ((e: React.MouseEvent<HTMLButtonElement>) => void) | null = onItem
    ? (e) => {
        const r = e.currentTarget.getBoundingClientRect()
        openLectura(onItem.slug, { x: r.left, y: r.top, width: r.width, height: r.height }, { comments: true, focusComment: row.commentId ?? null })
      }
    : threadId
      ? () => router.push(`/foro?hilo=${encodeURIComponent(threadId)}`)
      : row.kind === 'offer'
        ? () => onOfertas(row.listingId)
        : null

  const body = (
    <>
      <span className={styles.feedMark} aria-hidden="true">
        {trophy ? (
          <span className={styles.feedTrophy}>
            <TrophyGlyph k={trophy.key} size={14} />
          </span>
        ) : actor ? (
          <Avatar user={actor} size={28} />
        ) : (
          <span className={styles.feedTrophy} />
        )}
      </span>
      <span className={styles.feedText}>
        <span className={styles.sentence}>{sentence}</span>
        {excerpt ? <span className={styles.excerpt}>{excerpt}</span> : null}
      </span>
      <span className={styles.when}>{when}</span>
      {unread ? <span className={styles.dot} aria-label="Nuevo" /> : null}
    </>
  )

  if (!open)
    return (
      <div className={styles.feedRow} data-unread={unread || undefined} data-static="">
        {body}
      </div>
    )
  return (
    <button type="button" className={styles.feedRow} data-unread={unread || undefined} onClick={open}>
      {body}
    </button>
  )
}
