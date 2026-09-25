'use client'

/**
 * Noticia — one step. The hard news first; image, resumen, contexto and
 * encuesta live behind one optional disclosure (it opens itself when a
 * review link points inside it).
 */

import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Mark } from '@/components/kit/Glyph'
import type { FormApi } from '../context'
import { FIELD_ID, type StepId } from '../model'
import { Seccion } from '../fields/bits'
import { Texto } from '../fields/Texto'
import { Titulo } from './Titulo'
import { need, sharedSection } from './shared'
import f from '../fields/fields.module.css'

export function FormNoticia({ api, step }: { api: FormApi; step: StepId }) {
  const { item, patch, env } = api
  const inner = env.plan.filter((s) => s.step === step && s.disclosure)
  const innerKeys = inner.map((s) => s.key).join(',')
  const wanted = !!env.reveal && innerKeys.split(',').includes(env.reveal.key)
  const [open, setOpen] = useState(() => wanted || !!(item.imageUrl || item.excerpt || item.entities?.length || item.franjaRefs?.length || item.links?.length || item.poll))
  const body = useRef<HTMLDivElement>(null)

  // A review link pointing inside the disclosure opens it.
  const [seenReveal, setSeenReveal] = useState(env.reveal)
  if (seenReveal !== env.reveal) {
    setSeenReveal(env.reveal)
    if (wanted) setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !body.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(body.current, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'height,opacity' })
  }, [open])

  return (
    <>
      {env.plan
        .filter((s) => s.step === step && !s.disclosure)
        .map((def) => {
          if (def.key === 'titulo')
            return (
              <Seccion key={def.key} def={def} need={need(api, def.key)}>
                <Titulo api={api} placeholder="Qué pasó, en una línea" sub={null} />
              </Seccion>
            )
          if (def.key === 'texto')
            return (
              <Seccion key={def.key} def={def} hint="Quién, qué, cuándo y dónde. Párrafos breves; la fuente, enlazada. Sin opinión: para eso está la columna.">
                <Texto
                  id={FIELD_ID.body}
                  label="Texto de la noticia"
                  value={item.bodyPreview ?? ''}
                  onChange={(bodyPreview) => patch({ bodyPreview })}
                  counter
                  paragraphs
                  placeholder="El hecho principal: qué pasó, quién participa, cuándo y dónde…"
                  helper="Deja una línea en blanco entre párrafos. ⌘K enlaza la fuente."
                />
              </Seccion>
            )
          return sharedSection(def, api)
        })}

      <div className={f.seccion} style={{ paddingBottom: open ? 0 : 38 }}>
        <button type="button" className={f.switch} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className={f.switchText}>
            <span className={f.switchLabel}>Imagen, resumen, contexto y encuesta</span>
            <span className={f.switchHint}>Opcional. Una noticia puede salir sin nada de esto.</span>
          </span>
          <span style={{ display: 'grid', transform: open ? 'rotate(45deg)' : undefined, transition: 'transform 420ms var(--ease-materia)' }}>
            <Mark name="plus" size={16} />
          </span>
        </button>
      </div>
      {open ? <div ref={body}>{inner.map((def) => sharedSection(def, api))}</div> : null}
    </>
  )
}
