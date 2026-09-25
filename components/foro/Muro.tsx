'use client'

/**
 * MURO — the foro as a wall with exactly thirty places.
 *
 * Threads are not content items: no HL, no curation, never in the mosaic.
 * The only order is the bump. Slot 01 is whatever moved last; slot 30 is the
 * next to fall. A new thread (or a reply to one) pastes it at 01, everything
 * else shifts one place, and whatever was 30 falls off the wall as ash. The
 * empty places are drawn, so the cap is something you see, not something
 * you read about.
 *
 * Position means bump and nothing else. The Horizonte and the search are
 * light: threads outside the range (by their genres' stereotype energy — the
 * production predicate) or the search cool in place and keep their slot.
 *
 * The wall only moves while you can see it. A reply posted inside a thread
 * rearranges the world at once, but the wall holds its layout until the
 * thread folds back into its poster — then the poster flies to 01.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import type { ForoThread } from '@/lib/types'
import { useNow, useWorld, useWorldStore } from '@/lib/store/world'
import { useMe, useSessionReady } from '@/lib/store/session'
import { useHydrated } from '@/lib/useMedia'
import { useUI, type OriginRect } from '@/lib/store/ui'
import { useCampo, useIntegerRange } from '@/lib/store/campo'
import { canModerate } from '@/lib/permissions'
import { bandLabel } from '@/lib/vibe'
import { ago } from '@/lib/logic/time'
import { flare } from '@/components/stage/api'
import { Horizonte } from '@/components/horizonte/Horizonte'
import { Cabecera } from '@/components/librea/Cabecera'
import { LIBREA_SECCION } from '@/lib/librea'
import { Mark } from '@/components/kit/Glyph'
import { Cartel, Hueco } from './Cartel'
import { HiloForo } from './HiloForo'
import { NuevoHilo } from './NuevoHilo'
import { eVar, FORO_THREAD_CAP, inRange, matchesQuery, pad2, replyCounts, sameOrder, threadBand, wallOrder } from './foro'
import styles from './Muro.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(Flip)

interface Ghost {
  key: string
  id: string
  slot: number
  rect: { x: number; y: number; w: number; h: number }
}

const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

export function Muro() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname() ?? '/foro'
  // `thread` is production's name for the same parameter (old links, the Taller).
  const urlHilo = params.get('hilo') ?? params.get('thread')
  const urlNuevo = params.get('nuevo') === '1'

  // The UI answers at once; the URL follows (router.replace) and confirms.
  // An answer holds only until the address it was given under changes.
  const [hiloAnswer, setHiloAnswer] = useState<{ under: string | null; value: string | null } | null>(null)
  const [nuevoAnswer, setNuevoAnswer] = useState<{ under: boolean; value: boolean } | null>(null)
  const hiloId = hiloAnswer && hiloAnswer.under === urlHilo ? hiloAnswer.value : urlHilo
  const nuevo = nuevoAnswer && nuevoAnswer.under === urlNuevo ? nuevoAnswer.value : urlNuevo
  const setPendingHilo = useCallback((value: string | null) => setHiloAnswer({ under: urlHilo, value }), [urlHilo])
  const setPendingNuevo = useCallback((value: boolean) => setNuevoAnswer({ under: urlNuevo, value }), [urlNuevo])

  // Portals only after mount: a ?hilo= deep link must hydrate like the server.
  const mounted = useHydrated()

  const me = useMe()
  const sessionReady = useSessionReady()
  const store = useWorldStore()
  const hydrated = useWorld((s) => s.hydrated)
  const threads = useWorld((s) => s.world.threads)
  const replies = useWorld((s) => s.world.replies)
  const users = useWorld((s) => s.world.users)
  const now = useNow()
  const [lo, hi] = useIntegerRange()
  const openAccess = useUI((s) => s.openAccess)
  const notify = useUI((s) => s.notify)

  const [query, setQuery] = useState('')
  const [origin, setOrigin] = useState<OriginRect | null>(null)
  const [shown, setShown] = useState<string[] | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [retiredOpen, setRetiredOpen] = useState(false)

  const wallRef = useRef<HTMLDivElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const pending = useRef<{ entering: string[]; bumped: string | null } | null>(null)
  const pasteId = useRef<string | null>(null)
  const reduced = useRef(false)
  const entered = useRef(false)

  useLayoutEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const order = useMemo(() => wallOrder(threads), [threads])
  const counts = useMemo(() => replyCounts(replies), [replies])
  const display = shown ?? order
  const blocked = Boolean(hiloId) || nuevo
  const full = display.length >= FORO_THREAD_CAP

  // ── light: range and search (position never changes for these) ──────────
  const q = query.trim()
  const wholeRange = lo <= 0 && hi >= 10
  const inBand = useMemo(() => new Set(display.filter((id) => threads[id] && inRange(threads[id], lo, hi))), [display, threads, lo, hi])
  const passing = useMemo(() => new Set([...inBand].filter((id) => matchesQuery(threads[id], q))), [inBand, threads, q])
  const empty: 'vacio' | 'rango' | 'busqueda' | null = !display.length ? 'vacio' : !inBand.size ? 'rango' : !passing.size ? 'busqueda' : null


  const retired = useMemo(
    () =>
      Object.values(threads)
        .filter((t) => t.deletion)
        .sort((a, b) => Date.parse(b.deletion!.deletedAt) - Date.parse(a.deletion!.deletedAt)),
    [threads],
  )
  const isMod = canModerate(me)

  // ── URL: ?hilo=<id> opens a thread, ?nuevo=1 the composer (replace) ───────
  const replaceParams = useCallback(
    (mut: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(window.location.search)
      mut(sp)
      const s = sp.toString()
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  const openThread = useCallback(
    (id: string, r: DOMRect) => {
      setOrigin({ x: r.left, y: r.top, width: r.width, height: r.height })
      setPendingHilo(id)
      setPendingNuevo(false)
      replaceParams((sp) => {
        sp.set('hilo', id)
        sp.delete('thread')
        sp.delete('nuevo')
      })
    },
    [replaceParams, setPendingHilo, setPendingNuevo],
  )

  const closeThread = useCallback(() => {
    setPendingHilo(null)
    replaceParams((sp) => {
      sp.delete('hilo')
      sp.delete('thread')
    })
    setOrigin(null)
  }, [replaceParams, setPendingHilo])

  const openComposer = useCallback(() => {
    if (!me) {
      openAccess('Abre un hilo en el muro')
      return
    }
    setPendingNuevo(true)
    setPendingHilo(null)
    replaceParams((sp) => {
      sp.set('nuevo', '1')
      sp.delete('hilo')
    })
  }, [me, openAccess, replaceParams, setPendingHilo, setPendingNuevo])

  const closeComposer = useCallback(() => {
    setPendingNuevo(false)
    replaceParams((sp) => sp.delete('nuevo'))
  }, [replaceParams, setPendingNuevo])

  // The wall as last rendered (a publish dispatches before this re-renders).
  const orderRef = useRef(order)
  useEffect(() => {
    orderRef.current = order
  }, [order])

  const onPublished = useCallback(
    (id: string, energy: number) => {
      pasteId.current = id
      const before = orderRef.current
      const fell = before.length >= FORO_THREAD_CAP ? store.getState().world.threads[before[FORO_THREAD_CAP - 1]] : undefined
      closeComposer()
      notify(fell ? `Tu hilo entró en el 01. «${clip(fell.subject)}» cayó del muro.` : 'Tu hilo está en el muro, lugar 01.', { tone: 'energy', energy })
    },
    [closeComposer, notify, store],
  )

  // A deep link to the composer still needs an identity: drop the request
  // from the address (the composer never opened without one) and ask.
  useEffect(() => {
    if (!nuevo || !sessionReady || me) return
    replaceParams((sp) => sp.delete('nuevo'))
    openAccess('Abre un hilo en el muro')
  }, [nuevo, sessionReady, me, replaceParams, openAccess])

  // ── the wall catches up with the world, only while it's visible ──────────
  // FLIP: the old layout has to be measured in the DOM before the new order
  // renders, so this effect is where `shown` legitimately advances.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated) return
    if (shown === null) {
      setShown(order)
      return
    }
    if (blocked || sameOrder(shown, order)) return
    const wall = wallRef.current
    if (!wall || reduced.current) {
      setShown(order)
      return
    }
    const els = wall.querySelectorAll<HTMLElement>('[data-flip-id]')
    Flip.killFlipsOf(els, true)
    flipState.current = Flip.getState(els)
    const wr = wall.getBoundingClientRect()
    const falling: Ghost[] = []
    for (const id of shown) {
      if (order.includes(id)) continue
      const el = wall.querySelector<HTMLElement>(`[data-flip-id="${id}"]`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      falling.push({ key: `${id}:${Date.now()}`, id, slot: shown.indexOf(id) + 1, rect: { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height } })
    }
    pending.current = {
      entering: order.filter((id) => !shown.includes(id)),
      bumped: order[0] && order[0] !== shown[0] && shown.includes(order[0]) ? order[0] : null,
    }
    if (falling.length) setGhosts((g) => [...g, ...falling])
    setShown(order)
  }, [hydrated, order, blocked, shown])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Entrance (first sync) and every later reflow.
  useLayoutEffect(() => {
    const wall = wallRef.current
    if (!shown || !wall) return
    if (!entered.current) {
      entered.current = true
      if (reduced.current) return
      gsap.fromTo(
        wall.querySelectorAll('[data-slot]'),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.012, clearProps: 'opacity,transform' },
      )
      return
    }
    const state = flipState.current
    const p = pending.current
    flipState.current = null
    pending.current = null
    if (!state || !p) return
    const paste = pasteId.current
    pasteId.current = null
    const els = [...wall.querySelectorAll<HTMLElement>('[data-flip-id]')]

    // Mark what moved to 01 (or arrived) once it has landed: a flat outline, briefly.
    const landed = [p.bumped, ...p.entering].filter((x): x is string => Boolean(x))
    const bumpedEl = p.bumped ? wall.querySelector<HTMLElement>(`[data-flip-id="${p.bumped}"]`) : null
    if (bumpedEl) bumpedEl.style.zIndex = '6'

    Flip.from(state, {
      targets: els,
      duration: 0.7,
      ease: 'power3.inOut',
      stagger: 0.008,
      onEnter: (entering) =>
        gsap.fromTo(entering, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, delay: 0.25, ease: 'expo.out', clearProps: 'opacity,transform' }),
      onComplete: () => {
        if (bumpedEl) bumpedEl.style.zIndex = ''
        for (const id of landed) {
          const el = wall.querySelector<HTMLElement>(`[data-flip-id="${id}"]`)
          if (!el) continue
          el.dataset.landed = ''
          window.setTimeout(() => delete el.dataset.landed, 1500)
          // A new thread is an act of publishing: the field answers once.
          const th = threads[id]
          if (id === paste && th) flare(el, threadBand(th.genres).mid)
        }
      },
    })

    // Follow the poster to 01 if the top of the wall is out of view.
    if (p.bumped || (shown[0] && p.entering.includes(shown[0]))) {
      const top = wall.getBoundingClientRect().top
      if (top < 90 || top > window.innerHeight * 0.55) window.scrollTo({ top: Math.max(0, window.scrollY + top - 190), behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  const resetRange = () => {
    const s = useCampo.getState()
    const from = { lo: s.range[0], hi: s.range[1] }
    gsap.to(from, {
      lo: 0,
      hi: 10,
      duration: 0.6,
      ease: 'expo.out',
      onUpdate: () => useCampo.getState().setRange([from.lo, from.hi]),
      onComplete: () => useCampo.getState().setRange([0, 10]),
    })
  }

  const liveSlot = hiloId ? order.indexOf(hiloId) : -1
  const filterNote = !wholeRange || q ? ` · ${pad2(passing.size)} ${q ? `con «${q}»` : `en ${bandLabel(lo, hi)}`}` : ''

  return (
    <div className={styles.muro}>
      <Cabecera
        librea={LIBREA_SECCION.foro}
        lema={`Un muro de treinta hilos: el nuevo empuja al último, y responder sube un hilo al primer lugar${filterNote}.`}
        datos={[
          { k: 'lugares ocupados', v: `${pad2(display.length)}/${FORO_THREAD_CAP}` },
          { k: 'orden', v: 'BUMP' },
        ]}
      >
        <p className="sr-only" aria-live="polite">
          {display.length} de {FORO_THREAD_CAP} lugares ocupados · orden por bump{filterNote}
        </p>
          <div className={styles.tools}>
            <label className={styles.search}>
              <Mark name="search" size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) setQuery('')
                }}
                placeholder="Buscar por asunto, género o tag"
                aria-label="Buscar en el foro por asunto, género o tag"
                spellCheck={false}
              />
              {query ? (
                <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                  <Mark name="close" size={11} />
                </button>
              ) : null}
            </label>
            <button type="button" className={styles.create} onClick={openComposer}>
              <Mark name="plus" size={13} />
              Abrir hilo
            </button>
          </div>
      </Cabecera>
      <Horizonte showFormats={false} showGenres={false} />

      <div className={styles.frame}>

        <Gauge display={display} threads={threads} passing={passing} />

        {isMod && retired.length ? (
          <section className={styles.retired}>
            <button type="button" className={styles.retiredToggle} onClick={() => setRetiredOpen((o) => !o)} aria-expanded={retiredOpen}>
              <span className="label">Moderación</span>
              <span>
                {retired.length} {retired.length === 1 ? 'hilo retirado' : 'hilos retirados'} del muro
              </span>
              <Mark name={retiredOpen ? 'minus' : 'plus'} size={12} />
            </button>
            {retiredOpen ? (
              <ul className={styles.retiredList}>
                {retired.map((t) => (
                  <li key={t.id}>
                    <span className={styles.retiredSubject}>{t.subject}</span>
                    <span className={styles.retiredWhy}>
                      {t.deletion!.reason} · @{users[t.deletion!.moderatorId]?.username ?? 'moderación'} · {ago(t.deletion!.deletedAt, now)}
                    </span>
                    <button type="button" className={styles.retiredOpen} onClick={(e) => openThread(t.id, e.currentTarget.getBoundingClientRect())}>
                      Abrir para restaurar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <div className={styles.wallWrap}>
          <div ref={wallRef} className={styles.wall} data-ready={shown ? '' : undefined} aria-label="Muro de hilos, del más reciente al próximo en caer">
            {Array.from({ length: FORO_THREAD_CAP }, (_, i) => {
              const id = display[i]
              const th: ForoThread | undefined = id ? threads[id] : undefined
              if (th) {
                return (
                  <div key={th.id} className={styles.slot} data-slot="" data-flip-id={th.id}>
                    <Cartel
                      thread={th}
                      slot={i + 1}
                      replies={counts[th.id] ?? 0}
                      now={now}
                      author={users[th.authorId]?.username}
                      cool={!passing.has(th.id)}
                      mine={Boolean(me && me.id === th.authorId)}
                      edge={full && i === FORO_THREAD_CAP - 1}
                      priority={i < 6}
                      onOpen={openThread}
                    />
                  </div>
                )
              }
              return (
                <div key={`hueco-${i}`} className={styles.slot} data-slot="">
                  <Hueco slot={i + 1} first={i === display.length} onOpen={openComposer} />
                </div>
              )
            })}
          </div>

          <div className={styles.ghosts} aria-hidden="true">
            {ghosts.map((g) =>
              threads[g.id] ? (
                <Ceniza key={g.key} ghost={g} thread={threads[g.id]} replies={counts[g.id] ?? 0} now={now} onDone={() => setGhosts((cur) => cur.filter((x) => x.key !== g.key))} />
              ) : null,
            )}
          </div>

          {empty && shown ? (
            <div className={styles.emptyWrap}>
              <div className={styles.empty} role="status">
                {empty === 'vacio' ? (
                  <>
                    <p className={styles.emptyTitle}>Foro vacío.</p>
                    <p className={styles.emptyText}>Nadie ha abierto un hilo todavía. El primero entra en el lugar 01.</p>
                    <button type="button" className={styles.create} onClick={openComposer}>
                      <Mark name="plus" size={13} />
                      Abrir hilo
                    </button>
                  </>
                ) : empty === 'rango' ? (
                  <>
                    <p className={styles.emptyTitle}>Sin hilos en este rango de energía.</p>
                    <p className={styles.emptyText}>Los carteles apagados viven en otra temperatura. Mueve el horizonte.</p>
                    <button type="button" className={styles.boxed} onClick={resetRange}>
                      Todo el espectro
                    </button>
                  </>
                ) : (
                  <>
                    <p className={styles.emptyTitle}>Sin resultados para «{q}».</p>
                    <p className={styles.emptyText}>Busca por asunto, género o tag{wholeRange ? '.' : ', o suelta el rango de energía.'}</p>
                    <button type="button" className={styles.boxed} onClick={() => setQuery('')}>
                      Limpiar búsqueda
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <p className={styles.rule}>
          Treinta lugares, ordenados por el último movimiento. Un hilo nuevo —o una respuesta— lo pega en el 01; lo que queda en el 31 cae del
          muro. Sin likes, sin algoritmo: conversación y tiempo.
        </p>
      </div>

      {mounted && hiloId ? <HiloForo key={hiloId} id={hiloId} origin={origin} slot={liveSlot >= 0 ? liveSlot + 1 : null} onClose={closeThread} /> : null}
      <NuevoHilo open={mounted && nuevo && Boolean(me)} wall={order} onClose={closeComposer} onPublished={onPublished} />
    </div>
  )
}

/** Thirty segments: the wall in one line, lit in each thread's energy. */
function Gauge({ display, threads, passing }: { display: string[]; threads: Record<string, ForoThread>; passing: Set<string> }) {
  return (
    <div className={styles.gaugeWrap} aria-hidden="true">
      <div className={styles.gauge}>
        {Array.from({ length: FORO_THREAD_CAP }, (_, i) => {
          const th = display[i] ? threads[display[i]] : undefined
          if (!th) return <span key={i} className={styles.seg} />
          return (
            <span
              key={i}
              className={styles.seg}
              data-on=""
              data-cool={!passing.has(th.id) || undefined}
              style={{ ['--c' as string]: eVar(threadBand(th.genres).mid) }}
              title={`${pad2(i + 1)} · ${th.subject}`}
            />
          )
        })}
      </div>
      <div className={styles.gaugeScale}>
        <span>01 · último movimiento</span>
        <span>30 · el próximo en caer</span>
      </div>
    </div>
  )
}

/** A poster that fell off the wall: it goes grey, drops and is gone. */
function Ceniza({ ghost, thread, replies, now, onDone }: { ghost: Ghost; thread: ForoThread; replies: number; now: Date; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tl = gsap
      .timeline({ onComplete: () => done.current() })
      .to(el, { filter: 'grayscale(1)', opacity: 0.7, duration: 0.3, ease: 'power1.out' })
      .to(el, { y: Math.min(48, ghost.rect.h * 0.16), opacity: 0, duration: 0.7, ease: 'power2.in' })
    return () => {
      tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={ref} className={styles.ghost} style={{ left: ghost.rect.x, top: ghost.rect.y, width: ghost.rect.w, height: ghost.rect.h }}>
      <Cartel thread={thread} slot={ghost.slot} replies={replies} now={now} still />
    </div>
  )
}
