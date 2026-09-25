'use client'

/**
 * Art picker — chooses from the files actually on disk (/public/flyers for
 * events, /public/franjas for logos). The list comes from the server page,
 * so a new file dropped in the folder shows up without touching code.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useMemo, useState } from 'react'
import { Sheet } from '@/components/kit/Sheet'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { inputClass } from './kit'
import s from './ArtPicker.module.css'

export function ArtPicker({
  open,
  onClose,
  title,
  images,
  current,
  onPick,
  shape = 'portrait',
}: {
  open: boolean
  onClose: () => void
  title: string
  images: string[]
  current?: string | null
  onPick: (url: string | null) => void
  shape?: 'portrait' | 'square'
}) {
  // The body unmounts with the sheet: every opening starts with an empty filter.
  return (
    <Sheet open={open} onClose={onClose} label={title} width={880} variant="center">
      <PickerBody onClose={onClose} title={title} images={images} current={current} onPick={onPick} shape={shape} />
    </Sheet>
  )
}

function PickerBody({
  onClose,
  title,
  images,
  current,
  onPick,
  shape,
}: {
  onClose: () => void
  title: string
  images: string[]
  current?: string | null
  onPick: (url: string | null) => void
  shape: 'portrait' | 'square'
}) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const f = q.trim().toLowerCase()
    return f ? images.filter((u) => u.toLowerCase().includes(f)) : images
  }, [images, q])

  return (
    <div className={s.picker}>
      <header className={s.head}>
        <h2 className={s.title}>{title}</h2>
        <span className={s.count}>
          {list.length} de {images.length} archivos
        </span>
        <button type="button" className={s.close} onClick={onClose} aria-label="Cerrar">
          <Mark name="close" size={16} />
        </button>
      </header>
      <div className={s.tools}>
        <input
          className={inputClass}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por nombre de archivo…"
          aria-label="Filtrar archivos"
        />
        {current ? (
          <Button variant="quiet" size="sm" onClick={() => onPick(null)}>
            Quitar la imagen
          </Button>
        ) : null}
      </div>
      {list.length ? (
        <ul className={s.grid} data-shape={shape}>
          {list.map((url) => {
            const on = url === current
            const name = url.split('/').pop()
            return (
              <li key={url}>
                <button type="button" className={s.cell} data-on={on || undefined} onClick={() => onPick(url)} aria-pressed={on} title={name}>
                  <span className={s.art}>
                    <Image src={url} alt="" fill sizes="160px" />
                  </span>
                  <span className={s.name}>{name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={s.empty}>{images.length ? 'Ningún archivo coincide.' : 'No hay archivos en esta carpeta.'}</p>
      )}
    </div>
  )
}
