'use client'

/**
 * HILO — the conversation under a piece, kept as a ledger.
 *   · two reactions only: [!] señal and [?] duda — one per person, the
 *     other replaces, the same clears. No up/down.
 *   · order is by life of the conversation (descendants, then reactions,
 *     then time) — never by who wrote it.
 *   · replies hang from hairline rails; tombstones keep the thread's shape
 *     (a hatched row, RETIRADO); mods state a reason.
 *   · authors edit for 15 minutes; firma closes every comment.
 * Esc / C belong to the sheet (LecturaShell); a reply box's Esc closes only
 * the reply.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Comment, ContentItem, ReactionKind, User } from '@/lib/types'
import { newUuid, useDispatch, useNow, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { ago } from '@/lib/logic/time'
import { canModerate } from '@/lib/permissions'
import { getEmojiTokenMap, unlockedEmojisFor } from '@/lib/trophies'
import { Avatar, Badge, Flags } from '@/components/kit/Persona'
import { Mark } from '@/components/kit/Glyph'
import { useRank } from '@/lib/store/session'
import { flare } from '@/components/stage/api'
import { effectiveBand } from '@/lib/vibe'
import Link from 'next/link'
import styles from './Hilo.module.css'

const MAX_DEPTH = 4
const EDIT_WINDOW_MS = 15 * 60 * 1000

interface Node {
  c: Comment
  children: Node[]
  size: number
}

function buildTree(list: Comment[]): Node[] {
  const byParent = new Map<string | null, Comment[]>()
  for (const c of list) {
    const k = c.parentId
    byParent.set(k, [...(byParent.get(k) ?? []), c])
  }
  const make = (c: Comment): Node => {
    const children = (byParent.get(c.id) ?? []).map(make)
    const size = children.reduce((s, n) => s + 1 + n.size, 0)
    return { c, children: sortNodes(children), size }
  }
  return sortNodes((byParent.get(null) ?? []).map(make))
}

function sortNodes(nodes: Node[]): Node[] {
  return nodes.sort(
    (a, b) =>
      b.size - a.size ||
      b.c.reactions.length - a.c.reactions.length ||
      b.c.createdAt.localeCompare(a.c.createdAt),
  )
}

export function Hilo({ item, focusComment, onClose }: { item: ContentItem; focusComment: string | null; onClose: () => void }) {
  const all = useWorld((s) => s.world.comments)
  const list = useMemo(() => Object.values(all).filter((c) => c.contentItemId === item.id), [all, item.id])
  const tree = useMemo(() => buildTree(list), [list])
  const alive = list.filter((c) => !c.deletion).length
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusComment) return
    const el = scroller.current?.querySelector(`[data-comment="${focusComment}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ block: 'center' })
      el.dataset.flash = '1'
      window.setTimeout(() => delete el.dataset.flash, 1800)
    }
  }, [focusComment])

  return (
    <div className={styles.hilo}>
      <header className={styles.head}>
        <span className={styles.name}>Hilo</span>
        <span className={styles.count}>
          — {alive} {alive === 1 ? 'comentario' : 'comentarios'} · por actividad
        </span>
        <button type="button" className={styles.x} onClick={onClose} aria-label="Ocultar hilo (C)" title="Ocultar hilo (C)">
          <Mark name="close" size={13} />
        </button>
      </header>
      <div className={styles.scroll} ref={scroller} data-lenis-prevent="">
        {tree.length ? (
          <ul className={styles.tree}>
            {tree.map((n) => (
              <CommentNode key={n.c.id} node={n} depth={0} item={item} />
            ))}
          </ul>
        ) : (
          <div className={`${styles.empty} hatch`}>
            <span className={styles.emptyLabel}>Sin comentarios</span>
            <p>Nadie ha dicho nada todavía. Tu lectura puede abrir la conversación.</p>
          </div>
        )}
      </div>
      <Composer item={item} parentId={null} />
    </div>
  )
}

function CommentNode({ node, depth, item }: { node: Node; depth: number; item: ContentItem }) {
  const [expanded, setExpanded] = useState(false)
  const [replying, setReplying] = useState(false)
  const showChildren = depth < MAX_DEPTH || expanded
  return (
    <li className={styles.node} data-depth={Math.min(depth, MAX_DEPTH)}>
      <CommentView c={node.c} item={item} onReply={() => setReplying((r) => !r)} replying={replying} replies={node.size} />
      {replying ? (
        <div className={styles.replyBox}>
          <Composer item={item} parentId={node.c.id} onDone={() => setReplying(false)} autoFocus />
        </div>
      ) : null}
      {node.children.length ? (
        showChildren ? (
          <ul className={styles.children}>
            {node.children.map((n) => (
              <CommentNode key={n.c.id} node={n} depth={depth + 1} item={item} />
            ))}
          </ul>
        ) : (
          <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
            ↳ ver {node.size} {node.size === 1 ? 'respuesta' : 'respuestas'} más
          </button>
        )
      ) : null}
    </li>
  )
}

function Body({ text }: { text: string }) {
  const tokens = getEmojiTokenMap()
  const re = new RegExp(`(${[...tokens.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const parts = tokens.size ? text.split(re) : [text]
  return (
    <p className={styles.body}>
      {parts.map((p, i) => {
        const t = tokens.get(p)
        return t ? (
          <span key={i} className={styles.emoji} title={p}>
            {t.glyph}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </p>
  )
}

function CommentView({ c, item, onReply, replying, replies }: { c: Comment; item: ContentItem; onReply: () => void; replying: boolean; replies: number }) {
  const author = useWorld((s) => s.world.users[c.authorId] ?? null)
  const moderator = useWorld((s) => (c.deletion ? s.world.users[c.deletion.moderatorId] ?? null : null))
  const me = useMe()
  const now = useNow()
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const openReport = useUI((s) => s.openReport)
  const ask = useUI((s) => s.ask)
  const rank = useRank(author?.id)
  const savedC = useWorld((s) => (me ? Boolean(s.world.savedComments[me.id]?.[c.id]) : false))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.body)
  const mineReaction = me ? c.reactions.find((r) => r.userId === me.id)?.kind ?? null : null
  const signal = c.reactions.filter((r) => r.kind === 'signal').length
  const doubt = c.reactions.filter((r) => r.kind === 'provocative').length
  const isMine = me?.id === c.authorId
  const canMod = me ? canModerate(me) : false
  const canEdit = isMine && !c.deletion && now.getTime() - new Date(c.createdAt).getTime() < EDIT_WINDOW_MS
  const band = effectiveBand(item)

  const react = (kind: ReactionKind, el: HTMLElement) => {
    if (!me) return openAccess('Reacciona con [!] o [?]')
    const next = mineReaction === kind ? null : kind
    dispatch({ t: 'react', userId: me.id, commentId: c.id, kind: next, at: new Date().toISOString() })
    if (next) flare(el, kind === 'signal' ? Math.max(band.max, 7) : Math.min(band.min, 3))
  }

  const del = async () => {
    if (!me) return
    if (isMine) {
      const ok = await ask({ title: 'Borrar tu comentario', body: 'Queda una lápida para no romper el hilo. Las respuestas se conservan.', confirmLabel: 'Borrar', destructive: true })
      if (ok) dispatch({ t: 'comment-tombstone', id: c.id, moderatorId: me.id, reason: 'eliminado por autor', at: new Date().toISOString() })
    } else if (canMod) {
      const reason = await ask({ title: 'Moderar comentario', body: 'Di por qué. La razón queda visible en la lápida.', input: { label: 'Razón', placeholder: 'spam · enlace a venta no relacionada', minLength: 3, maxLength: 140 }, confirmLabel: 'Moderar', destructive: true })
      if (typeof reason === 'string') dispatch({ t: 'comment-tombstone', id: c.id, moderatorId: me.id, reason, at: new Date().toISOString() })
    }
  }

  if (!author) return null

  if (c.deletion) {
    const byAuthor = c.deletion.moderatorId === c.authorId
    return (
      <article className={`${styles.comment} ${styles.tomb} hatch`} data-comment={c.id} data-dead="">
        <p className={styles.tombLine}>
          <span className={styles.tombLabel}>Retirado</span>
          <span className={styles.tombWhy}>
            {byAuthor ? 'por su autor' : `moderación · ${c.deletion.reason}`}
            {moderator && !byAuthor ? <span className={styles.tombBy}> — @{moderator.username}</span> : null}
          </span>
        </p>
        {me && (canMod || c.deletion.moderatorId === me.id) ? (
          <button type="button" className={styles.link} onClick={() => dispatch({ t: 'comment-restore', id: c.id, at: new Date().toISOString() })}>
            Restaurar
          </button>
        ) : null}
      </article>
    )
  }

  return (
    <article className={styles.comment} data-comment={c.id} data-mine={isMine || undefined}>
      <header className={styles.who}>
        <Avatar user={author} size={26} rank={rank} />
        <Link href={`/u/${author.username}`} className={styles.handle}>
          @{author.username}
        </Link>
        <Badge user={author} rank={rank} />
        <Flags user={author} />
        {isMine ? <span className={styles.you}>Tú</span> : null}
        <span className={styles.when}>
          <time dateTime={c.createdAt}>{ago(c.createdAt, now)}</time>
          {c.editedAt ? (
            <span className={styles.edited} title={`Editado ${ago(c.editedAt, now)}`}>
              Editado
            </span>
          ) : null}
        </span>
      </header>

      {editing ? (
        <div className={styles.editBox}>
          <textarea className={styles.input} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus aria-label="Editar comentario" />
          <div className={styles.editActions}>
            <button type="button" className={styles.link} onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.send}
              disabled={!draft.trim()}
              onClick={() => {
                dispatch({ t: 'comment-edit', id: c.id, body: draft.trim(), at: new Date().toISOString() })
                setEditing(false)
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <Body text={c.body} />
      )}
      {author.firma ? <p className={styles.firma}>— {author.firma}</p> : null}

      <footer className={styles.foot}>
        <span className={styles.rxs}>
          <button type="button" className={styles.rx} data-kind="signal" data-on={mineReaction === 'signal' || undefined} onClick={(e) => react('signal', e.currentTarget)} aria-pressed={mineReaction === 'signal'} title="Señal — algo prende">
            <b>[!]</b> Señal
            {signal ? <span className={styles.rxN}>{signal}</span> : null}
          </button>
          <button type="button" className={styles.rx} data-kind="doubt" data-on={mineReaction === 'provocative' || undefined} onClick={(e) => react('provocative', e.currentTarget)} aria-pressed={mineReaction === 'provocative'} title="Duda — algo abre pregunta">
            <b>[?]</b> Duda
            {doubt ? <span className={styles.rxN}>{doubt}</span> : null}
          </button>
        </span>
        <button type="button" className={styles.link} data-on={replying || undefined} onClick={onReply} aria-expanded={replying}>
          Responder{replies ? ` · ${replies}` : ''}
        </button>
        {me && !isMine ? (
          <button
            type="button"
            className={styles.link}
            data-on={savedC || undefined}
            aria-pressed={savedC}
            onClick={() => dispatch({ t: 'save-comment', userId: me.id, commentId: c.id, on: !savedC, at: new Date().toISOString() })}
          >
            {savedC ? 'Guardado' : 'Guardar'}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" className={styles.link} onClick={() => setEditing(true)}>
            Editar
          </button>
        ) : null}
        {me && !isMine ? (
          <button type="button" className={styles.link} onClick={() => openReport({ type: 'comment', id: c.id, label: `Comentario de @${author.username}` })}>
            Reportar
          </button>
        ) : null}
        {me && (isMine || canMod) ? (
          <button type="button" className={styles.link} data-danger="" onClick={del}>
            Borrar
          </button>
        ) : null}
      </footer>
    </article>
  )
}

function Composer({ item, parentId, onDone, autoFocus }: { item: ContentItem; parentId: string | null; onDone?: () => void; autoFocus?: boolean }) {
  const me = useMe()
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const trophies = useWorld((s) => (me ? s.world.trophies[me.id] : undefined))
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const emojis = useMemo(() => unlockedEmojisFor(new Set(Object.keys(trophies ?? {}))).filter(Boolean), [trophies])

  if (!me) {
    return (
      <div className={styles.composerOut} data-reply={parentId ? '' : undefined}>
        <button type="button" className={styles.enter} onClick={() => openAccess('Comenta bajo las piezas')}>
          Entra para comentar
        </button>
      </div>
    )
  }

  const send = () => {
    const body = text.trim()
    if (!body) return
    const at = new Date().toISOString()
    // comments.id is a uuid: minted here, kept by the route, so an edit or a reply works at once.
    const comment: Comment = { id: newUuid(), contentItemId: item.id, parentId, authorId: me.id, body, createdAt: at, reactions: [] }
    dispatch({ t: 'comment', comment, at })
    flare(ta.current, (effectiveBand(item).min + effectiveBand(item).max) / 2)
    setText('')
    onDone?.()
  }

  const insert = (token: string) => {
    const el = ta.current
    if (!el) return setText((t) => t + token)
    const s = el.selectionStart
    const e = el.selectionEnd
    const next = text.slice(0, s) + token + text.slice(e)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + token.length, s + token.length)
    })
  }

  return (
    <div className={styles.composer} data-reply={parentId ? '' : undefined}>
      <textarea
        ref={ta}
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={parentId ? 'Responde…' : `Como @${me.username} · ¿qué te movió?`}
        aria-label={parentId ? 'Tu respuesta' : 'Tu comentario'}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
          if (e.key === 'Escape' && onDone) {
            e.stopPropagation()
            onDone()
          }
        }}
      />
      <div className={styles.composerRow}>
        {emojis.length ? (
          <span className={styles.unlocked}>
            {emojis.map((em) =>
              em ? (
                <button key={em.token} type="button" className={styles.emojiBtn} onClick={() => insert(em.token)} title={`Desbloqueado: ${em.token}`}>
                  {em.glyph}
                </button>
              ) : null,
            )}
          </span>
        ) : (
          <span className={styles.hint}>Enter envía · Shift+Enter salto</span>
        )}
        <button type="button" className={styles.send} onClick={send} disabled={!text.trim()}>
          {parentId ? 'Responder' : 'Comentar'}
        </button>
      </div>
    </div>
  )
}

export type { User }
