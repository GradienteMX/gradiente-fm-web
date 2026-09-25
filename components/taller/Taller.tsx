'use client'

/**
 * EL TALLER — the creator's desk.
 *
 *   ESPINA      who you are here (public), and what only you see (presence,
 *               your vibe)
 *   ESPACIOS    PANEL · PUBLICAR · RECEPCIÓN · CREDENCIAL · FRANJA · MERCADO,
 *               as a real tablist bound to `?espacio=`; a space you have no
 *               grant for is absent, never disabled
 *   COSECHA     one sheet for the harvest, opened from any of your pieces
 *
 * Composing lives next door, in the Mesa (`/taller/mesa`). Every write here
 * is a world action with its own timestamp.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import gsap from 'gsap'
import { barrido } from '@/components/trama/api'
import { Revelado } from '@/components/trama/Revelado'
import type { User } from '@/lib/types'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { useNow, useWorld } from '@/lib/store/world'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { Spine } from './Spine'
import { PanelSpace } from './Panel'
import { PublicarSpace } from './Publicar'
import { RecepcionSpace } from './Recepcion'
import { FranjaSpace } from './Franja'
import { MercadoSpace, waitingThreads } from './Mercado'
import { CredencialSpace } from './CredencialSpace'
import { Cosecha } from './Cosecha'
import { buildActivity, isUnread } from './Actividad'
import { resolveSpace, SPACE_LABEL, SPACE_PARAMS, spacesFor, useMyDrafts, useMyPieces, useTallerParams, useTallerReady, type SpaceId } from './logic'
import styles from './Taller.module.css'

export function Taller({ flyers }: { flyers: string[] }) {
  const ready = useTallerReady()
  const me = useMe()
  if (!ready)
    return (
      <div className={styles.waiting} aria-busy="true" aria-label="Abriendo el taller">
        <span className={styles.waitLine} />
      </div>
    )
  if (!me) return <Umbral />
  return <Escritorio key={me.id} me={me} flyers={flyers} />
}

// ── the gate ────────────────────────────────────────────────────────────────

function Umbral() {
  const openAccess = useUI((s) => s.openAccess)
  return (
    <section className={styles.umbral} aria-labelledby="umbral-title">
      <span className={styles.umbralMark} aria-hidden="true">
        <Mark name="seed" size={22} />
      </span>
      <p className="label" style={{ color: 'var(--ink-3)' }}>
        Taller
      </p>
      <Revelado as="h1" id="umbral-title" className={styles.umbralTitle} trigger="load">
        El Taller es tu mesa de trabajo.
      </Revelado>
      <p className={styles.umbralText}>Entra para usarlo.</p>
      <div>
        <Button variant="ink" size="lg" onClick={() => openAccess('Abre tu Taller')}>
          Entrar
        </Button>
      </div>
      <p className={styles.umbralNote}>Aquí escribes, guardas lo que te importa y lees cómo se recibió tu trabajo. Lo que ves en tu Taller no lo ve nadie más.</p>
    </section>
  )
}

// ── the desk ────────────────────────────────────────────────────────────────

function Escritorio({ me, flyers }: { me: User; flyers: string[] }) {
  const now = useNow()
  const { params, set } = useTallerParams()
  const pieces = useMyPieces(me.id)
  const drafts = useMyDrafts(me.id)
  const franja = useWorld((s) => (me.franjaId ? s.world.items[me.franjaId] ?? null : null))
  const world = useWorld((s) => s.world)
  const spacesKey = spacesFor(me, pieces.length + drafts.length > 0)
    .filter((s) => (s === 'franja' || s === 'mercado' ? Boolean(franja) : true))
    .join(',')
  const spaces = useMemo(() => spacesKey.split(',') as SpaceId[], [spacesKey])
  const active = resolveSpace(params.get('espacio'), spaces)

  const unread = useMemo(() => {
    const seen = world.activitySeen[me.id] ?? ''
    const seedIso = new Date(world.seedNow).toISOString()
    return buildActivity(world, me).filter((r) => isUnread(r, seen, seedIso)).length
  }, [world, me])
  const waiting = useMemo(() => (franja ? waitingThreads(world.listingComments, franja.id).length : 0), [world.listingComments, franja])

  const go = useCallback(
    (id: SpaceId, extra?: Record<string, string | null>) => {
      const patch: Record<string, string | null> = { espacio: id === 'panel' ? null : id }
      for (const k of SPACE_PARAMS) patch[k] = null
      Object.assign(patch, extra)
      set(patch, 'push')
    },
    [set],
  )

  const render = (s: SpaceId): ReactNode => {
    switch (s) {
      case 'publicar':
        return <PublicarSpace me={me} now={now} pieces={pieces} drafts={drafts} />
      case 'recepcion':
        return <RecepcionSpace me={me} now={now} pieces={pieces} />
      case 'credencial':
        return <CredencialSpace me={me} now={now} />
      case 'franja':
        return franja ? <FranjaSpace me={me} now={now} franja={franja} /> : null
      case 'mercado':
        return franja ? <MercadoSpace me={me} now={now} franja={franja} flyers={flyers} /> : null
      default:
        return (
          <PanelSpace
            me={me}
            now={now}
            pieces={pieces}
            drafts={drafts}
            onPublicar={() => go('publicar')}
            onOfertas={(listingId) => go('mercado', { vista: 'ofertas', pieza: listingId ?? null })}
          />
        )
    }
  }

  return (
    <div className={styles.taller}>
      <Spine me={me} />
      <Espacios spaces={spaces} active={active} onSelect={(id) => go(id)} franjaName={franja?.title ?? null} ofertas={waiting} unread={unread} />
      <Escena active={active} render={render} />
      <Cosecha me={me} />
    </div>
  )
}

// ── tabs ────────────────────────────────────────────────────────────────────

function Espacios({
  spaces,
  active,
  onSelect,
  franjaName,
  ofertas,
  unread,
}: {
  spaces: SpaceId[]
  active: SpaceId
  onSelect: (id: SpaceId) => void
  franjaName: string | null
  ofertas: number
  unread: number
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const tabs = useRef<Partial<Record<SpaceId, HTMLButtonElement | null>>>({})
  const placed = useRef(false)

  // The lit band under the active tab slides to its next home — the tab row
  // keeps its identity across spaces instead of blinking.
  const place = useCallback(
    (animate: boolean) => {
      const tab = tabs.current[active]
      const bar = barRef.current
      const label = tab?.querySelector<HTMLElement>('[data-tab-label]')
      if (!tab || !bar || !label) return
      const x = tab.offsetLeft + label.offsetLeft
      const w = label.offsetWidth
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!animate || reduced) gsap.set(bar, { x, width: w, opacity: 1 })
      else gsap.to(bar, { x, width: w, opacity: 1, duration: 0.45, ease: 'expo.out', overwrite: true })
      // On a phone the strip scrolls sideways: keep the active tab in it.
      const list = listRef.current
      if (list && (tab.offsetLeft < list.scrollLeft || tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth)) {
        list.scrollTo({ left: Math.max(0, tab.offsetLeft - 16), behavior: animate && !reduced ? 'smooth' : 'auto' })
      }
    },
    [active],
  )

  useLayoutEffect(() => {
    place(placed.current)
    placed.current = true
  }, [place, spaces.length])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(el)
    // Fonts arriving late change label widths.
    void document.fonts?.ready.then(() => place(false))
    return () => ro.disconnect()
  }, [place])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = spaces.length
    let j = -1
    if (e.key === 'ArrowRight') j = (i + 1) % n
    else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = n - 1
    if (j < 0) return
    e.preventDefault()
    tabs.current[spaces[j]]?.focus()
    onSelect(spaces[j])
  }

  return (
    <div className={styles.tabsRow}>
      <div className={styles.tablist} role="tablist" aria-label="Espacios del Taller" ref={listRef}>
        {spaces.map((s, i) => {
          const on = s === active
          return (
            <button
              key={s}
              ref={(el) => {
                tabs.current[s] = el
              }}
              type="button"
              role="tab"
              id={`taller-tab-${s}`}
              aria-selected={on}
              aria-controls="taller-espacio"
              tabIndex={on ? 0 : -1}
              className={styles.tab}
              data-on={on || undefined}
              onClick={() => onSelect(s)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span data-tab-label="">{SPACE_LABEL[s]}</span>
              {s === 'panel' && unread > 0 ? (
                <span className={styles.tabCount} aria-label={`${unread} ${unread === 1 ? 'novedad' : 'novedades'} en actividad`}>
                  {unread}
                </span>
              ) : null}
              {s === 'franja' && franjaName ? <span className={styles.tabNote}>{franjaName}</span> : null}
              {s === 'mercado' && ofertas > 0 ? <span className={styles.tabDot} aria-label={`${ofertas} ${ofertas === 1 ? 'conversación espera' : 'conversaciones esperan'} respuesta`} /> : null}
            </button>
          )
        })}
        <span ref={barRef} className={styles.tabBar} aria-hidden="true" />
      </div>
    </div>
  )
}

// ── the stage between spaces ────────────────────────────────────────────────

/**
 * Changing space is a one-step swap — the sheet is replaced, not slid — and
 * the shared TRAMA engine passes a band of ink over what is on screen: the
 * grid retuning. Nothing of our own is animated here.
 */
function Escena({ active, render }: { active: SpaceId; render: (s: SpaceId) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    barrido(ref.current, { dir: 'down' })
  }, [active])

  return (
    <div ref={ref} id="taller-espacio" role="tabpanel" aria-labelledby={`taller-tab-${active}`} tabIndex={0} className={styles.escena}>
      {render(active)}
    </div>
  )
}
