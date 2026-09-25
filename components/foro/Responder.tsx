'use client'

/**
 * RESPONDER — the reply line at the foot of a thread. Flat, chronological,
 * one optional image. `>>id` cites a post (CITAR anywhere inserts it); the
 * cited authors are listed above the field by name, never by id.
 * Enter publishes · Shift+Enter breaks the line · Esc clears.
 */

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { ForoReply, ForoThread } from '@/lib/types'
import { newUuid, useDispatch } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { flare } from '@/components/stage/api'
import { Mark } from '@/components/kit/Glyph'
import { Avatar } from '@/components/kit/Persona'
import { FlyerPicker } from './Flyers'
import { imageFiles, imageToDataUrl, parseQuotes } from './foro'
import styles from './Responder.module.css'

export interface ResponderHandle {
  cite: (id: string) => void
}

const BODY_MAX = 4000

interface Props {
  ref?: React.Ref<ResponderHandle>
  thread: ForoThread
  postIds: Set<string>
  labelFor: (id: string) => string
  energy: number
  slot: number | null
  onPosted: (id: string) => void
  onQuoteHover: (id: string | null) => void
  onQuoteClick: (id: string) => void
}

export function Responder({ ref, thread, postIds, labelFor, energy, slot, onPosted, onQuoteHover, onQuoteClick }: Props) {
  const me = useMe()
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flyers, setFlyers] = useState(false)
  /** The slot the thread held when the reply went out (the live slot is 01 right after). */
  const [posted, setPosted] = useState<{ at: number; from: number | null } | null>(null)
  const [drag, setDrag] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const closed = Boolean(thread.deletion)
  const quotes = useMemo(() => parseQuotes(text, postIds), [text, postIds])

  useEffect(() => {
    if (posted === null) return
    const t = window.setTimeout(() => setPosted(null), 3600)
    return () => window.clearTimeout(t)
  }, [posted])

  useImperativeHandle(
    ref,
    () => ({
      cite: (id: string) => {
        if (!me) {
          openAccess('Cita y responde en el foro')
          return
        }
        if (closed) return
        const el = ta.current
        const cur = el?.value ?? ''
        const focused = Boolean(el && document.activeElement === el)
        const s = focused && el ? el.selectionStart : cur.length
        const e = focused && el ? el.selectionEnd : cur.length
        const before = cur.slice(0, s)
        const ins = `${before && !/\s$/.test(before) ? ' ' : ''}>>${id} `
        setText(before + ins + cur.slice(e))
        requestAnimationFrame(() => {
          if (!el) return
          el.focus({ preventScroll: true })
          const p = before.length + ins.length
          el.setSelectionRange(p, p)
        })
      },
    }),
    [me, closed, openAccess],
  )

  const attach = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      setImage(await imageToDataUrl(file))
      setFlyers(false)
    } catch {
      setError(`No pudimos leer «${file.name}». Prueba con JPG, PNG o WEBP.`)
    } finally {
      setBusy(false)
    }
  }

  if (!me) {
    return (
      <div className={styles.out}>
        <button type="button" className={styles.enter} onClick={() => openAccess('Responde en el foro')}>
          Entra para responder
        </button>
      </div>
    )
  }

  if (closed) {
    return (
      <div className={styles.out}>
        <p className={styles.closed}>Hilo cerrado por moderación. No se aceptan respuestas nuevas.</p>
      </div>
    )
  }

  const send = () => {
    const body = text.trim()
    if (!body || busy) return
    if (body.length > BODY_MAX) return setError(`Máximo ${BODY_MAX} caracteres.`)
    const at = new Date().toISOString()
    const quoted = parseQuotes(body, postIds)
    const reply: ForoReply = {
      // foro_replies.id is a uuid: minted here, kept by the route (foro.ts § ids).
      id: newUuid(),
      threadId: thread.id,
      authorId: me.id,
      body,
      createdAt: at,
      ...(image ? { imageUrl: image } : {}),
      ...(quoted.length ? { quotedReplyIds: quoted } : {}),
    }
    dispatch({ t: 'reply', reply, at })
    flare(ta.current, energy)
    setText('')
    setImage(null)
    setError(null)
    setFlyers(false)
    setPosted({ at: Date.now(), from: slot })
    onPosted(reply.id)
  }

  const unquote = (id: string) => {
    const re = new RegExp(`>>${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s?`, 'gi')
    setText((t) => t.replace(re, ''))
    onQuoteHover(null)
  }

  const hint =
    posted !== null
      ? posted.from === 1
        ? 'Publicado. El hilo sigue en el lugar 01.'
        : posted.from === null
          ? 'Publicado. El hilo vuelve al muro, lugar 01.'
          : `Publicado. El hilo sube del ${String(posted.from).padStart(2, '0')} al 01 — lo verás al cerrar.`
      : 'Enter publica · Shift+Enter salto · Esc limpia'

  return (
    <div
      className={styles.responder}
      data-drag={drag || undefined}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDrag(false)
      }}
      onDrop={(e) => {
        const f = imageFiles(e.dataTransfer.files)[0]
        setDrag(false)
        if (!f) return
        e.preventDefault()
        void attach(f)
      }}
    >
      {flyers ? (
        <div
          className={styles.flyers}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setFlyers(false)
            }
          }}
        >
          <div className={styles.flyersHead}>
            <span className="label">Flyers de la casa</span>
            <button type="button" className={styles.x} onClick={() => setFlyers(false)} aria-label="Cerrar flyers">
              <Mark name="close" size={12} />
            </button>
          </div>
          <div className={styles.flyersGrid} data-lenis-prevent="">
            <FlyerPicker
              columns={6}
              picked={image ? [image] : []}
              onPick={(src) => {
                setImage((cur) => (cur === src ? null : src))
                setFlyers(false)
                ta.current?.focus({ preventScroll: true })
              }}
            />
          </div>
        </div>
      ) : null}

      {quotes.length ? (
        <div className={styles.quotes}>
          <span className={styles.quotesLabel}>cita a</span>
          {quotes.map((q) => (
            <span key={q} className={styles.quote}>
              <button
                type="button"
                className={styles.quoteName}
                onPointerEnter={() => onQuoteHover(q)}
                onPointerLeave={() => onQuoteHover(null)}
                onFocus={() => onQuoteHover(q)}
                onBlur={() => onQuoteHover(null)}
                onClick={() => onQuoteClick(q)}
              >
                {labelFor(q)}
              </button>
              <button type="button" className={styles.unquote} onClick={() => unquote(q)} aria-label={`Quitar la cita a ${labelFor(q)}`}>
                <Mark name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.field}>
        <span className={styles.me}>
          <Avatar user={me} size={28} />
        </span>
        <textarea
          ref={ta}
          className={styles.input}
          value={text}
          rows={2}
          maxLength={BODY_MAX + 200}
          aria-label="Responder al hilo"
          placeholder={`Responde como @${me.username} · «Citar» en un post agrega >>id`}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError(null)
          }}
          onPaste={(e) => {
            const f = imageFiles(e.clipboardData.files)[0]
            if (f) {
              e.preventDefault()
              void attach(f)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            } else if (e.key === 'Escape' && (text || image || flyers)) {
              e.preventDefault()
              e.stopPropagation()
              setText('')
              setImage(null)
              setFlyers(false)
              setError(null)
            }
          }}
        />
      </div>

      {image || busy ? (
        <div className={styles.attached}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Imagen adjunta" />
          ) : (
            <span className={styles.busy}>Preparando imagen…</span>
          )}
          {image ? (
            <button type="button" className={styles.remove} onClick={() => setImage(null)}>
              <Mark name="close" size={11} />
              Quitar
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.row}>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={() => fileRef.current?.click()} disabled={busy}>
            <Mark name="plus" size={13} />
            Imagen
          </button>
          <button type="button" className={styles.tool} data-on={flyers || undefined} onClick={() => setFlyers((f) => !f)} aria-expanded={flyers}>
            Flyers
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = imageFiles(e.target.files)[0]
              e.target.value = ''
              if (f) void attach(f)
            }}
          />
        </div>
        <span className={styles.hint} data-posted={posted !== null || undefined} aria-live="polite">
          {hint}
          {text.length > BODY_MAX - 400 ? <span className={styles.counter} data-over={text.length > BODY_MAX || undefined}> · {text.length}/{BODY_MAX}</span> : null}
        </span>
        <button type="button" className={styles.send} onClick={send} disabled={!text.trim() || busy}>
          Responder
        </button>
      </div>
    </div>
  )
}
