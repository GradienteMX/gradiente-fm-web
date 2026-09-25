'use client'

/**
 * TRACKLIST — credit the artists. Paste the whole list in one go (it reads
 * «01. Artista - Tema (134)», «Artista — Tema 134 BPM», «Artista - Tema») and
 * tells you how many tracks it found before importing; rows stay editable.
 */

import { useRef, useState } from 'react'
import type { MixTrack } from '@/lib/types'
import { Mark } from '@/components/kit/Glyph'
import { parseTracklist } from '../model'
import { IconBtn } from './bits'
import f from './fields.module.css'

export function Tracklist({ value, onChange }: { value: MixTrack[]; onChange: (v: MixTrack[]) => void }) {
  const [pasting, setPasting] = useState(value.length === 0)
  const [buffer, setBuffer] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const detected = parseTracklist(buffer)

  const focusRow = (i: number) =>
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(`[data-row="${i}"] input`)?.focus())

  const update = (i: number, p: Partial<MixTrack>) => onChange(value.map((t, k) => (k === i ? { ...t, ...p } : t)))
  const add = () => {
    onChange([...value, { artist: '', title: '' }])
    focusRow(value.length)
  }
  const importAll = () => {
    if (!detected.length) return
    const kept = value.filter((t) => t.artist.trim() || t.title.trim())
    onChange([...kept, ...detected])
    setBuffer('')
    setPasting(false)
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    focusRow(j)
  }

  /** Enter walks down the rows; on the last one it opens a new row. */
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i === value.length - 1) add()
    else focusRow(i + 1)
  }

  const bpms = value.map((t) => t.bpm).filter((b): b is number => typeof b === 'number')

  return (
    <div ref={root} className={f.stack} style={{ gap: 12 }}>
      <div className={f.inline} style={{ justifyContent: 'space-between' }}>
        <span className={f.label}>
          Temas · {value.length}
          {bpms.length ? ` · ${Math.min(...bpms)}–${Math.max(...bpms)} BPM` : ''}
        </span>
        <button type="button" className={f.textBtn} onClick={() => setPasting((p) => !p)} aria-expanded={pasting}>
          {pasting ? 'Cerrar pegado' : 'Pegar una lista'}
        </button>
      </div>

      {pasting ? (
        <div className={f.panel}>
          <p className={f.note}>
            Una pista por línea. Reconoce <span className={f.mono}>01. Artista - Tema (134)</span>, <span className={f.mono}>Artista — Tema 134 BPM</span> y{' '}
            <span className={f.mono}>Artista - Tema</span>.
          </p>
          <textarea
            className={f.cell}
            style={{ height: 'auto', minHeight: 150, padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            placeholder={'01. Artista - Tema (134)\n02. Artista - Tema (135)\n03. Artista - Tema (138)'}
            aria-label="Tracklist para importar"
          />
          <div className={f.inline} style={{ justifyContent: 'space-between' }}>
            <span className={f.label} aria-live="polite">
              {detected.length ? `${detected.length} ${detected.length === 1 ? 'pista detectada' : 'pistas detectadas'}` : 'Sin pistas todavía'}
            </span>
            <div className={f.inline}>
              <button
                type="button"
                className={f.textBtn}
                onClick={() => {
                  setBuffer('')
                  setPasting(false)
                }}
              >
                Cancelar
              </button>
              <button type="button" className={f.add} onClick={importAll} disabled={!detected.length}>
                Importar {detected.length ? detected.length : ''}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {value.length ? (
        <div className={f.rows}>
          {value.map((t, i) => (
            <div key={i} data-row={i} className={f.rowLine} style={{ gridTemplateColumns: '24px minmax(0, 1fr) minmax(0, 1.3fr) 76px auto auto auto' }}>
              <span className={f.idx}>{String(i + 1).padStart(2, '0')}</span>
              <input
                className={f.cell}
                value={t.artist}
                placeholder="Artista"
                aria-label={`Artista del tema ${i + 1}`}
                onChange={(e) => update(i, { artist: e.target.value })}
                onPaste={(e) => {
                  const lines = e.clipboardData.getData('text').split(/\r?\n/).filter((l) => l.trim())
                  if (lines.length < 2) return
                  e.preventDefault()
                  const parsed = parseTracklist(lines.join('\n'))
                  if (!parsed.length) return
                  const next = value.slice()
                  next.splice(i, 1, ...parsed)
                  onChange(next)
                }}
                onKeyDown={(e) => onEnter(e, i)}
              />
              <input
                className={f.cell}
                value={t.title}
                placeholder="Tema"
                aria-label={`Tema ${i + 1}`}
                onChange={(e) => update(i, { title: e.target.value })}
                onKeyDown={(e) => onEnter(e, i)}
              />
              <input
                className={f.cell}
                inputMode="numeric"
                value={t.bpm ?? ''}
                placeholder="BPM"
                aria-label={`BPM del tema ${i + 1}`}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                  update(i, { bpm: Number.isFinite(n) ? n : undefined })
                }}
              />
              <IconBtn label={`Subir tema ${i + 1}`} onClick={() => move(i, -1)} disabled={i === 0}>
                <span aria-hidden="true">↑</span>
              </IconBtn>
              <IconBtn label={`Bajar tema ${i + 1}`} onClick={() => move(i, 1)} disabled={i === value.length - 1}>
                <span aria-hidden="true">↓</span>
              </IconBtn>
              <IconBtn label={`Quitar tema ${i + 1}`} onClick={() => onChange(value.filter((_, k) => k !== i))}>
                <Mark name="close" size={12} />
              </IconBtn>
            </div>
          ))}
        </div>
      ) : !pasting ? (
        <p className={f.note}>Sin tracklist. Es opcional: algunas sesiones no la publican.</p>
      ) : null}

      <button type="button" className={f.add} onClick={add}>
        <Mark name="plus" size={13} /> Tema
      </button>
    </div>
  )
}
