'use client'

/**
 * CREDENCIAL — the Taller space where stickers go on your card.
 *
 *   MESA     your credencial, large, on the cutting mat. Pick a copy from
 *            the binder and it follows the pointer on the case (the card
 *            owns moving, turning, sizing, flipping and its keys — see
 *            components/credencial/editor.ts). Choosing a spot freezes it
 *            there while you confirm: pressing is a hold, because it's
 *            permanent.
 *   DETALLE  the copy being placed, or the applied sticker you picked: how
 *            long it has been on, and the scraper — pass by pass; the last
 *            pass says it's gone for good.
 *   CARPETA  your copies that aren't on the case.
 *   PARED    what's on the case, front and back, oldest first, with dates.
 *
 * Everything here is yours alone: the counts are your own, never public.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { User } from '@/lib/types'
import { SCRAPE_STEP, type CardFace, type StickerCopy, type StickerDef, type StickerPlacement } from '@/lib/stickers/types'
import { copySeed } from '@/lib/stickers/finish'
import { binderOf, placementsOf, type World } from '@/lib/store/world-core'
import { nowIso, useDispatch, useItems, useWorld } from '@/lib/store/world'
import { useRank } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { LIBREA_SECCION } from '@/lib/librea'
import { useReducedMotion } from '@/lib/useMedia'
import { patronStyle } from '@/components/librea/patron'
import { flare } from '@/components/stage/api'
import { Credencial, type CredencialHandle } from '@/components/credencial/Credencial'
import type { CredencialEditor } from '@/components/credencial/editor'
import { CARD_FRAC } from '@/components/credencial/geometry'
import { bandOfPieces, credencialForUser, joinOrder, pinsFrom, trophyStates } from '@/components/credencial/data'
import { Button } from '@/components/kit/Button'
import { HoldButton } from '@/components/kit/HoldButton'
import { Mark } from '@/components/kit/Glyph'
import { Calco } from '@/components/stickers/Calco'
import { Carpeta, comoLlego } from '@/components/stickers/Carpeta'
import { COPIA_UNICA, edad, esUnica, fechaCorta, FORM_LABEL, lineaCopia, notaAcabado } from '@/components/stickers/labels'
import { Panel } from './kit'
import styles from './CredencialSpace.module.css'

type Spot = { face: CardFace; x: number; y: number; rot: number; scale: number }

const TALLER = LIBREA_SECCION.taller
const FACES: CardFace[] = ['frente', 'dorso']
const PASSES = Math.round(1 / SCRAPE_STEP)

const deg = (rad: number) => Math.round((rad * 180) / Math.PI)
const pad2 = (n: number) => String(n).padStart(2, '0')

/** The card the owner carries, built the way /u/ builds it. */
function useMiCredencial(me: User) {
  const rank = useRank(me.id)
  const items = useItems()
  const users = useWorld((s) => s.world.users)
  const earned = useWorld((s) => s.world.trophies[me.id])
  const team = useWorld((s) => (me.franjaId ? (s.world.items[me.franjaId]?.title ?? null) : null))
  const pieces = useMemo(() => items.filter((i) => i.createdById === me.id && i.type !== 'franja'), [items, me.id])
  const band = useMemo(() => bandOfPieces(pieces), [pieces])
  const trophies = useMemo(() => trophyStates(earned), [earned])
  const folio = useMemo(() => joinOrder(users).indexOf(me.id) + 1, [users, me.id])
  return useMemo(() => credencialForUser({ user: me, rank, folio, team, pins: pinsFrom(trophies), band }), [me, rank, folio, team, trophies, band])
}

export function CredencialSpace({ me, now }: { me: User; now: Date }) {
  const dispatch = useDispatch()
  const notify = useUI((s) => s.notify)
  const reduced = useReducedMotion()
  const world = useWorld((s) => s.world)
  const data = useMiCredencial(me)
  const cardRef = useRef<CredencialHandle>(null)
  const mesaRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)

  const [placing, setPlacing] = useState<{ uid: string; stickerId: string } | null>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // What the world still holds decides what's live: a copy pressed or gone
  // elsewhere lets go, a sticker scraped off is no longer selectable.
  const live = placing && world.binder[placing.uid] && !world.placements[placing.uid] ? placing : null
  const pick = selected && world.placements[selected] ? selected : null
  const liveSpot = live ? spot : null

  const copies = useMemo(() => binderOf(world, me.id), [world, me.id])
  const onCase = useMemo(() => placementsOf(world, me.id), [world, me.id])

  const editor = useMemo<CredencialEditor>(
    () => ({
      placing: live,
      selected: pick,
      onPlace: (p) => setSpot(p),
      onCancel: () => {
        setPlacing(null)
        setSpot(null)
      },
      onPick: (uid) => setSelected(uid),
    }),
    [live, pick],
  )

  // A spot chosen: the hold is the next thing to reach for.
  useEffect(() => {
    if (liveSpot) confirmRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [liveSpot])

  const cancel = () => {
    setPlacing(null)
    setSpot(null)
  }

  /** Back to moving it: the card takes the keys again. */
  const mover = () => {
    setSpot(null)
    cardRef.current?.el?.querySelector('button')?.focus({ preventScroll: true })
  }

  const lift = (c: StickerCopy) => {
    if (live?.uid === c.uid) return cancel()
    setSelected(null)
    setSpot(null)
    setPlacing({ uid: c.uid, stickerId: c.stickerId })
    // on a phone the binder sits below the card: bring the card back
    const el = mesaRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.bottom < 120 || r.top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    }
  }

  const pegar = () => {
    if (!live || !liveSpot) return
    const def = world.stickers[live.stickerId]
    dispatch({
      t: 'sticker-apply',
      userId: me.id,
      uid: live.uid,
      face: liveSpot.face,
      x: liveSpot.x,
      y: liveSpot.y,
      rot: liveSpot.rot,
      scale: liveSpot.scale,
      at: nowIso(),
    })
    const el = cardRef.current?.el
    if (el) {
      const r = el.getBoundingClientRect()
      flare({ x: r.left + r.width * (0.5 + (liveSpot.x - 0.5) * CARD_FRAC), y: r.top + r.height * (0.5 + (liveSpot.y - 0.5) * CARD_FRAC) }, def?.energy ?? 5)
    }
    notify(`Pegado en el ${liveSpot.face}. Desde hoy envejece con tu estuche.`, { tone: 'energy', energy: def?.energy })
    setPlacing(null)
    setSpot(null)
  }

  const raspar = (pl: StickerPlacement) => {
    const last = pl.wear + SCRAPE_STEP >= 1 - 1e-6
    dispatch({ t: 'sticker-scrape', userId: me.id, uid: pl.uid, amount: SCRAPE_STEP, wear: Math.min(1, pl.wear + SCRAPE_STEP), at: nowIso() })
    if (last) {
      setSelected(null)
      notify('Raspado del todo: se fue para siempre.')
    }
  }

  const choose = (uid: string) => {
    cancel()
    setSelected(pick === uid ? null : uid)
  }

  const liveDef = live ? (world.stickers[live.stickerId] ?? null) : null
  const hint = live
    ? liveSpot
      ? 'Elegido. Confírmalo abajo — o toca la mesa para moverlo.'
      : 'Clic o Enter: aquí · Q / E o rueda: girar · + / −: tamaño · F: la otra cara · Esc: cancelar'
    : copies.length
      ? 'Elige un calco de tu carpeta · toca uno pegado para verlo · arrastra para girarla · toca para voltearla'
      : 'Toca un calco pegado para verlo · arrastra para girarla · toca para voltearla'

  return (
    <div className={styles.espacio}>
      <Cabeza onCase={onCase.length} inBinder={copies.length} />

      <div className={styles.grid}>
        <div className={styles.colMesa}>
          <div ref={mesaRef} className={styles.mesa} data-placing={live ? '' : undefined}>
            <span className={styles.mat} style={patronStyle('tapete', TALLER.on) as CSSProperties} aria-hidden="true" />
            <span className={styles.window} aria-hidden="true" />
            <Credencial ref={cardRef} data={data} userId={me.id} editor={editor} hint={hint} hintBack={hint} />
            {liveSpot ? <button type="button" className={styles.freeze} onClick={mover} aria-label="Elegir otro lugar para el calco" /> : null}
          </div>

          {live && liveDef ? (
            liveSpot ? (
              <div
                ref={confirmRef}
                className={styles.confirma}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    mover()
                  }
                }}
              >
                <p className={styles.confirmaText}>
                  <b>{liveDef.name}</b>
                  <span>
                    En el {liveSpot.face} · {deg(liveSpot.rot)}° · ×{liveSpot.scale.toFixed(2)}
                  </span>
                </p>
                <HoldButton onConfirm={pegar} energy={liveDef.energy} holdingLabel="Presionando…" full>
                  Mantén para pegar — es permanente
                </HoldButton>
                <div className={styles.confirmaActions}>
                  <Button variant="ghost" size="sm" onClick={mover} icon={<Mark name="arrow" size={12} />}>
                    Moverlo
                  </Button>
                  <Button variant="quiet" size="sm" onClick={cancel}>
                    Devolverlo a la carpeta
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.colocando}>
                <span className={styles.colocandoCode}>Colocando</span>
                <span className={styles.colocandoName}>{liveDef.name}</span>
                <Button variant="quiet" size="sm" onClick={cancel}>
                  Cancelar
                </Button>
              </div>
            )
          ) : null}

          <Pared placements={onCase} world={world} now={now} selected={pick} onChoose={choose} />
        </div>

        <div className={styles.colLado}>
          <Panel index="01" label="Detalle" className={styles.oDetalle} meta={live ? 'colocando' : pick ? 'en el estuche' : null}>
            <Detalle
              placing={live}
              spot={liveSpot}
              selected={pick}
              world={world}
              now={now}
              onRaspar={raspar}
              onSoltar={() => setSelected(null)}
              hasCopies={copies.length > 0}
            />
          </Panel>
          <Panel index="02" label="Carpeta" className={styles.oCarpeta} meta={`${pad2(copies.length)} sin pegar`}>
            <Carpeta userId={me.id} selected={live?.uid ?? null} onPick={lift} />
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ── the masthead: the Taller's livery, loud ─────────────────────────────────

function Cabeza({ onCase, inBinder }: { onCase: number; inBinder: number }) {
  return (
    <header className={styles.cab}>
      <div className={styles.cabTop}>
        <span className={styles.canal}>
          {TALLER.canal} · {TALLER.code}
        </span>
        <span className={styles.cabCode}>CRD · CALCOS</span>
        <span className={styles.cabRule} aria-hidden="true" />
        <span className={styles.cabDatos}>
          {pad2(onCase)} en el estuche · {pad2(inBinder)} en la carpeta
        </span>
      </div>
      <h2 className={styles.cabName}>
        <span className={styles.cabGhost} aria-hidden="true">
          Estuche
        </span>
        <span className={styles.cabSolid}>Estuche</span>
      </h2>
      <p className={styles.lema}>Tu credencial vive en un estuche. Lo que le pegas se queda: solo sale raspando, pasada por pasada, y envejece con él.</p>
      <span className={styles.cabBand} style={patronStyle('tapete', TALLER.on) as CSSProperties} aria-hidden="true" />
    </header>
  )
}

// ── detail: the copy in hand, or the sticker picked on the case ─────────────

function Detalle({
  placing,
  spot,
  selected,
  world,
  now,
  onRaspar,
  onSoltar,
  hasCopies,
}: {
  placing: { uid: string; stickerId: string } | null
  spot: Spot | null
  selected: string | null
  world: World
  now: Date
  onRaspar: (pl: StickerPlacement) => void
  onSoltar: () => void
  hasCopies: boolean
}) {
  if (placing) {
    const copy = world.binder[placing.uid]
    const def = world.stickers[placing.stickerId]
    if (!copy || !def) return null
    return (
      <div className={styles.detalle}>
        <Ficha def={def} uid={copy.uid} serial={copy.serial} lifted />
        <dl className={styles.hechos}>
          <div>
            <dt>Llegó</dt>
            <dd>
              {comoLlego(copy, def)} · {fechaCorta(copy.at)}
            </dd>
          </div>
          <div>
            <dt>Lugar</dt>
            <dd>{spot ? `${spot.face === 'frente' ? 'Frente' : 'Dorso'} · ${deg(spot.rot)}° · ×${spot.scale.toFixed(2)}` : 'Sigue al puntero'}</dd>
          </div>
        </dl>
        <ul className={styles.teclas} aria-label="Cómo se coloca">
          <li>
            <b>Mover</b> con el puntero; en pantalla táctil, arrastra.
          </li>
          <li>
            <b>Girar</b> con la rueda o Q / E.
          </li>
          <li>
            <b>Tamaño</b> con + / − (o Ctrl + rueda).
          </li>
          <li>
            <b>F</b> lo lleva a la otra cara.
          </li>
          <li>
            <b>Clic o Enter</b> elige el lugar; <b>Esc</b> lo devuelve.
          </li>
        </ul>
      </div>
    )
  }
  if (selected) {
    const pl = world.placements[selected]
    const copy = world.binder[selected]
    const def = copy ? world.stickers[copy.stickerId] : undefined
    if (!pl || !copy || !def) return null
    const passes = Math.round(pl.wear / SCRAPE_STEP)
    const left = PASSES - passes
    const last = left <= 1
    return (
      <div className={styles.detalle}>
        <Ficha def={def} uid={copy.uid} serial={copy.serial} wear={pl.wear} />
        <p className={styles.edad}>Pegado {edad(pl.at, now)}</p>
        <dl className={styles.hechos}>
          <div>
            <dt>Cara</dt>
            <dd>{pl.face === 'frente' ? 'Frente' : 'Dorso'}</dd>
          </div>
          <div>
            <dt>Pegado</dt>
            <dd>{fechaCorta(pl.at)}</dd>
          </div>
          <div>
            <dt>Llegó</dt>
            <dd>
              {comoLlego(copy, def)} · {fechaCorta(copy.at)}
            </dd>
          </div>
          <div>
            <dt>Raspado</dt>
            <dd>
              <Pasadas done={passes} />
              {passes ? `${passes} de ${PASSES} pasadas` : 'Intacto'}
            </dd>
          </div>
        </dl>
        <div className={styles.raspar}>
          {last ? (
            <>
              <p className={styles.ultima}>
                <b>Última pasada.</b> Se va para siempre: no vuelve a tu carpeta.
              </p>
              <HoldButton onConfirm={() => onRaspar(pl)} tone="danger" energy={def.energy} holdingLabel="Raspando…" full>
                Mantén para quitarlo del todo
              </HoldButton>
            </>
          ) : (
            <>
              <Button variant="ghost" full onClick={() => onRaspar(pl)}>
                Raspar · una pasada
              </Button>
              <p className={styles.rasparNota}>
                {left === PASSES ? 'Cada pasada se lleva una parte. ' : ''}
                {left - 1 === 1 ? 'Después de esta queda una.' : `Después de esta quedan ${left - 1}.`}
              </p>
            </>
          )}
          <Button variant="quiet" size="sm" onClick={onSoltar}>
            Soltar
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.nada}>
      <p>{hasCopies ? 'Elige un calco de tu carpeta para pegarlo en el estuche.' : 'Tu carpeta está vacía por ahora.'}</p>
      <p>Toca uno que ya esté pegado para ver cuánto lleva ahí, o para rasparlo.</p>
    </div>
  )
}

/** The copy in hand: its own foil, its finish and number, what the finish does — and, for a foil, that it's the only one like it. */
function Ficha({ def, uid, serial, wear, lifted }: { def: StickerDef; uid: string; serial?: number; wear?: number; lifted?: boolean }) {
  return (
    <div className={styles.ficha}>
      <div className={styles.fichaArt} data-wide={def.aspect > 1.8 || undefined}>
        <Calco def={def} width={def.aspect > 1.8 ? 300 : 200} serial={serial} seed={copySeed(uid)} wear={wear} lifted={lifted} label={`Sticker: ${def.name}`} />
      </div>
      <p className={styles.fichaKind}>
        {FORM_LABEL[def.form]} · {lineaCopia(def, serial)}
      </p>
      <h3 className={styles.fichaName}>{def.name}</h3>
      <p className={styles.fichaNote}>{notaAcabado(def)}</p>
      {esUnica(def) ? <p className={styles.fichaUnica}>{COPIA_UNICA}</p> : null}
    </div>
  )
}

function Pasadas({ done }: { done: number }) {
  return (
    <span className={styles.pasadas} aria-hidden="true">
      {Array.from({ length: PASSES }, (_, i) => (
        <i key={i} data-on={i < done || undefined} />
      ))}
    </span>
  )
}

// ── the wall: what's on the case, oldest first ──────────────────────────────

function Pared({
  placements,
  world,
  now,
  selected,
  onChoose,
}: {
  placements: StickerPlacement[]
  world: World
  now: Date
  selected: string | null
  onChoose: (uid: string) => void
}) {
  const byFace = useMemo(() => {
    const out: Record<CardFace, StickerPlacement[]> = { frente: [], dorso: [] }
    for (const p of [...placements].sort((a, b) => a.at.localeCompare(b.at))) out[p.face].push(p)
    return out
  }, [placements])
  return (
    <Panel index="03" label="Pared" className={styles.oPared} meta="lo que lleva el estuche · del más viejo al más nuevo">
      {placements.length ? (
        <div className={styles.pared}>
          {FACES.map((face) => (
            <section key={face} className={styles.cara} aria-label={face === 'frente' ? 'Frente' : 'Dorso'}>
              <h3 className={styles.caraHead}>
                {face === 'frente' ? 'Frente' : 'Dorso'} <i>{pad2(byFace[face].length)}</i>
              </h3>
              {byFace[face].length ? (
                <ol className={styles.filas}>
                  {byFace[face].map((pl) => {
                    const copy = world.binder[pl.uid]
                    const def = copy ? world.stickers[copy.stickerId] : undefined
                    if (!def) return null
                    const on = selected === pl.uid
                    return (
                      <li key={pl.uid}>
                        <button type="button" className={styles.fila} data-on={on || undefined} aria-pressed={on} onClick={() => onChoose(pl.uid)}>
                          <span className={styles.filaArt}>
                            <Calco def={def} width={def.aspect > 1.8 ? 64 : 40} seed={copySeed(pl.uid)} wear={pl.wear} still />
                          </span>
                          <span className={styles.filaText}>
                            <span className={styles.filaName}>{def.name}</span>
                            <span className={styles.filaMeta}>
                              {fechaCorta(pl.at)} · {edad(pl.at, now)}
                            </span>
                          </span>
                          <Pasadas done={Math.round(pl.wear / SCRAPE_STEP)} />
                        </button>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className={styles.caraVacia}>{face === 'frente' ? 'El frente está limpio.' : 'El dorso está limpio.'}</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.caraVacia}>El estuche está limpio: nada pegado todavía.</p>
      )}
    </Panel>
  )
}
