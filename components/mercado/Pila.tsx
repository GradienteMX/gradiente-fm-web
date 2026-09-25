'use client'

/**
 * PILA — the market's stack of panels: a Tienda, and a Pieza on top of it.
 *
 * Two hosts drive the same stack:
 *   · URL (`/mercado`, `/f/[slug]`): `?franja=<slug>` opens the Tienda and
 *     `&pieza=<id>` the listing over it — shareable, Back-button friendly.
 *   · local (inside an Estación): state only, so it never fights the
 *     Lectura's `?item=`; the listing's "copy link" still hands out the
 *     canonical /mercado URL.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { create } from 'zustand'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import type { OriginRect } from '@/lib/store/ui'
import { useUI } from '@/lib/store/ui'
import { useWorld } from '@/lib/store/world'
import { useFranjaBySlug } from '@/components/franja/useFranja'
import { Button } from '@/components/kit/Button'
import { Panel, PanelBody } from './Panel'
import { Tienda } from './Tienda'
import { PiezaMercado } from './PiezaMercado'
import { listingsOf } from './datos'
import styles from './Pila.module.css'

export interface PilaState {
  tienda: boolean
  pieza: string | null
}

interface PilaProps {
  franja: ContentItem
  state: PilaState
  origin: OriginRect | null
  leaving: boolean
  /** Where "back" from the Pieza lands when no Tienda is under it. */
  baseLabel: string
  onState: (next: PilaState, origin?: OriginRect | null) => void
  onCloseAll: () => void
  onOpenEstacion: () => void
  onOpenItem: (slug: string) => void
  /** The stack sits over another reading (an Estación). */
  stacked?: boolean
}

export function Pila({ franja, state, origin, leaving, baseLabel, onState, onCloseAll, onOpenEstacion, onOpenItem, stacked }: PilaProps) {
  const listings = useMemo(() => listingsOf(franja), [franja])
  const listing = state.pieza ? listings.find((l) => l.id === state.pieza) ?? null : null
  const index = listing ? listings.indexOf(listing) + 1 : 0
  const openPieza = (l: MarketplaceListing, o: OriginRect | null) => onState({ tienda: state.tienda, pieza: l.id }, o)
  const back = () => onState({ tienda: state.tienda, pieza: null })

  return (
    <>
      {state.tienda ? (
        <Tienda
          key={`t:${franja.id}`}
          franja={franja}
          onClose={() => onState({ tienda: false, pieza: null })}
          onOpenPieza={openPieza}
          onOpenEstacion={onOpenEstacion}
          origin={state.pieza ? null : origin}
          leaving={leaving}
          stacked={stacked}
        />
      ) : null}
      {state.pieza ? (
        listing ? (
          <PiezaMercado
            key={`p:${listing.id}`}
            franja={franja}
            listing={listing}
            index={index}
            total={listings.length}
            onBack={back}
            backLabel={state.tienda ? 'Volver a la tienda' : baseLabel}
            onCloseAll={onCloseAll}
            onOpenEstacion={onOpenEstacion}
            onOpenItem={onOpenItem}
            origin={origin}
            leaving={leaving}
          />
        ) : (
          <Ausente
            title="Esta pieza ya no está en la tienda."
            body={`Pudo venderse y retirarse, o cambiar de lugar. La tienda de ${franja.title} sigue abierta.`}
            action="Ver la tienda"
            onAction={() => onState({ tienda: true, pieza: null })}
            onClose={back}
          />
        )
      ) : null}
    </>
  )
}

/** An honest dead end: what isn't here, and the nearest thing that is. */
export function Ausente({ title, body, action, onAction, onClose }: { title: string; body: string; action?: string; onAction?: () => void; onClose: () => void }) {
  return (
    <Panel label={title} onClose={onClose} z={72} width={460} stacked compact>
      <PanelBody>
        <div className={styles.ausente}>
          <p className={styles.ausenteTitle}>{title}</p>
          <p className={styles.ausenteBody}>{body}</p>
          <div className={styles.ausenteActions}>
            {action && onAction ? (
              <Button variant="ink" onClick={onAction}>
                {action}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </PanelBody>
    </Panel>
  )
}

// ── URL host ────────────────────────────────────────────────────────────────

/** The rect a URL-driven panel should unfold from (set right before navigating). */
const useOrigin = create<{ origin: OriginRect | null; set: (o: OriginRect | null) => void }>((set) => ({
  origin: null,
  set: (origin) => set({ origin }),
}))

function writeUrl(pathname: string, next: { franja: string | null; pieza: string | null }, mode: 'push' | 'replace') {
  const q = new URLSearchParams(window.location.search)
  if (next.franja) q.set('franja', next.franja)
  else q.delete('franja')
  if (next.pieza) q.set('pieza', next.pieza)
  else q.delete('pieza')
  const s = q.toString()
  const url = s ? `${pathname}?${s}` : pathname
  if (mode === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

/** Open the market from anywhere on a URL-hosted page. */
export function useMercadoNav() {
  const pathname = usePathname() ?? '/'
  const setOrigin = useOrigin((s) => s.set)
  const openTienda = useCallback(
    (slug: string, origin: OriginRect | null = null) => {
      setOrigin(origin)
      writeUrl(pathname, { franja: slug, pieza: null }, 'push')
    },
    [pathname, setOrigin],
  )
  const openPieza = useCallback(
    (slug: string, id: string, origin: OriginRect | null = null) => {
      setOrigin(origin)
      writeUrl(pathname, { franja: slug, pieza: id }, 'push')
    },
    [pathname, setOrigin],
  )
  return { openTienda, openPieza }
}

export function MercadoUrlHost() {
  const params = useSearchParams()
  const pathname = usePathname() ?? '/'
  const slug = params.get('franja')
  const pieza = params.get('pieza')
  const franja = useFranjaBySlug(slug)
  const hydrated = useWorld((s) => s.hydrated)
  const origin = useOrigin((s) => s.origin)
  const setOrigin = useOrigin((s) => s.set)
  const openLectura = useUI((s) => s.openLectura)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const clear = useCallback(() => {
    setOrigin(null)
    writeUrl(pathname, { franja: null, pieza: null }, 'replace')
  }, [pathname, setOrigin])

  const closeAll = useCallback(() => {
    setLeaving(true)
    timer.current = window.setTimeout(() => {
      clear()
      setLeaving(false)
    }, 280)
  }, [clear])

  if (!slug) return null
  if (!franja || !franja.marketplaceEnabled) {
    if (!hydrated) return null
    return (
      <Ausente
        title={franja ? `${franja.title} no tiene tienda abierta.` : 'Esta tienda no está en el mercado.'}
        body={franja ? 'Su estación sigue en el dial: ahí está su catálogo.' : 'Pudo cerrar o cambiar de nombre. El resto del mercado sigue abierto.'}
        action={franja ? 'Abrir su estación' : undefined}
        onAction={
          franja
            ? () => {
                clear()
                openLectura(franja.slug)
              }
            : undefined
        }
        onClose={clear}
      />
    )
  }

  return (
    <Pila
      franja={franja}
      state={{ tienda: true, pieza }}
      origin={origin}
      leaving={leaving}
      baseLabel="Volver a la tienda"
      onState={(next, o) => {
        if (!next.tienda) return clear()
        setOrigin(o ?? null)
        if (next.pieza && next.pieza !== pieza) writeUrl(pathname, { franja: franja.slug, pieza: next.pieza }, 'push')
        else writeUrl(pathname, { franja: franja.slug, pieza: next.pieza }, 'replace')
      }}
      onCloseAll={closeAll}
      onOpenEstacion={() => {
        clear()
        openLectura(franja.slug)
      }}
      onOpenItem={(s) => {
        clear()
        openLectura(s)
      }}
    />
  )
}

// ── local host (Estación) ───────────────────────────────────────────────────

export function useLocalPila() {
  const [state, setState] = useState<PilaState>({ tienda: false, pieza: null })
  const [origin, setOrigin] = useState<OriginRect | null>(null)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])
  const onState = useCallback((next: PilaState, o?: OriginRect | null) => {
    setOrigin(o ?? null)
    setState(next)
  }, [])
  const closeAll = useCallback(() => {
    setLeaving(true)
    timer.current = window.setTimeout(() => {
      setState({ tienda: false, pieza: null })
      setLeaving(false)
    }, 280)
  }, [])
  return { state, origin, leaving, onState, closeAll }
}
