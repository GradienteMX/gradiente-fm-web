'use client'

/**
 * CREDENCIAL — one card, two states. The invitation you're handed at La
 * Puerta and the public credential on /u/ are the same object: the card IS
 * the profile IS the card.
 *
 * «ESTUCHE»: the printed card — a cotton board in its role's livery, its
 * role's foil hot-stamped on it — lives inside a collector's case (a clear
 * slab, a frosted band round the pocket), and the owner's stickers are
 * pressed onto the case (front and back), aging with the months. In the
 * Taller the same card is the sticker editor's surface (`editor`, see
 * ./editor.ts).
 *
 * Rendering: a stage window (one WebGL context, behind the DOM) draws the
 * object; this component owns a transparent slot over it (the window
 * reaches a little past the slot, so a case turned by hand isn't clipped).
 * Until the print is ready a CSS card with the same content stands in, then
 * cross-fades away so nothing pops. Wherever WebGL is unavailable (or the
 * page paints over the stage) the CSS card is the card: a flat case, the
 * board's colour and grain, and the stickers flat on the faces (aged by
 * colour, scraped by opacity; no peel, no gloss).
 *
 * Handling: the pointer leans it; press and drag turns it (across: all the
 * way round; up and down: a little), and let go it slings to a face; a click
 * / Enter / Space turns it over. At rest it is a still print (no idle
 * motion); reduced motion renders it still, the drag follows the hand and a
 * release or a flip lands at once.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getStage } from '@/components/stage/engine'
import { ROLE_LABEL } from '@/components/kit/Persona'
import { RANK_LABEL } from '@/components/kit/Glyph'
import { energyFont, energyVariation } from '@/lib/vibe'
import { fmt } from '@/lib/logic/time'
import { useNowMs, useWorld } from '@/lib/store/world'
import { PLACEMENT_BLEED, PLACEMENT_SCALE, type CardFace, type StickerDef } from '@/lib/stickers/types'
import { CardPrinter, cardFonts, DW } from './cardPrint'
import { CardScene } from './cardGL'
import { CARD_FRAC, CARD_H, CARD_W, CASE_HX, CASE_HY, clampToOutline, GL_BLEED_X, GL_BLEED_Y } from './geometry'
import { cardStock, describeCredencial, roleBand, type CredencialData } from './data'
import { groundBehind, paintedOver, unit } from './cssColor'
import type { CredencialEditor } from './editor'
import type { StickerItem } from './stickerGL'
import { StickersCSS } from './StickersCSS'
import { RANK_SIGIL, ruedaPath, Sigil, TrophySigil } from './sigils'
import styles from './Credencial.module.css'

export interface CredencialProps {
  data: CredencialData
  /** Play the arrival (La Puerta). */
  arrive?: boolean
  className?: string
  onFlip?: (back: boolean) => void
  /** Hint under the card for sighted users; the button carries its own label. */
  hint?: string
  /** Hint while the back is showing. */
  hintBack?: string
  /** Whose stickers ride on the case (defaults to `data.userId`). */
  userId?: string | null
  /** The Taller's sticker editor: placing, picking, the selected sticker. */
  editor?: CredencialEditor
}

export interface CredencialHandle {
  el: HTMLDivElement | null
  flip: (back?: boolean) => void
}

interface Ghost {
  face: CardFace
  x: number
  y: number
  rot: number
  scale: number
}

interface Hand {
  id: number
  x0: number
  y0: number
  /** Past the threshold: it's a turn, not a click. */
  on: boolean
  /** The slot's width (px) when taken: the drag's scale. */
  w: number
  /** The CSS card's turn (no WebGL), degrees, and its speed. */
  yaw: number
  v: number
  t: number
}

const ROT_KEY = Math.PI / 24 // 7.5°
const NUDGE = 0.01
/** Past this (px) a press is a turn, not a click. */
const DRAG_PX = 5
const DRAG_PX_TOUCH = 9
const clampScale = (v: number) => Math.min(PLACEMENT_SCALE[1], Math.max(PLACEMENT_SCALE[0], v))
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const HOUR = 3_600_000
const YEAR = 365.25 * 86_400_000
const NO_ITEMS: StickerItem[] = []

/** Where a sticker's centre may sit: on the card or on the case past it, never beyond the case's outline. */
function clampFace(x: number, y: number): [number, number] {
  const [ux, uy] = clampToOutline((x - 0.5) * CARD_W, (0.5 - y) * CARD_H)
  const b = PLACEMENT_BLEED
  return [Math.min(1 + b, Math.max(-b, ux / CARD_W + 0.5)), Math.min(1 + b, Math.max(-b, 0.5 - uy / CARD_H))]
}

// The slot is the card's box at CARD_FRAC; the case sits in it, the GL
// window reaches past it. The stylesheet carries these same boxes for the
// first paint; on mount they're set from the geometry, the one source.
const SLOT_HX = CARD_W / (2 * CARD_FRAC)
const SLOT_HY = CARD_H / (2 * CARD_FRAC)
const pct = (v: number) => `${(v * 100).toFixed(3)}%`
const HIT_BOX = {
  left: pct(0.5 - CASE_HX / (2 * SLOT_HX)),
  top: pct(0.5 - CASE_HY / (2 * SLOT_HY)),
  width: pct(CASE_HX / SLOT_HX),
  height: pct(CASE_HY / SLOT_HY),
}
const GL_BOX = { left: pct(-GL_BLEED_X), right: pct(-GL_BLEED_X), top: pct(-GL_BLEED_Y), bottom: pct(-GL_BLEED_Y) }

export const Credencial = forwardRef<CredencialHandle, CredencialProps>(function Credencial(
  { data, arrive = false, className, onFlip, hint, hintBack, userId, editor },
  ref,
) {
  const slotRef = useRef<HTMLDivElement>(null)
  const glRef = useRef<HTMLDivElement>(null)
  const hitRef = useRef<HTMLButtonElement>(null)
  const sceneRef = useRef<CardScene | null>(null)
  const printerRef = useRef<CardPrinter | null>(null)
  const reducedRef = useRef(false)
  const [mode, setMode] = useState<'css' | 'gl'>('css')
  const [glOff, setGlOff] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const flippedRef = useRef(false)
  const [texW, setTexW] = useState(0)
  const [overSticker, setOverSticker] = useState(false)
  const editorRef = useRef(editor)
  editorRef.current = editor
  const ghostRef = useRef<Ghost | null>(null)
  const lastHitRef = useRef<{ face: CardFace; x: number; y: number } | null>(null)
  const downRef = useRef<{ x: number; y: number } | null>(null)
  const handRef = useRef<Hand | null>(null)
  /** A turn by hand just ended: the click it leaves behind isn't a click. */
  const turnedRef = useRef(false)

  /** The face it now rests on (a turn by hand already put it there). */
  const land = useCallback(
    (back: boolean) => {
      if (back === flippedRef.current) return
      flippedRef.current = back
      setFlipped(back)
      onFlip?.(back)
    },
    [onFlip],
  )

  const doFlip = useCallback(
    (back?: boolean) => {
      const next = back ?? !flippedRef.current
      if (next === flippedRef.current) return
      sceneRef.current?.flip(next)
      land(next)
    },
    [land],
  )

  useImperativeHandle(ref, () => ({ el: slotRef.current, flip: doFlip }), [doFlip])

  // ── the owner's stickers ─────────────────────────────────────────────────
  const owner = userId ?? data.userId ?? null
  const placements = useWorld((s) => s.world.placements)
  const binder = useWorld((s) => s.world.binder)
  const catalog = useWorld((s) => s.world.stickers)
  const nowMs = useNowMs()
  // Age is measured in months; an hourly clock is plenty (and a resting
  // card doesn't redraw every world tick).
  const hour = Math.floor(nowMs / HOUR)
  const items = useMemo<StickerItem[]>(() => {
    if (!owner) return []
    const out: StickerItem[] = []
    for (const p of Object.values(placements)) {
      if (p.userId !== owner) continue
      const stickerId = p.stickerId ?? binder[p.uid]?.stickerId
      const def = stickerId ? catalog[stickerId] : undefined
      if (def) out.push({ placement: p, def })
    }
    return out.sort((a, b) => a.placement.z - b.placement.z)
  }, [owner, placements, binder, catalog])

  const placing = editor?.placing ?? null
  const placingDef: StickerDef | null = placing ? (catalog[placing.stickerId] ?? null) : null
  // The copy itself, so the preview shows its own foil, not a shelf sample.
  const placingUid = placing?.uid
  const selected = editor?.selected ?? null

  // Reduced motion, live.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      reducedRef.current = mq.matches
      sceneRef.current?.setReduced(mq.matches)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Texture resolution follows the slot, in coarse steps (repaints are not free).
  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const measure = () => {
      const cardW = el.clientWidth * CARD_FRAC
      if (cardW < 1) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const want = Math.round(Math.min(1792, Math.max(640, cardW * dpr * 1.2)) / 128) * 128
      setTexW((prev) => (prev === 0 || Math.abs(prev - want) >= 256 ? want : prev))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The GL window lives as long as the component. (If the page paints over
  // the stage behind it, GL couldn't be seen: the CSS card takes over.)
  useEffect(() => {
    const el = glRef.current
    if (el) Object.assign(el.style, GL_BOX)
    if (hitRef.current) Object.assign(hitRef.current.style, HIT_BOX)
    const stage = getStage()
    let scene: CardScene | null = null
    if (el && stage.renderer && !paintedOver(el)) {
      try {
        scene = new CardScene(stage.renderer, { reduced: reducedRef.current })
      } catch {
        scene = null
      }
    }
    if (!el || !scene) {
      setGlOff(true)
      return
    }
    sceneRef.current = scene
    // Development only: lets headless checks pose the card and hold the foil.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __credencial?: CardScene }).__credencial = scene
    const s = scene
    const off = stage.addWindow({ el, order: 20, render: (ctx) => s.render(ctx), idle: () => s.isIdle() })
    return () => {
      off()
      s.dispose()
      sceneRef.current = null
      setMode('css')
    }
  }, [])

  // Paint the faces whenever what they say (or their resolution) changes.
  const key = useMemo(() => JSON.stringify(data), [data])
  const dataRef = useRef(data)
  dataRef.current = data
  useEffect(() => {
    if (!texW || glOff) return
    let cancelled = false
    const first = !sceneRef.current?.ready
    const t = window.setTimeout(async () => {
      const fonts = await cardFonts()
      if (cancelled) return
      let printer = printerRef.current
      if (!printer || printer.width !== texW) {
        printer = new CardPrinter(texW)
        printerRef.current = printer
      }
      const d = dataRef.current
      printer.paint(d, fonts)
      const scene = sceneRef.current
      if (!scene) return
      scene.setPrint(printer.print, printer.relief, printer.label)
      scene.setRole(d.role)
      scene.setArtPx(texW >= 1100 ? 512 : 256)
      const years = d.joinedAt ? Math.max(0, (Date.now() - Date.parse(d.joinedAt)) / YEAR) : 0
      scene.setScuff(d.joinedAt ? 0.3 + 0.7 * Math.min(1, years / 2) : 0.15)
      const [gr, gg, gb] = unit(groundBehind(slotRef.current?.parentElement ?? null))
      scene.setGround([gr, gg, gb])
      if (!scene.ready) {
        scene.ready = true
        if (arrive) scene.arrive()
        // Let a GL frame land before the CSS card steps aside.
        requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && setMode('gl')))
      }
    }, first ? 0 : 120)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, texW, glOff])

  // Stickers onto the case.
  useEffect(() => {
    sceneRef.current?.syncStickers(items, hour * HOUR)
  }, [items, hour, glOff])

  // ── the editor ───────────────────────────────────────────────────────────
  const pushGhost = useCallback(() => {
    const scene = sceneRef.current
    const g = ghostRef.current
    const def = placingDef
    if (!scene) return
    scene.setGhost(g && def ? { def, uid: placingUid, ...g } : null)
  }, [placingDef, placingUid])

  useEffect(() => {
    sceneRef.current?.setEditing(Boolean(editor))
  }, [editor])

  // A copy leaves the binder: it follows the pointer on the face you see.
  useEffect(() => {
    if (!placing || !placingDef) {
      ghostRef.current = null
      sceneRef.current?.setGhost(null)
      return
    }
    const face: CardFace = flippedRef.current ? 'dorso' : 'frente'
    const last = lastHitRef.current
    const [x, y] = last && last.face === face ? clampFace(last.x, last.y) : [0.5, 0.5]
    ghostRef.current = { face, x, y, rot: 0, scale: 1 }
    pushGhost()
    hitRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing?.uid, placingDef])

  // The picked sticker is marked — and shown, if it's on the other face.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setSelected(selected)
    const f = selected ? scene.stickerFace(selected) : null
    if (f && (f === 'dorso') !== flippedRef.current) doFlip(f === 'dorso')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, items])

  const place = useCallback(() => {
    const ed = editorRef.current
    const g = ghostRef.current
    if (!ed?.placing || !g) return
    const [x, y] = clampFace(g.x, g.y)
    ed.onPlace({ face: g.face, x, y, rot: wrapAngle(g.rot), scale: clampScale(g.scale) })
  }, [])

  // The wheel turns the copy (Ctrl + wheel / pinch scales it); it must not scroll the page.
  useEffect(() => {
    const el = slotRef.current
    if (!el || !placing) return
    const onWheel = (e: WheelEvent) => {
      const g = ghostRef.current
      if (!g) return
      e.preventDefault()
      if (e.ctrlKey) g.scale = clampScale(g.scale * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004))
      else g.rot += Math.max(-0.26, Math.min(0.26, e.deltaY * 0.0025))
      pushGhost()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [placing, pushGhost])

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const ed = editorRef.current
    const g = ghostRef.current
    if (!ed?.placing || !g) return
    const step = e.shiftKey ? NUDGE * 5 : NUDGE
    let handled = true
    switch (e.key) {
      case 'q':
      case 'Q':
        g.rot -= ROT_KEY
        break
      case 'e':
      case 'E':
        g.rot += ROT_KEY
        break
      case '+':
      case '=':
      case ']':
        g.scale = clampScale(g.scale + 0.05)
        break
      case '-':
      case '_':
      case '[':
        g.scale = clampScale(g.scale - 0.05)
        break
      case 'ArrowLeft':
        ;[g.x, g.y] = clampFace(g.x - step, g.y)
        break
      case 'ArrowRight':
        ;[g.x, g.y] = clampFace(g.x + step, g.y)
        break
      case 'ArrowUp':
        ;[g.x, g.y] = clampFace(g.x, g.y - step)
        break
      case 'ArrowDown':
        ;[g.x, g.y] = clampFace(g.x, g.y + step)
        break
      case 'f':
      case 'F':
        // The copy goes to the other face and the card turns to show it.
        g.face = g.face === 'frente' ? 'dorso' : 'frente'
        doFlip(g.face === 'dorso')
        break
      case 'Enter':
        place()
        break
      case 'Escape':
        ed.onCancel()
        break
      default:
        handled = false
    }
    if (!handled) return
    e.preventDefault()
    e.stopPropagation()
    pushGhost()
  }

  // ── by hand ──────────────────────────────────────────────────────────────
  // A press that travels turns the case (a click that doesn't still flips
  // it). While placing a sticker the pointer places it instead.

  /** The CSS card (no WebGL) turns too: a rotation while in hand, then the face. */
  const cssTurn = (deg: number | null) => {
    const s = slotRef.current?.style
    if (!s) return
    if (deg === null) s.removeProperty('--dyaw')
    else s.setProperty('--dyaw', `${deg.toFixed(1)}deg`)
  }

  const letGo = (e: React.PointerEvent<HTMLDivElement>, carry: boolean) => {
    const hand = handRef.current
    if (!hand || hand.id !== e.pointerId) return false
    handRef.current = null
    if (!hand.on) return false
    delete e.currentTarget.dataset.hand
    turnedRef.current = true
    window.setTimeout(() => (turnedRef.current = false), 0)
    const scene = sceneRef.current
    // It lands leaning toward wherever the pointer is now.
    const r = e.currentTarget.getBoundingClientRect()
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    scene?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2, carry && inside)
    if (scene) land(scene.release(carry ? e.timeStamp : Number.POSITIVE_INFINITY))
    else {
      const idle = Math.max(0, e.timeStamp - hand.t)
      const v = carry ? hand.v * Math.exp(-idle / 60) : 0
      const n = Math.round((hand.yaw + v * 0.16) / 180)
      cssTurn(null)
      if (Math.abs(n) % 2 === 1) land(!flippedRef.current)
    }
    return true
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const hand = handRef.current
    if (hand && hand.id === e.pointerId) {
      const dx = e.clientX - hand.x0
      const dy = e.clientY - hand.y0
      if (!hand.on && Math.hypot(dx, dy) > (e.pointerType === 'mouse' ? DRAG_PX : DRAG_PX_TOUCH)) {
        hand.on = true
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* the turn still works while the pointer stays over the slot */
        }
        e.currentTarget.dataset.hand = ''
        sceneRef.current?.grab(e.timeStamp)
        sceneRef.current?.setHover(null)
        setOverSticker(false)
      }
      if (hand.on) {
        // Across: the card's half-width turns it a quarter (you're pushing its edge).
        const gain = Math.PI / (CARD_FRAC * Math.max(1, hand.w))
        const scene = sceneRef.current
        if (scene) scene.drag(dx * gain, dy * gain, e.timeStamp)
        else {
          const yaw = Math.max(-180, Math.min(180, (dx * gain * 180) / Math.PI))
          const dt = Math.max(1, e.timeStamp - hand.t)
          hand.v += ((yaw - hand.yaw) / (dt / 1000) - hand.v) * (1 - Math.exp(-dt / 50))
          hand.yaw = yaw
          hand.t = e.timeStamp
          cssTurn(yaw)
        }
        return
      }
    }
    const r = e.currentTarget.getBoundingClientRect()
    if (!reducedRef.current) {
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2
      sceneRef.current?.setPointer(nx, ny, true)
      const s = e.currentTarget.style
      s.setProperty('--px', nx.toFixed(3))
      s.setProperty('--py', ny.toFixed(3))
    }
    const scene = sceneRef.current
    const ed = editorRef.current
    const gl = glRef.current
    if (!scene || !ed || !gl) return
    const gr = gl.getBoundingClientRect()
    const hit = scene.faceAt(e.clientX, e.clientY, gr)
    if (hit && hit.onCase) lastHitRef.current = hit
    const g = ghostRef.current
    if (ed.placing && g) {
      // on the face it's going to: it follows, held to the case's outline
      if (hit && hit.face === g.face) {
        ;[g.x, g.y] = clampFace(hit.x, hit.y)
        pushGhost()
      }
      return
    }
    if (e.pointerType !== 'mouse') return
    const uid = hit && hit.onCase ? scene.pickAt(e.clientX, e.clientY, gr) : null
    scene.setHover(uid)
    setOverSticker(Boolean(uid))
  }
  const onLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (handRef.current?.on) return
    sceneRef.current?.setPointer(0, 0, false)
    sceneRef.current?.setHover(null)
    setOverSticker(false)
    const s = e.currentTarget.style
    s.setProperty('--px', '0')
    s.setProperty('--py', '0')
  }
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    downRef.current = { x: e.clientX, y: e.clientY }
    if (editorRef.current?.placing) {
      if (e.pointerType !== 'mouse') onMove(e)
      return
    }
    if (!e.isPrimary || e.button !== 0) return
    turnedRef.current = false
    handRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, w: e.currentTarget.getBoundingClientRect().width, yaw: 0, v: 0, t: e.timeStamp }
  }
  // Placing: a click or a tap presses it; a drag only moves it.
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (letGo(e, true)) return
    const d = downRef.current
    downRef.current = null
    if (!editorRef.current?.placing || !d || e.button !== 0) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
    const gl = glRef.current
    const hit = gl ? sceneRef.current?.faceAt(e.clientX, e.clientY, gl.getBoundingClientRect()) : null
    if (!hit || !hit.onCase) return
    place()
  }
  // The page took the gesture (a vertical scroll on touch): it lands where it is.
  const onCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    letGo(e, false)
  }
  const onContext = (e: React.MouseEvent) => {
    if (!editorRef.current?.placing) return
    e.preventDefault()
    editorRef.current.onCancel()
  }
  const onHitClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // the click a turn by hand leaves behind
    if (turnedRef.current && e.detail > 0) {
      e.preventDefault()
      return
    }
    const ed = editorRef.current
    if (ed?.placing) {
      e.preventDefault()
      return
    }
    if (ed && e.detail > 0) {
      const scene = sceneRef.current
      const r = glRef.current?.getBoundingClientRect()
      const uid = scene && r ? scene.pickAt(e.clientX, e.clientY, r) : null
      if (uid) {
        ed.onPick(uid === ed.selected ? null : uid)
        return
      }
      if (ed.selected) {
        ed.onPick(null)
        return
      }
    }
    doFlip()
  }

  const roleLabel = ROLE_LABEL[data.role]
  const rankLabel = RANK_LABEL[data.rank]
  const description = describeCredencial(data, roleLabel, rankLabel)
  const face = flipped ? (data.surface === 'invitation' ? 'el código' : 'sus insignias') : 'el frente'
  const stickerNote = items.length ? ` ${items.length === 1 ? 'Un calco' : `${items.length} calcos`} en el estuche.` : ''
  // While placing, F turns the card with the copy: the face you see is its face.
  const label = placing
    ? `Pegando ${placingDef?.name ?? 'un calco'} en ${flipped ? 'el dorso' : 'el frente'}. Flechas: mover. Q y E: girar. Más y menos: tamaño. F: la otra cara. Enter: pegar. Escape: cancelar.`
    : `${description}${stickerNote} Mostrando ${face}. Voltear.`
  const cursor = placing ? 'place' : editor && overSticker ? 'pick' : undefined
  // The CSS card is the first paint and the no-WebGL card. When the card is
  // meant to *arrive*, GL does the arriving; the CSS card only steps in if
  // WebGL isn't there.
  const cssVisible = glOff || (mode === 'css' && !arrive)

  return (
    <div className={[styles.wrap, className ?? ''].join(' ')}>
      <div
        ref={slotRef}
        className={styles.slot}
        data-css={cssVisible ? 'on' : 'off'}
        data-gl-off={glOff || undefined}
        data-editing={editor ? '' : undefined}
        data-placing={placing ? '' : undefined}
        data-cursor={cursor}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onContextMenu={onContext}
      >
        <div ref={glRef} className={styles.gl} aria-hidden="true" />
        {/* Flat stickers only when the CSS card IS the card (no WebGL, or
            the page paints over the stage); otherwise GL shows them. */}
        <CardCSS data={data} flipped={flipped} arrive={arrive && glOff} items={glOff ? items : NO_ITEMS} nowMs={hour * HOUR} />
        <button
          ref={hitRef}
          type="button"
          className={styles.hit}
          onClick={onHitClick}
          onKeyDown={onKeyDown}
          aria-pressed={placing ? undefined : flipped}
          aria-label={label}
        />
      </div>
      {hint ? (
        <p className={styles.hint} aria-hidden="true">
          {flipped && hintBack ? hintBack : hint}
        </p>
      ) : null}
    </div>
  )
})

// ── CSS card (fallback + first paint) ───────────────────────────────────────

const U = (n: number) => `calc(${n} * var(--u))`

function CardWordmark({ band, size }: { band: [number, number]; size: number }) {
  const letters = 'GRADIENTE'.split('')
  return (
    <span className={styles.wordmark} style={{ fontSize: U(size) }}>
      {letters.map((ch, i) => {
        const e = band[0] + ((band[1] - band[0]) * i) / (letters.length - 1)
        return (
          <span key={i} style={{ fontVariationSettings: energyVariation(e) }}>
            {ch}
          </span>
        )
      })}
    </span>
  )
}

function nameSize(name: string, energy: number): number {
  const { wdth, wght } = energyFont(energy)
  const em = 0.6 * (wdth / 100) * (1 + (wght - 400) / 4000)
  return Math.max(52, Math.min(124, (DW - 460) / (Math.max(4, name.length) * em)))
}

function CardCSS({ data: d, flipped, arrive, items, nowMs }: { data: CredencialData; flipped: boolean; arrive: boolean; items: StickerItem[]; nowMs: number }) {
  const band = roleBand(d.role)
  const invite = d.surface === 'invitation'
  const size = nameSize(d.name, d.energy)
  const st = cardStock(d.role)
  const stockVars = { '--stock': st.stock, '--on': st.ink, '--core': st.core } as CSSProperties
  let expires: string | null = null
  if (d.expires) {
    try {
      expires = fmt.long(d.expires)
    } catch {
      expires = d.expires
    }
  }
  return (
    <div className={styles.card2d} style={stockVars} data-flipped={flipped || undefined} data-arrive={arrive || undefined} aria-hidden="true">
      <div className={styles.tilt}>
        <div className={styles.case2d} />
        <div className={styles.inner}>
          {/* ── front ── */}
          <div className={`${styles.face} ${styles.front}`}>
            <div className={styles.fTop}>
              <CardWordmark band={band} size={64} />
              <span className={styles.kind}>
                <b>{invite ? 'INVITACIÓN' : 'CREDENCIAL'}</b>
                <span>BETA CERRADA</span>
              </span>
            </div>
            <svg className={styles.seal} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round">
              <path d={ruedaPath(30, 3.1, 9.8)} strokeWidth={0.2} />
              <circle cx={10} cy={10} r={2.5} strokeWidth={0.24} />
            </svg>
            <div className={styles.identity}>
              <p className={styles.name} style={{ fontVariationSettings: energyVariation(d.energy), fontSize: U(size) }}>
                {d.name}
              </p>
              <p className={styles.handle} data-empty={!d.handle || undefined}>
                {d.handle ? `@${d.handle}` : '@ tu usuario'}
              </p>
              <div className={styles.badges}>
                {d.role !== 'user' ? (
                  <span className={styles.badge}>
                    <span className={styles.foil}>{ROLE_LABEL[d.role].toUpperCase()}</span>
                  </span>
                ) : (
                  <span className={styles.badge}>
                    <Sigil parts={RANK_SIGIL[d.rank]} className={styles.badgeSigil} strokeWidth={1.7} />
                    <span className={styles.foil}>{RANK_LABEL[d.rank]}</span>
                  </span>
                )}
                {d.isMod ? <span className={styles.flag}>MOD</span> : null}
                {d.isOG ? <span className={styles.flag}>OG</span> : null}
                {d.team ? <span className={styles.team}>EQUIPO · {d.team.toUpperCase()}</span> : null}
              </div>
            </div>
            <div className={styles.fields}>
              <span className={styles.fieldA}>
                <i>FOLIO · ORDEN DE LLEGADA</i>
                <b className={styles.serial}>{d.folio}</b>
              </span>
              <span className={styles.fieldB}>
                <i>{invite ? 'EMITIDA' : 'EN LA SEÑAL DESDE'}</i>
                <b>{d.issued}</b>
              </span>
              <span className={styles.fieldC}>
                {invite && d.code ? (
                  <>
                    <i>CÓDIGO</i>
                    <b className={styles.code}>{d.code}</b>
                  </>
                ) : d.firma ? (
                  <>
                    <i>FIRMA</i>
                    <b className={styles.firma}>{d.firma}</b>
                  </>
                ) : d.handle ? (
                  <>
                    <i>PERFIL</i>
                    <b className={styles.url}>gradiente.org/u/{d.handle}</b>
                  </>
                ) : null}
              </span>
            </div>
            <StickersCSS items={items} face="frente" nowMs={nowMs} />
          </div>

          {/* ── back ── */}
          <div className={`${styles.face} ${styles.back}`}>
            <div className={styles.bTop}>
              <span className={styles.bLabel}>
                <b>{invite ? 'INVITACIÓN' : 'INSIGNIAS'}</b>
                <span>{invite ? 'código de acceso' : d.handle ? `@${d.handle}` : ''}</span>
              </span>
              <CardWordmark band={band} size={30} />
            </div>
            {invite ? (
              <div className={styles.bInvite}>
                <p className={`${styles.bCode} ${styles.foil}`}>{d.code}</p>
                <p className={styles.bLine}>Válida para una sola identidad.</p>
                {expires ? <p className={styles.bSub}>Vence el {expires}.</p> : null}
                <p className={styles.bNote}>
                  Aquí se prenderán tus insignias:
                  <br />
                  se ganan publicando, conversando y calibrando.
                </p>
              </div>
            ) : d.pins.length ? (
              <ul className={styles.pins} data-rows={d.pins.length > 5 ? 2 : 1}>
                {d.pins.slice(0, 10).map((p) => (
                  <li key={p.key} className={styles.pin}>
                    <span className={styles.pinDisc}>
                      <TrophySigil trophy={p.key} className={styles.pinSigil} strokeWidth={1.75} />
                    </span>
                    <b>{p.label}</b>
                    <i>{p.earned}</i>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.bEmpty}>
                <p>Aún sin insignias.</p>
                <span>Se ganan publicando, conversando y calibrando. No se compran.</span>
              </div>
            )}
            <div className={styles.bFoot}>
              <span>{invite ? 'LA PUERTA · gradiente.org/welcome' : d.handle ? `gradiente.org/u/${d.handle}` : ''}</span>
              <b>{invite ? `EMITIDA ${d.issued}` : `FOLIO ${d.folio}`}</b>
            </div>
            <StickersCSS items={items} face="dorso" nowMs={nowMs} />
          </div>
        </div>
      </div>
    </div>
  )
}
