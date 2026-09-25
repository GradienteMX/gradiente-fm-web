'use client'

/**
 * PORTADA — cards are posters, so the art matters. There is no upload
 * backend yet: the table offers the seed collection (`/public/flyers`) and a
 * URL field that only accepts what the site can actually render (local paths
 * and the configured remote hosts). It says so instead of failing later.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useCallback, useState } from 'react'
import { Sheet } from '@/components/kit/Sheet'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { TextField } from '@/components/kit/Field'
import { useMesa } from '../context'
import { imageProblem, safeImage } from '../model'
import f from './fields.module.css'

interface Props {
  value: string | undefined
  onChange: (v: string | undefined) => void
  /** Anchor id for readiness jumps (placed on the main action). */
  id?: string
  caption?: { value: string; onChange: (v: string) => void; label?: string }
  label?: string
  emptyText?: string
}

export function Imagen({ value, onChange, id, caption, label = 'Portada', emptyText = 'Sin portada: la tarjeta pintará una placa con su energía.' }: Props) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const src = safeImage(value)
  return (
    <div className={f.image}>
      <div className={f.plate}>
        {src ? <Image src={src} alt={`${label} elegida`} fill sizes="200px" /> : <span className={f.plateEmpty}>{emptyText}</span>}
        <span className={f.plateBand} aria-hidden="true" />
      </div>
      <div className={f.stack} style={{ gap: 16 }}>
        <div className={f.inline}>
          <Button id={id} variant={src ? 'ghost' : 'ink'} onClick={() => setOpen(true)} icon={<Mark name="expand" size={14} />}>
            {src ? 'Cambiar de la colección' : 'Elegir de la colección'}
          </Button>
          {src ? (
            <button type="button" className={f.textBtn} onClick={() => onChange(undefined)}>
              Quitar
            </button>
          ) : null}
        </div>
        <UrlField value={value} onChange={onChange} />
        {caption ? (
          <TextField
            label={caption.label ?? 'Pie o crédito'}
            value={caption.value}
            onChange={(e) => caption.onChange(e.target.value)}
            placeholder="Foto: … · o una línea de contexto"
          />
        ) : null}
      </div>
      <Coleccion open={open} current={src} onClose={close} onPick={(v) => { onChange(v); setOpen(false) }} />
    </div>
  )
}

/** Compact variant for block images and list covers. */
export function ImagenMini({ value, onChange, label }: { value: string | undefined; onChange: (v: string | undefined) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const src = safeImage(value)
  return (
    <div className={f.inline} style={{ alignItems: 'flex-start', gap: 14 }}>
      <button type="button" className={f.thumbBtn} onClick={() => setOpen(true)} aria-label={`${label}: elegir de la colección`}>
        {src ? <Image src={src} alt="" fill sizes="64px" /> : <Mark name="plus" size={16} />}
      </button>
      <div className={f.stack} style={{ flex: 1 }}>
        <UrlField value={value} onChange={onChange} compact />
        {src ? (
          <button type="button" className={f.textBtn} style={{ alignSelf: 'flex-start' }} onClick={() => onChange(undefined)}>
            Quitar imagen
          </button>
        ) : null}
      </div>
      <Coleccion open={open} current={src} onClose={close} onPick={(v) => { onChange(v); setOpen(false) }} />
    </div>
  )
}

function UrlField({ value, onChange, compact }: { value: string | undefined; onChange: (v: string | undefined) => void; compact?: boolean }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const current = (value ?? '').trim()
  const use = () => {
    const v = draft.trim()
    if (!v) return
    const p = imageProblem(v)
    if (p) return setError(p)
    onChange(v)
    setDraft('')
    setError(null)
  }
  return (
    <div className={f.stack} style={{ gap: 6 }}>
      {!compact ? <span className={f.label}>…o una dirección</span> : null}
      <div className={f.rowLine} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
        <input
          className={f.cell}
          value={draft}
          data-bad={error ? '' : undefined}
          placeholder={current && !compact ? current : '/flyers/rf-012.jpg o https://images.ra.co/…'}
          aria-label="Dirección de la imagen"
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              use()
            }
          }}
        />
        <button type="button" className={f.add} onClick={use} disabled={!draft.trim()} style={{ alignSelf: 'stretch' }}>
          Usar
        </button>
      </div>
      {error ? (
        <p className={f.warn} role="alert">
          {error}
        </p>
      ) : !compact ? (
        <p className={f.note}>Sin subida de archivos por ahora: la colección local o imágenes de images.ra.co / i.ytimg.com.</p>
      ) : null}
    </div>
  )
}

function Coleccion({ open, current, onClose, onPick }: { open: boolean; current?: string; onClose: () => void; onPick: (src: string) => void }) {
  const { flyers } = useMesa()
  return (
    <Sheet open={open} onClose={onClose} label="Elegir una imagen de la colección" variant="right" width={780}>
      <div className={f.sheetBody}>
      <div className={f.sheetHead}>
        <div className={f.sheetTitleRow}>
          <h2 className={f.sheetTitle}>La colección</h2>
          <Button variant="quiet" onClick={onClose} icon={<Mark name="close" size={14} />}>
            Cerrar
          </Button>
        </div>
        <p className={f.note}>
          {flyers.length} carteles y portadas del archivo, servidos desde <span className={f.mono}>/flyers</span>. La subida de archivos llega después.
        </p>
      </div>
      <div className={f.gallery}>
        {flyers.map((name) => {
          const src = `/flyers/${name}`
          const on = current === src
          return (
            <button key={name} type="button" className={f.flyer} aria-pressed={on} onClick={() => onPick(src)} title={name}>
              <Image src={src} alt={name.replace(/\.\w+$/, '')} fill sizes="130px" />
              {on ? (
                <span className={f.flyerMark}>
                  <Mark name="check" size={12} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      </div>
    </Sheet>
  )
}
