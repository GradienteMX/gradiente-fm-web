'use client'

/**
 * The frame every reading shares: a paper sheet over a veiled page. It
 * comes off the press from the card that asked for it (TRAMA
 * `imprimirHoja`: paper blocks clear outward from the card's centre) and
 * goes back the same way. Header: format, attribution, and the gestures that
 * work today — save, copy link, thread, report; admin pin / delete; the
 * author's edit. Esc closes (the thread first); C toggles it.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { useUI, type OriginRect } from '@/lib/store/ui'
import { useMe } from '@/lib/store/session'
import { useDispatch, useWorld } from '@/lib/store/world'
import { setFieldDim, flare } from '@/components/stage/api'
import { asentar, imprimirHoja } from '@/components/trama/api'
import { bandSteps, effectiveBand, energySlotHex } from '@/lib/vibe'
import { FORMAT_CODE, FORMAT_LABEL, FORMAT_ON, FORMAT_STOCK, FormatGlyph, Mark } from '@/components/kit/Glyph'
import { LIBREA_FORMATO } from '@/lib/librea'
import { patronCss } from '@/components/librea/patron'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { canDeleteContent, canAssignRoles } from '@/lib/permissions'
import { Hilo } from './Hilo'
import styles from './LecturaShell.module.css'

interface Props {
  item: ContentItem
  origin: OriginRect | null
  comments: boolean
  focusComment: string | null
  children: ReactNode
}

export function LecturaShell({ item, origin, comments, focusComment, children }: Props) {
  const closeLectura = useUI((s) => s.closeLectura)
  const setComments = useUI((s) => s.setLecturaComments)
  const openAccess = useUI((s) => s.openAccess)
  const openReport = useUI((s) => s.openReport)
  const ask = useUI((s) => s.ask)
  const notify = useUI((s) => s.notify)
  const openLectura = useUI((s) => s.openLectura)
  const me = useMe()
  const dispatch = useDispatch()
  const router = useRouter()
  const saved = useWorld((s) => (me ? Boolean(s.world.saves[me.id]?.[item.id]) : false))
  const franja = useWorld((s) => (item.franjaId ? s.world.items[item.franjaId] ?? null : null))
  const commentCount = useWorld((s) => {
    let n = 0
    for (const c of Object.values(s.world.comments)) if (c.contentItemId === item.id && !c.deletion) n++
    return n
  })
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)
  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  const livPat = patronCss(LIBREA_FORMATO[item.type].patron, LIBREA_FORMATO[item.type].on)
  const isFranja = item.type === 'franja'

  // The point the sheet prints out of: the centre of the card that asked.
  const originPoint = origin ? { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 } : null

  // Off the press, from the origin.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    setFieldDim(0.72)
    // Anything still printing on the page underneath finishes now.
    asentar(el)
    void imprimirHoja(el, { origin: originPoint, energy: mid })
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      setFieldDim(0)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = useCallback(() => {
    const el = panel.current
    if (!el || closing) return
    setClosing(true)
    setFieldDim(0)
    // Back under the paper, toward where it came from; then gone.
    asentar(el)
    void imprimirHoja(el, { origin: originPoint, energy: mid, reverse: true }).then(() => {
      // Covered by paper now: hide before the canvas lets go, so the sheet
      // never flashes back for the frame React takes to unmount it.
      el.style.visibility = 'hidden'
      closeLectura()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeLectura, closing, origin])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      // Another modal (a dialog, the access sheet…) on top owns the keys.
      const others = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter((d) => d !== panel.current)
      if (others.length) return
      if (e.key === 'Escape') {
        if (comments) setComments(false)
        else close()
      } else if (!typing && (e.key === 'c' || e.key === 'C') && !isFranja) {
        setComments(!comments)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, comments, setComments, isFranja])

  const toggleSave = (e: React.MouseEvent) => {
    if (!me) return openAccess('Guarda piezas en tu colección')
    dispatch({ t: 'save', userId: me.id, itemId: item.id, on: !saved, at: new Date().toISOString() })
    if (!saved) flare(e.currentTarget, mid)
  }

  const copy = async () => {
    const url = `${window.location.origin}/?item=${item.slug}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* ignore */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const remove = async () => {
    const ok = await ask({
      title: 'Borrar esta pieza',
      body: 'Se va del campo, del mapa y de los guardados de todos. No se puede deshacer.',
      typeToConfirm: `BORRAR ${item.title.slice(0, 24)}`,
      confirmLabel: 'Borrar',
      destructive: true,
    })
    if (!ok) return
    dispatch({ t: 'item-delete', itemId: item.id, at: new Date().toISOString() })
    notify('Pieza borrada.')
    closeLectura()
  }

  const isAdmin = Boolean(me && canAssignRoles(me))
  const canDelete = Boolean(me && (isAdmin || canDeleteContent(me, item) || item.createdById === me.id))
  const mine = Boolean(me && item.createdById === me.id)

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className={styles.root}
      data-closing={closing || undefined}
      style={{ ['--e' as string]: energySlotHex(mid), ['--band' as string]: bandSteps(band.min, band.max), ['--stock' as string]: FORMAT_STOCK[item.type], ['--stock-on' as string]: FORMAT_ON[item.type], ['--pat' as string]: livPat.backgroundImage, ['--pat-size' as string]: livPat.backgroundSize }}
    >
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />
      <div
        ref={panel}
        className={styles.panel}
        data-wide={isFranja || undefined}
        data-comments={comments || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={`${FORMAT_LABEL[item.type]}: ${item.title}`}
      >
        <header className={styles.head}>
          <div className={styles.headLeft}>
            <span className={styles.format}>
              <span className={styles.code}>
                <FormatGlyph type={item.type} size={11} />
                {FORMAT_CODE[item.type]}
              </span>
              {FORMAT_LABEL[item.type]}
              {item.editorial ? <span className={styles.sel}>Selección editorial</span> : null}
            </span>
            {franja ? (
              <button type="button" className={styles.presenta} onClick={() => openLectura(franja.slug)}>
                <span className={styles.bandMark} />
                {franjaAttributionPrefix(franja.franjaKind!)} · {franja.title}
              </button>
            ) : null}
          </div>
          <div className={styles.actions}>
            {!isFranja ? (
              <button type="button" className={styles.action} onClick={toggleSave} aria-pressed={saved}>
                <Mark name={saved ? 'saved' : 'save'} size={15} />
                <span>{saved ? 'Guardado' : 'Guardar'}</span>
              </button>
            ) : null}
            <button type="button" className={styles.action} onClick={copy}>
              <Mark name={copied ? 'check' : 'share'} size={15} />
              <span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
            </button>
            {!isFranja ? (
              <button type="button" className={styles.action} data-on={comments || undefined} onClick={() => setComments(!comments)} aria-pressed={comments}>
                <Mark name="comments" size={15} />
                <span>Hilo{commentCount ? ` · ${commentCount}` : ''}</span>
              </button>
            ) : null}
            {mine && !isFranja ? (
              <button type="button" className={styles.action} onClick={() => router.push(`/taller/mesa?editar=${item.id}`)}>
                <span>Editar</span>
              </button>
            ) : null}
            {isAdmin && !isFranja ? (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  dispatch({ t: 'pin', itemId: item.id, on: !item.pinned, at: new Date().toISOString() })
                  notify(item.pinned ? 'Quitada de portada.' : 'En portada.')
                }}
              >
                <Mark name="pin" size={14} />
                <span>{item.pinned ? 'Quitar de portada' : 'A portada'}</span>
              </button>
            ) : null}
            {me && !mine && !isFranja ? (
              <button type="button" className={styles.icon} onClick={() => openReport({ type: 'item', id: item.id, label: item.title })} title="Reportar" aria-label="Reportar">
                <Mark name="flag" size={15} />
              </button>
            ) : null}
            {canDelete && !isFranja ? (
              <button type="button" className={styles.icon} onClick={remove} title="Borrar" aria-label="Borrar pieza">
                <Mark name="close" size={13} />
                <span className={styles.danger}>Borrar</span>
              </button>
            ) : null}
            <button type="button" className={styles.close} onClick={close} aria-label="Cerrar (Esc)">
              <Mark name="close" size={16} />
              <kbd>Esc</kbd>
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <div ref={scroller} className={styles.scroll} data-lenis-prevent="">
            {children}
          </div>
          {comments && !isFranja ? (
            <aside className={styles.thread} aria-label="Hilo de comentarios">
              <Hilo item={item} focusComment={focusComment} onClose={() => setComments(false)} />
            </aside>
          ) : null}
        </div>
        <span className={styles.energy} aria-hidden="true" />
      </div>
    </div>,
    document.body,
  )
}
