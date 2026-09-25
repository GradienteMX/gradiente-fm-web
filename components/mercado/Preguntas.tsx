'use client'

/**
 * PREGUNTAS — questions and answers under a listing. Flat, one reply level,
 * no reactions and no rank effects: a counter, not a stage. Whoever is on
 * the franja's team answers with a VENDEDOR badge. You can withdraw what you
 * wrote; a question leaves together with its answers.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import type { ListingComment } from '@/lib/store/world-core'
import { newUuid, useDispatch, useNow, useWorld } from '@/lib/store/world'
import { useMe, useRank } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { ago } from '@/lib/logic/time'
import { Avatar } from '@/components/kit/Persona'
import { Mark } from '@/components/kit/Glyph'
import styles from './Preguntas.module.css'

const MAX = 600

export function Preguntas({ listing, franja }: { listing: MarketplaceListing; franja: ContentItem }) {
  const all = useWorld((s) => s.world.listingComments)
  // By id: a replayed log can carry the same entry twice (the reducer appends).
  const list = useMemo(() => {
    const seen = new Set<string>()
    return all.filter((c) => c.listingId === listing.id && !seen.has(c.id) && Boolean(seen.add(c.id)))
  }, [all, listing.id])
  const tops = useMemo(() => list.filter((c) => !c.parentId).sort((a, b) => a.at.localeCompare(b.at)), [list])
  const replies = useMemo(() => {
    const m = new Map<string, ListingComment[]>()
    for (const c of list) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c])
    for (const v of m.values()) v.sort((a, b) => a.at.localeCompare(b.at))
    return m
  }, [list])
  const [replying, setReplying] = useState<string | null>(null)
  const answers = list.length - tops.length

  return (
    <section className={styles.preguntas} aria-label="Preguntas al vendedor">
      <header className={styles.head}>
        <span className="label">Preguntas</span>
        <span className={styles.count}>
          {tops.length ? `${tops.length} ${tops.length === 1 ? 'pregunta' : 'preguntas'} · ${answers} ${answers === 1 ? 'respuesta' : 'respuestas'}` : 'responde quien vende'}
        </span>
      </header>

      {tops.length ? (
        <ol className={styles.list}>
          {tops.map((c) => (
            <li key={c.id} className={styles.thread}>
              <Entrada c={c} franja={franja} onReply={() => setReplying(replying === c.id ? null : c.id)} replyOpen={replying === c.id} hasReplies={(replies.get(c.id) ?? []).length > 0} />
              {(replies.get(c.id) ?? []).length ? (
                <ol className={styles.replies}>
                  {(replies.get(c.id) ?? []).map((r) => (
                    <li key={r.id}>
                      <Entrada c={r} franja={franja} reply />
                    </li>
                  ))}
                </ol>
              ) : null}
              {replying === c.id ? (
                <div className={styles.replyBox}>
                  <Composer listing={listing} franja={franja} parentId={c.id} onDone={() => setReplying(null)} autoFocus />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>Nadie ha preguntado todavía. Pregunta por el estado, el envío o el precio: responde {franja.title}.</p>
      )}

      <Composer listing={listing} franja={franja} parentId={null} />
    </section>
  )
}

function Entrada({ c, franja, reply, onReply, replyOpen, hasReplies }: { c: ListingComment; franja: ContentItem; reply?: boolean; onReply?: () => void; replyOpen?: boolean; hasReplies?: boolean }) {
  const author = useWorld((s) => s.world.users[c.authorId] ?? null)
  const rank = useRank(c.authorId)
  const me = useMe()
  const now = useNow()
  const dispatch = useDispatch()
  const ask = useUI((s) => s.ask)
  const openAccess = useUI((s) => s.openAccess)
  if (!author) return null
  const seller = author.franjaId === franja.id || c.isSeller
  const mine = me?.id === c.authorId

  const remove = async () => {
    if (!me) return
    const ok = await ask({
      title: reply ? 'Borrar tu respuesta' : 'Borrar tu pregunta',
      body: !reply && hasReplies ? 'Se va junto con sus respuestas. No se puede deshacer.' : 'No se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    })
    if (ok) dispatch({ t: 'listing-comment-delete', id: c.id, userId: me.id, at: new Date().toISOString() })
  }

  return (
    <article className={styles.entrada} data-seller={seller || undefined} data-mine={mine || undefined}>
      <header className={styles.who}>
        <Avatar user={author} size={24} rank={rank} />
        <Link href={`/u/${author.username}`} className={styles.handle}>
          @{author.username}
        </Link>
        {seller ? (
          <span className={styles.seller} title={`Parte del equipo de ${franja.title}`}>
            Vendedor
          </span>
        ) : null}
        {mine ? <span className={styles.you}>tú</span> : null}
        <span className={styles.when}>{ago(c.at, now)}</span>
      </header>
      <p className={styles.body}>{c.body}</p>
      <div className={styles.foot}>
        {!reply && onReply ? (
          <button type="button" className={styles.link} data-on={replyOpen || undefined} onClick={() => (me ? onReply() : openAccess('Responde en la tienda'))}>
            {replyOpen ? 'Cancelar' : 'Responder'}
          </button>
        ) : null}
        {mine ? (
          <button type="button" className={styles.link} data-danger="" onClick={remove}>
            Borrar
          </button>
        ) : null}
      </div>
    </article>
  )
}

function Composer({ listing, franja, parentId, onDone, autoFocus }: { listing: MarketplaceListing; franja: ContentItem; parentId: string | null; onDone?: () => void; autoFocus?: boolean }) {
  const me = useMe()
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const notify = useUI((s) => s.notify)
  const [body, setBody] = useState('')
  const seller = Boolean(me && me.franjaId === franja.id)

  if (!me) {
    if (parentId) return null
    return (
      <button type="button" className={styles.gate} onClick={() => openAccess('Pregunta a quien vende')}>
        <Mark name="lock" size={14} />
        Entra para preguntar
      </button>
    )
  }

  const text = body.trim()
  const send = () => {
    if (!text || text.length > MAX) return
    const at = new Date().toISOString()
    dispatch({
      t: 'listing-comment',
      comment: { id: newUuid(), listingId: listing.id, franjaId: franja.id, authorId: me.id, body: text, parentId, isSeller: seller, at },
      at,
    })
    setBody('')
    onDone?.()
    if (!parentId) notify(seller ? 'Publicado en la tienda.' : `Pregunta enviada. ${franja.title} responde aquí.`)
  }

  return (
    <div className={styles.composer} data-reply={parentId ? '' : undefined}>
      <textarea
        className={styles.input}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            send()
          }
        }}
        rows={parentId ? 2 : 3}
        maxLength={MAX + 40}
        placeholder={parentId ? (seller ? 'Responde como vendedor…' : 'Responde…') : seller ? 'Añade una nota para quien pregunte…' : 'Pregunta por la condición, el envío, el precio…'}
        aria-label={parentId ? 'Respuesta' : 'Pregunta'}
        autoFocus={autoFocus}
      />
      <div className={styles.composerRow}>
        <span className={styles.hint} data-over={text.length > MAX || undefined}>
          {seller ? 'Respondes como vendedor · ' : ''}
          {text.length}/{MAX}
        </span>
        <button type="button" className={styles.send} disabled={!text || text.length > MAX} onClick={send}>
          {parentId ? 'Responder' : seller ? 'Publicar nota' : 'Preguntar'}
        </button>
      </div>
    </div>
  )
}
