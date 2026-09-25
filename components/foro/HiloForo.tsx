'use client'

/**
 * HILO DE FORO — one thread, over the field.
 *
 * It unfolds from its own poster (clip-path from the tile's rect), the field
 * dims and keeps moving behind, and it folds back into the poster on close —
 * which is when the wall shows you what your reply did (the poster flies to
 * slot 01). The OP is framed; replies are flat and chronological. `>>id`
 * quotes render as the cited author's @name (never an id), jump and pulse on
 * click, and are drawn as string on the wall (Cuerdas) on hover or focus.
 * Mods retire posts with a stated reason and can restore them; anyone signed
 * in can report someone else's post.
 */

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import gsap from 'gsap'
import type { ForoThread, User } from '@/lib/types'
import type { ForoDeletion } from '@/lib/types'
import { useDispatch, useNow, useWorld } from '@/lib/store/world'
import { useMe, useRank } from '@/lib/store/session'
import { useUI, type OriginRect } from '@/lib/store/ui'
import { canModerate } from '@/lib/permissions'
import { ago, fmt } from '@/lib/logic/time'
import { bandLabel, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { setFieldDim } from '@/components/stage/api'
import { asentar } from '@/components/trama/api'
import { Mark } from '@/components/kit/Glyph'
import { Avatar, Badge, Flags } from '@/components/kit/Persona'
import { Sheet } from '@/components/kit/Sheet'
import { Button } from '@/components/kit/Button'
import { Cuerdas, type ActiveCuerda, type CuerdaLink } from './Cuerdas'
import { Responder, type ResponderHandle } from './Responder'
import { Visor, type VisorState } from './Visor'
import { bandCode, bandVar, eVar, genreEnergy, genreName, onEnergy, pad2, repliesOf, tagName, threadBand } from './foro'
import styles from './HiloForo.module.css'

interface Props {
  id: string
  origin: OriginRect | null
  /** 1-based slot on the wall, or null when the thread has fallen off. */
  slot: number | null
  onClose: () => void
}

export function HiloForo({ id, origin, slot, onClose }: Props) {
  const thread = useWorld((s) => s.world.threads[id] ?? null)
  const hydrated = useWorld((s) => s.hydrated)
  if (!thread) {
    if (!hydrated) return null
    return (
      <Sheet open onClose={onClose} label="Hilo no disponible" width={460}>
        <div className={styles.missing}>
          <p className={styles.missingTitle}>Este hilo no está aquí.</p>
          <p className="meta">Puede que el enlace esté roto. El muro sigue en su lugar.</p>
          <Button variant="ink" onClick={onClose}>
            Volver al muro
          </Button>
        </div>
      </Sheet>
    )
  }
  return <Panel thread={thread} origin={origin} slot={slot} onClose={onClose} />
}

// ── the panel ───────────────────────────────────────────────────────────────

interface Ctx {
  now: Date
  labelFor: (id: string) => string
  isMine: (id: string) => boolean
  postIds: Set<string>
  cite: (id: string) => void
  quoteHover: (from: string, to: string | null) => void
  quoteClick: (from: string, to: string) => void
  postEnter: (id: string) => void
  postLeave: (id: string) => void
  openVisor: (images: string[], index: number, el: HTMLElement | null) => void
  report: (id: string, label: string) => void
  retire: (target: 'thread' | 'reply', id: string) => void
  restore: (target: 'thread' | 'reply', id: string) => void
}

const EMPTY: string[] = []

function Panel({ thread, origin, slot, onClose }: { thread: ForoThread; origin: OriginRect | null; slot: number | null; onClose: () => void }) {
  const repliesAll = useWorld((s) => s.world.replies)
  const users = useWorld((s) => s.world.users)
  const me = useMe()
  const now = useNow()
  const dispatch = useDispatch()
  const ask = useUI((s) => s.ask)
  const openReport = useUI((s) => s.openReport)
  const openAccess = useUI((s) => s.openAccess)
  const notify = useUI((s) => s.notify)
  const sheetOpen = useUI((s) => Boolean(s.dialog || s.report || s.access || s.searchOpen))

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const responder = useRef<ResponderHandle>(null)
  const returnTo = useRef<Element | null>(null)
  const reduced = useRef(false)
  const [closing, setClosing] = useState(false)
  const [gone, setGone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [visor, setVisor] = useState<VisorState | null>(null)

  const replies = useMemo(() => repliesOf(repliesAll, thread.id), [repliesAll, thread.id])
  const band = threadBand(thread.genres)
  const color = eVar(band.mid)
  const isMod = canModerate(me)
  const alive = replies.filter((r) => !r.deletion).length

  // ── indexes: who wrote what, who quoted whom ──────────────────────────────
  const postIds = useMemo(() => new Set([thread.id, ...replies.map((r) => r.id)]), [thread.id, replies])
  const authorOf = useMemo(() => {
    const m = new Map<string, string>([[thread.id, thread.authorId]])
    for (const r of replies) m.set(r.id, r.authorId)
    return m
  }, [thread.id, thread.authorId, replies])
  const quotesOf = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of replies) {
      const q = (r.quotedReplyIds ?? []).filter((x) => postIds.has(x) && x !== r.id)
      if (q.length) m.set(r.id, [...new Set(q)])
    }
    return m
  }, [replies, postIds])
  const backlinks = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const [from, qs] of quotesOf) {
      for (const q of qs) {
        const l = m.get(q) ?? []
        if (!l.includes(from)) l.push(from)
        m.set(q, l)
      }
    }
    return m
  }, [quotesOf])
  const links = useMemo<CuerdaLink[]>(() => [...quotesOf].flatMap(([from, qs]) => qs.map((to) => ({ from, to }))), [quotesOf])

  const labelFor = useCallback(
    (pid: string) => {
      const uid = authorOf.get(pid)
      const u = uid ? users[uid] : undefined
      return u ? `@${u.username}` : '@alguien'
    },
    [authorOf, users],
  )
  const isMine = useCallback((pid: string) => Boolean(me && authorOf.get(pid) === me.id), [authorOf, me])

  // ── strings: soft (a hovered post), strong (a hovered quote) ──────────────
  const [soft, setSoft] = useState<string | null>(null)
  const [strong, setStrong] = useState<{ from: string; to: string } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [pulsed, setPulsed] = useState<string | null>(null)
  const softTimer = useRef(0)
  const pulseTimer = useRef(0)
  const strongTimer = useRef(0)

  const active = useMemo<ActiveCuerda[]>(() => {
    const out = new Map<string, ActiveCuerda>()
    const add = (from: string, to: string, s: boolean) => {
      const key = `${from}>${to}`
      const prev = out.get(key)
      out.set(key, { key, from, to, strong: s || Boolean(prev?.strong) })
    }
    if (soft) {
      for (const q of quotesOf.get(soft) ?? EMPTY) add(soft, q, false)
      for (const b of backlinks.get(soft) ?? EMPTY) add(soft, b, false)
    }
    if (strong) add(strong.from, strong.to, true)
    return [...out.values()]
  }, [soft, strong, quotesOf, backlinks])

  const lit = useMemo(() => {
    const s = new Set<string>()
    for (const a of active) {
      s.add(a.from)
      s.add(a.to)
    }
    if (hint) s.add(hint)
    return s
  }, [active, hint])

  const focusPost = useCallback((pid: string) => {
    const el = wrapRef.current?.querySelector<HTMLElement>(`[data-post="${pid}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: reduced.current ? 'auto' : 'smooth', block: 'center' })
    setPulsed(null)
    requestAnimationFrame(() => setPulsed(pid))
    window.clearTimeout(pulseTimer.current)
    pulseTimer.current = window.setTimeout(() => setPulsed(null), 1800)
  }, [])

  const ctx = useMemo<Ctx>(
    () => ({
      now,
      labelFor,
      isMine,
      postIds,
      cite: (pid) => responder.current?.cite(pid),
      quoteHover: (from, to) => {
        window.clearTimeout(strongTimer.current)
        setStrong(to ? { from, to } : null)
      },
      quoteClick: (from, to) => {
        setStrong({ from, to })
        focusPost(to)
        window.clearTimeout(strongTimer.current)
        strongTimer.current = window.setTimeout(() => setStrong((cur) => (cur && cur.from === from && cur.to === to ? null : cur)), 2000)
      },
      postEnter: (pid) => {
        window.clearTimeout(softTimer.current)
        softTimer.current = window.setTimeout(() => setSoft(pid), 140)
      },
      postLeave: (pid) => {
        window.clearTimeout(softTimer.current)
        setSoft((cur) => (cur === pid ? null : cur))
      },
      openVisor: (images, index, el) => {
        const r = el?.getBoundingClientRect()
        setVisor({ images, index, from: r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null })
      },
      report: (pid, label) => {
        if (!me) return openAccess('Reporta en el foro')
        openReport({ type: pid === thread.id ? 'foro_thread' : 'foro_reply', id: pid, label })
      },
      retire: async (target, pid) => {
        if (!me || !canModerate(me)) return
        const reason = await ask({
          title: target === 'thread' ? 'Borrar hilo' : 'Borrar respuesta',
          body:
            target === 'thread'
              ? 'El hilo sale del muro y queda una lápida con tu razón, visible para todos. Se puede restaurar.'
              : 'La respuesta conserva su lugar en el hilo; su texto se reemplaza por una lápida con tu razón.',
          input: { label: 'Razón', placeholder: 'spam · acoso · fuera de tema', minLength: 3, maxLength: 140 },
          confirmLabel: 'Borrar',
          destructive: true,
        })
        if (typeof reason !== 'string') return
        dispatch({ t: 'foro-tombstone', target, id: pid, moderatorId: me.id, reason, at: new Date().toISOString() })
        notify(target === 'thread' ? 'Hilo retirado. Sale del muro al cerrar.' : 'Respuesta retirada.')
      },
      restore: (target, pid) => {
        if (!me || !canModerate(me)) return
        dispatch({ t: 'foro-tombstone', target, id: pid, moderatorId: me.id, reason: null, at: new Date().toISOString() })
        notify(target === 'thread' ? 'Hilo restaurado. Vuelve al muro por su último movimiento.' : 'Respuesta restaurada.')
      },
    }),
    [now, labelFor, isMine, postIds, focusPost, me, openAccess, openReport, thread.id, ask, dispatch, notify],
  )

  // ── open: unfold from the poster ──────────────────────────────────────────
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    returnTo.current = document.activeElement
    asentar() // any print-reveal still running on the page finishes now
    setFieldDim(0.72)
    const r = el.getBoundingClientRect()
    if (!reduced.current && origin && r.width > 0) {
      const top = Math.max(0, origin.y - r.top)
      const left = Math.max(0, origin.x - r.left)
      const right = Math.max(0, r.right - (origin.x + origin.width))
      const bottom = Math.max(0, r.bottom - (origin.y + origin.height))
      gsap.fromTo(
        el,
        { clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round 0px)` },
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.55, ease: 'expo.out', clearProps: 'clipPath' },
      )
      gsap.fromTo(
        el.querySelectorAll('[data-rise]'),
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out', stagger: 0.03, delay: 0.1, clearProps: 'transform,opacity' },
      )
    } else {
      gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: reduced.current ? 0.16 : 0.5, ease: 'expo.out', clearProps: 'opacity,transform' })
    }
    el.focus({ preventScroll: true })
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      setFieldDim(0)
      document.body.style.overflow = prev
      window.clearTimeout(softTimer.current)
      window.clearTimeout(pulseTimer.current)
      window.clearTimeout(strongTimer.current)
      ;(returnTo.current as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A dialog opened over the thread (reason, report, access) resets the dim.
  useEffect(() => {
    if (!sheetOpen && !closing) setFieldDim(0.72)
  }, [sheetOpen, closing])

  // The Consola floats above reading surfaces (bottom-left, by design). The
  // panel ends above it so the reply line is never under the deck.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const findDeck = () => document.querySelector<HTMLElement>('section[aria-label="Consola"]')
    // Layout, not rects: the capsule animates in with a transform.
    const fit = () => {
      const deck = findDeck()
      let clear = 0
      if (deck && !deck.hasAttribute('data-hidden') && deck.offsetHeight > 0) {
        const bottom = parseFloat(getComputedStyle(deck).bottom) || 0
        clear = Math.round(deck.offsetHeight + bottom + 10)
      }
      root.style.setProperty('--deck', `${clear}px`)
    }
    fit()
    let later = 0
    const refit = () => {
      fit()
      window.clearTimeout(later)
      later = window.setTimeout(fit, 480) // after the capsule's own height transition
    }
    const mo = new MutationObserver(refit)
    const target = findDeck()
    if (target) mo.observe(target, { attributes: true, attributeFilter: ['data-hidden', 'data-mode', 'class'] })
    window.addEventListener('resize', fit)
    return () => {
      mo.disconnect()
      window.clearTimeout(later)
      window.removeEventListener('resize', fit)
    }
  }, [])

  // ── close: fold back into the poster, wherever it hangs now ───────────────
  const close = useCallback(() => {
    const el = panelRef.current
    if (!el || closing) return
    setClosing(true)
    setVisor(null)
    setFieldDim(0)
    const finish = () => {
      setGone(true)
      onClose()
    }
    const tile = document.querySelector<HTMLElement>(`[data-flip-id="${thread.id}"] [data-flip-paper]`)
    const t = tile?.getBoundingClientRect()
    const onScreen = t && t.width > 0 && t.bottom > 0 && t.top < window.innerHeight
    if (!reduced.current && t && onScreen) {
      const r = el.getBoundingClientRect()
      const top = Math.max(0, t.top - r.top)
      const left = Math.max(0, t.left - r.left)
      const right = Math.max(0, r.right - t.right)
      const bottom = Math.max(0, r.bottom - t.bottom)
      gsap.to(el, { clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round 0px)`, opacity: 0.35, duration: 0.42, ease: 'expo.inOut', onComplete: finish })
    } else {
      gsap.to(el, { opacity: 0, y: 12, duration: reduced.current ? 0.12 : 0.26, ease: 'power2.in', onComplete: finish })
    }
  }, [closing, onClose, thread.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel || visor) return
      const others = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some((d) => d !== panel && !panel.contains(d))
      if (others) return
      if (e.key === 'Escape') {
        close()
      } else if (e.key === 'Tab') {
        const f = [...panel.querySelectorAll<HTMLElement>('a[href], button, textarea, input, [tabindex]:not([tabindex="-1"])')].filter(
          (x) => !x.hasAttribute('disabled') && x.offsetParent !== null,
        )
        if (!f.length) return
        const a = f[0]
        const b = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === a || document.activeElement === panel)) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, visor])

  // After a reply lands, bring it into view and pulse it.
  const pendingFocus = useRef<string | null>(null)
  useLayoutEffect(() => {
    const pid = pendingFocus.current
    if (!pid || !postIds.has(pid)) return
    pendingFocus.current = null
    focusPost(pid)
  }, [postIds, focusPost])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/foro?hilo=${thread.id}`)
    } catch {
      /* ignore */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const mineThread = Boolean(me && me.id === thread.authorId)
  const version = `${replies.length}:${replies.filter((r) => r.deletion).length}:${thread.deletion ? 1 : 0}:${replies.filter((r) => r.imageUrl).length}`

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={rootRef}
      className={styles.root}
      data-closing={closing || undefined}
      data-gone={gone || undefined}
      style={{ ['--e' as string]: color, ['--on-e' as string]: onEnergy(band.mid), ['--band' as string]: bandVar(band.min, band.max) }}
    >
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={`Hilo: ${thread.subject}`} tabIndex={-1}>
        <header className={styles.head}>
          <div className={styles.headLeft}>
            <span className={styles.kind}>Hilo</span>
            <span className={styles.slotTag} data-off={slot === null || undefined}>
              {thread.deletion ? 'retirado' : slot === null ? 'fuera del muro' : `lugar ${pad2(slot)}`}
            </span>
            {band.known ? (
              <span className={styles.bandTag} style={{ background: bandVar(band.min, band.max) }}>
                {bandCode(band.min, band.max)} · {bandLabel(Math.round(band.min), Math.round(band.max))}
              </span>
            ) : null}
            <span className={styles.rcount} title={`${alive} ${alive === 1 ? 'respuesta' : 'respuestas'}`}>
              R·{pad2(alive)}
            </span>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={copy}>
              <Mark name={copied ? 'check' : 'share'} size={15} />
              <span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
            </button>
            {me && !mineThread && !thread.deletion ? (
              <button type="button" className={styles.action} onClick={() => ctx.report(thread.id, `Hilo «${thread.subject}»`)}>
                <Mark name="flag" size={14} />
                <span>Reportar</span>
              </button>
            ) : null}
            {isMod ? (
              thread.deletion ? (
                <button type="button" className={styles.action} onClick={() => ctx.restore('thread', thread.id)}>
                  <span>Restaurar hilo</span>
                </button>
              ) : (
                <button type="button" className={styles.action} data-danger="" onClick={() => void ctx.retire('thread', thread.id)}>
                  <Mark name="close" size={12} />
                  <span>Borrar hilo</span>
                </button>
              )
            ) : null}
            <button type="button" className={styles.close} onClick={close} aria-label="Cerrar hilo (Esc)">
              <Mark name="close" size={16} />
              <kbd>Esc</kbd>
            </button>
          </div>
        </header>

        <div ref={scrollRef} className={styles.scroll} data-lenis-prevent="">
          <div ref={wrapRef} className={styles.wrap}>
            <Cuerdas wrapRef={wrapRef} links={links} active={active} color={color} version={version} />

            {slot === null && !thread.deletion ? (
              <p className={styles.fallen} data-rise="">
                Este hilo cayó del muro. Una respuesta lo pega de nuevo en el lugar 01.
              </p>
            ) : null}

            <OP thread={thread} band={band} ctx={ctx} lit={lit.has(thread.id)} pulsed={pulsed === thread.id} backlinks={backlinks.get(thread.id) ?? EMPTY} author={users[thread.authorId] ?? null} moderator={thread.deletion ? users[thread.deletion.moderatorId] ?? null : null} />

            {replies.length ? (
              <ol className={styles.replies} aria-label="Respuestas, en orden de llegada">
                {replies.map((r) => (
                  <li key={r.id} data-rise="">
                    <Post
                      id={r.id}
                      author={users[r.authorId] ?? null}
                      moderator={r.deletion ? users[r.deletion.moderatorId] ?? null : null}
                      body={r.body}
                      createdAt={r.createdAt}
                      image={r.imageUrl}
                      deletion={r.deletion}
                      backlinks={backlinks.get(r.id) ?? EMPTY}
                      linked={quotesOf.has(r.id) || backlinks.has(r.id)}
                      mine={Boolean(me && me.id === r.authorId)}
                      canReport={Boolean(me && me.id !== r.authorId && !r.deletion)}
                      canMod={isMod}
                      lit={lit.has(r.id)}
                      pulsed={pulsed === r.id}
                      ctx={ctx}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.none} data-rise="">
                {thread.deletion
                  ? 'Sin respuestas.'
                  : slot === 1
                    ? 'Sin respuestas todavía. La conversación empieza aquí.'
                    : 'Sin respuestas todavía. La primera lo sube al lugar 01.'}
              </p>
            )}
          </div>
        </div>

        <Responder
          ref={responder}
          thread={thread}
          postIds={postIds}
          labelFor={labelFor}
          energy={band.mid}
          slot={slot}
          onPosted={(rid) => {
            pendingFocus.current = rid
          }}
          onQuoteHover={setHint}
          onQuoteClick={focusPost}
        />
        <span className={styles.energy} aria-hidden="true" />
      </div>
      {visor ? <Visor state={visor} onIndex={(i) => setVisor((v) => (v ? { ...v, index: i, from: null } : v))} onClose={() => setVisor(null)} /> : null}
    </div>,
    document.body,
  )
}

// ── the opening post ────────────────────────────────────────────────────────

function OP({
  thread,
  band,
  ctx,
  lit,
  pulsed,
  backlinks,
  author,
  moderator,
}: {
  thread: ForoThread
  band: ReturnType<typeof threadBand>
  ctx: Ctx
  lit: boolean
  pulsed: boolean
  backlinks: string[]
  author: User | null
  moderator: User | null
}) {
  const images = thread.imageUrls?.length ? thread.imageUrls : [thread.imageUrl]
  const linked = backlinks.length > 0
  return (
    <article
      className={styles.op}
      data-post={thread.id}
      data-lit={lit || undefined}
      data-pulse={pulsed || undefined}
      data-dead={thread.deletion ? '' : undefined}
      data-rise=""
      onPointerEnter={linked ? () => ctx.postEnter(thread.id) : undefined}
      onPointerLeave={linked ? () => ctx.postLeave(thread.id) : undefined}
    >
      <span className={styles.pin} data-pin={thread.id} data-lit={lit || undefined} aria-hidden="true" />
      {thread.deletion ? (
        <div className={styles.opDead}>
          <PostHead id={thread.id} author={author} createdAt={thread.createdAt} ctx={ctx} canCite={false} />
          <Lapida deletion={thread.deletion} moderator={moderator} now={ctx.now} kind="thread" />
          <Backlinks id={thread.id} ids={backlinks} ctx={ctx} />
        </div>
      ) : (
        <div className={styles.opGrid}>
          <div className={styles.gallery}>
            <button type="button" className={styles.cover} onClick={(e) => ctx.openVisor(images, 0, e.currentTarget)} aria-label="Ver la portada completa">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt={`Portada del hilo: ${thread.subject}`} draggable={false} />
            </button>
            {images.length > 1 ? (
              <div className={styles.thumbs}>
                {images.slice(1).map((src, i) => (
                  <button key={src + i} type="button" className={styles.thumb} onClick={(e) => ctx.openVisor(images, i + 1, e.currentTarget)} aria-label={`Ver imagen ${i + 2} de ${images.length}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" draggable={false} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className={styles.opText}>
            <h2 className={styles.subject} style={{ fontVariationSettings: energyVariation(band.mid), fontSize: fitTitle(thread.subject, band.mid, 54, 24, 0.94) }}>
              {thread.subject}
            </h2>
            <PostHead id={thread.id} author={author} createdAt={thread.createdAt} ctx={ctx} canCite />
            {thread.genres.length || thread.tags.length ? (
              <div className={styles.taxo}>
                {thread.genres.map((g) => {
                  const e = genreEnergy(g)
                  return (
                    <span key={g} className={styles.genre}>
                      <i style={{ background: e === null ? 'var(--ink-3)' : eVar(e) }} />
                      {genreName(g)}
                    </span>
                  )
                })}
                {thread.tags.map((tg) => (
                  <span key={tg} className={styles.tag}>
                    #{tagName(tg)}
                  </span>
                ))}
              </div>
            ) : null}
            <Backlinks id={thread.id} ids={backlinks} ctx={ctx} />
            <Texto text={thread.body} from={thread.id} ctx={ctx} />
            <p className={styles.opFoot}>
              Abierto {ago(thread.createdAt, ctx.now)} · último movimiento {ago(thread.bumpedAt, ctx.now)}
            </p>
          </div>
        </div>
      )}
    </article>
  )
}

// ── a reply ─────────────────────────────────────────────────────────────────

interface PostProps {
  id: string
  author: User | null
  moderator: User | null
  body: string
  createdAt: string
  image?: string
  deletion?: ForoDeletion
  backlinks: string[]
  linked: boolean
  mine: boolean
  canReport: boolean
  canMod: boolean
  lit: boolean
  pulsed: boolean
  ctx: Ctx
}

const Post = memo(function Post({ id, author, moderator, body, createdAt, image, deletion, backlinks, linked, mine, canReport, canMod, lit, pulsed, ctx }: PostProps) {
  return (
    <article
      className={styles.post}
      data-post={id}
      data-mine={mine || undefined}
      data-lit={lit || undefined}
      data-pulse={pulsed || undefined}
      data-dead={deletion ? '' : undefined}
      onPointerEnter={linked ? () => ctx.postEnter(id) : undefined}
      onPointerLeave={linked ? () => ctx.postLeave(id) : undefined}
    >
      <span className={styles.pin} data-pin={id} data-lit={lit || undefined} aria-hidden="true" />
      <PostHead id={id} author={author} createdAt={createdAt} ctx={ctx} canCite={!deletion} mine={mine}>
        {canReport ? (
          <button type="button" className={styles.postAction} onClick={() => ctx.report(id, `Respuesta de @${author?.username ?? 'alguien'}`)} title="Reportar respuesta" aria-label="Reportar respuesta">
            <Mark name="flag" size={13} />
          </button>
        ) : null}
        {canMod ? (
          deletion ? (
            <button type="button" className={styles.postAction} onClick={() => ctx.restore('reply', id)}>
              Restaurar
            </button>
          ) : (
            <button type="button" className={styles.postAction} data-danger="" onClick={() => void ctx.retire('reply', id)}>
              Borrar
            </button>
          )
        ) : null}
      </PostHead>
      <Backlinks id={id} ids={backlinks} ctx={ctx} />
      {deletion ? (
        <Lapida deletion={deletion} moderator={moderator} now={ctx.now} kind="reply" />
      ) : (
        <div className={styles.postBody}>
          {image ? (
            <button type="button" className={styles.attach} onClick={(e) => ctx.openVisor([image], 0, e.currentTarget)} aria-label="Ver imagen adjunta">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Imagen adjunta" loading="lazy" draggable={false} />
            </button>
          ) : null}
          <Texto text={body} from={id} ctx={ctx} />
        </div>
      )}
    </article>
  )
})

function PostHead({
  id,
  author,
  createdAt,
  ctx,
  canCite,
  mine,
  children,
}: {
  id: string
  author: User | null
  createdAt: string
  ctx: Ctx
  canCite: boolean
  mine?: boolean
  children?: React.ReactNode
}) {
  const rank = useRank(author?.id)
  return (
    <header className={styles.postHead}>
      {author ? (
        <>
          <Avatar user={author} size={26} rank={rank} />
          <Link href={`/u/${author.username}`} className={styles.handle}>
            @{author.username}
          </Link>
          <Badge user={author} rank={rank} />
          <Flags user={author} />
        </>
      ) : (
        <span className={styles.handle}>@alguien</span>
      )}
      {mine ? <span className={styles.you}>tú</span> : null}
      <time className={styles.when} dateTime={createdAt} title={fmt.full(createdAt)}>
        {ago(createdAt, ctx.now)}
      </time>
      <span className={styles.postActions}>
        {canCite ? (
          <button type="button" className={styles.postAction} onClick={() => ctx.cite(id)} title="Citar en tu respuesta">
            Citar
          </button>
        ) : null}
        {children}
      </span>
    </header>
  )
}

function Backlinks({ id, ids, ctx }: { id: string; ids: string[]; ctx: Ctx }) {
  if (!ids.length) return null
  return (
    <p className={styles.backlinks}>
      <span>respondieron:</span>
      {ids.map((b) => (
        <button
          key={b}
          type="button"
          className={styles.quote}
          onPointerEnter={() => ctx.quoteHover(id, b)}
          onPointerLeave={() => ctx.quoteHover(id, null)}
          onFocus={() => ctx.quoteHover(id, b)}
          onBlur={() => ctx.quoteHover(id, null)}
          onClick={() => ctx.quoteClick(id, b)}
          aria-label={`Ir a la respuesta de ${ctx.labelFor(b)}`}
        >
          {ctx.labelFor(b)}
        </button>
      ))}
    </p>
  )
}

function Lapida({ deletion, moderator, now, kind }: { deletion: ForoDeletion; moderator: User | null; now: Date; kind: 'thread' | 'reply' }) {
  return (
    <div className={styles.lapida}>
      <p>
        <b>{kind === 'thread' ? 'Hilo retirado por moderación' : 'Respuesta retirada por moderación'}</b>
        <span> · {deletion.reason}</span>
      </p>
      <p className={styles.lapidaBy}>
        — @{moderator?.username ?? 'moderación'} · {ago(deletion.deletedAt, now)}
      </p>
    </div>
  )
}

// ── body text: quotes → @names, links, YouTube ──────────────────────────────

const TOKEN = /(https?:\/\/[^\s<>"']+|>>[a-z0-9-]+)/gi

function Texto({ text, from, ctx }: { text: string; from: string; ctx: Ctx }) {
  const parts = text.split(TOKEN)
  return (
    <div className={styles.text}>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p ? <Fragment key={i}>{p}</Fragment> : null
        if (p.startsWith('>>')) {
          const id = p.slice(2).toLowerCase()
          if (!ctx.postIds.has(id)) return <span key={i} className={styles.deadQuote}>{p}</span>
          const label = ctx.labelFor(id)
          return (
            <span key={i} className={styles.q}>
              <button
                type="button"
                className={styles.quote}
                onPointerEnter={() => ctx.quoteHover(from, id)}
                onPointerLeave={() => ctx.quoteHover(from, null)}
                onFocus={() => ctx.quoteHover(from, id)}
                onBlur={() => ctx.quoteHover(from, null)}
                onClick={() => ctx.quoteClick(from, id)}
                aria-label={`Cita a ${label}: ir a su post`}
              >
                {label}
              </button>
              {ctx.isMine(id) ? (
                <span className={styles.tu} title="Te están citando">
                  tú
                </span>
              ) : null}
            </span>
          )
        }
        const m = /^(.*?)([.,;:!?)\]]+)$/.exec(p)
        const url = m ? m[1] : p
        const tail = m ? m[2] : ''
        const yt = youtubeId(url)
        return (
          <Fragment key={i}>
            {yt ? (
              <Tubo id={yt} url={url} />
            ) : (
              <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={styles.url}>
                {prettyUrl(url)}
              </a>
            )}
            {tail}
          </Fragment>
        )
      })}
    </div>
  )
}

function prettyUrl(url: string): string {
  const s = url.replace(/^https?:\/\/(www\.)?/, '')
  return s.length > 48 ? `${s.slice(0, 46)}…` : s
}

function youtubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

/** A YouTube link as a still until asked: no third-party frame before the click. */
function Tubo({ id, url }: { id: string; url: string }) {
  const [on, setOn] = useState(false)
  return (
    <span className={styles.tubo}>
      <span className={styles.tuboFrame}>
        {on ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title="Video de YouTube"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className={styles.tuboStill} onClick={() => setOn(true)} aria-label="Reproducir el video de YouTube aquí">
            <Image src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" fill sizes="440px" className={styles.tuboImg} />
            <span className={styles.tuboPlay}>
              <Mark name="play" size={14} />
              Reproducir
            </span>
          </button>
        )}
      </span>
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={styles.tuboLink}>
        youtube.com <Mark name="external" size={11} />
      </a>
    </span>
  )
}
