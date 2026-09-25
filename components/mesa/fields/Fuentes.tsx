'use client'

/**
 * FUENTES — where the audio lives. Paste a link and the platform is read
 * from it; SoundCloud, YouTube and Spotify play inside Gradiente, Bandcamp
 * and Mixcloud open on their own site. Several links pasted at once split
 * into rows.
 */

import { useRef } from 'react'
import type { EmbedPlatform, MixEmbed } from '@/lib/types'
import { PLATFORM_LABEL, PLAYABLE } from '@/lib/store/player'
import { Mark } from '@/components/kit/Glyph'
import { detectPlatform, usableUrl } from '../model'
import { IconBtn } from './bits'
import f from './fields.module.css'

const ORDER: EmbedPlatform[] = ['soundcloud', 'youtube', 'spotify', 'bandcamp', 'mixcloud']

export function Fuentes({ value, onChange, id, compact }: { value: MixEmbed[]; onChange: (v: MixEmbed[]) => void; id?: string; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const rows: MixEmbed[] = value.length ? value : [{ platform: 'soundcloud', url: '' }]
  const update = (i: number, p: Partial<MixEmbed>) => onChange(rows.map((e, k) => (k === i ? { ...e, ...p } : e)))

  return (
    <div ref={root} className={f.stack} style={{ gap: 10 }}>
      <div className={f.rows}>
        {rows.map((e, i) => {
          const detected = e.url.trim() ? detectPlatform(e.url) : null
          const ok = usableUrl(e.url)
          const plays = PLAYABLE.includes(e.platform)
          return (
            <div key={i} className={f.stack} style={{ gap: 6 }}>
              <div className={f.rowLine} style={{ gridTemplateColumns: compact ? 'minmax(0, 1fr) 130px auto' : 'minmax(0, 1fr) 150px auto' }}>
                <input
                  id={i === 0 ? id : undefined}
                  className={f.cell}
                  type="url"
                  value={e.url}
                  data-bad={e.url.trim() && !ok ? '' : undefined}
                  placeholder={i === 0 ? 'https://soundcloud.com/…/…' : 'Otra fuente: https://…'}
                  aria-label={i === 0 ? 'Enlace del audio' : `Fuente ${i + 1}`}
                  onChange={(ev) => {
                    const url = ev.target.value
                    update(i, { url, platform: detectPlatform(url) ?? e.platform })
                  }}
                  onPaste={(ev) => {
                    const urls = ev.clipboardData.getData('text').trim().split(/\s+/).filter(usableUrl)
                    if (urls.length < 2) return
                    ev.preventDefault()
                    const next = rows.slice()
                    next.splice(i, 1, ...urls.map((url) => ({ url, platform: detectPlatform(url) ?? ('soundcloud' as const) })))
                    onChange(next)
                  }}
                />
                <select
                  className={f.cell}
                  value={e.platform}
                  aria-label={`Plataforma de la fuente ${i + 1}`}
                  onChange={(ev) => update(i, { platform: ev.target.value as EmbedPlatform })}
                >
                  {ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PLATFORM_LABEL[p]}
                    </option>
                  ))}
                </select>
                <IconBtn label={`Quitar fuente ${i + 1}`} onClick={() => onChange(rows.filter((_, k) => k !== i).filter((x) => x.url.trim()))} disabled={!e.url && rows.length === 1}>
                  <Mark name="close" size={12} />
                </IconBtn>
              </div>
              {e.url.trim() ? (
                <p className={f.note} style={{ paddingLeft: 2 }}>
                  {!ok
                    ? 'Incluye la dirección completa, empezando por https://'
                    : detected
                      ? `${PLATFORM_LABEL[detected]} detectado · ${plays ? 'suena dentro de Gradiente, en la consola' : 'se abre en su sitio'}`
                      : `Plataforma sin reconocer · se tratará como ${PLATFORM_LABEL[e.platform]}`}
                  {ok ? (
                    <>
                      {' · '}
                      <a className={f.textBtn} href={e.url} target="_blank" rel="noopener noreferrer">
                        Probar ↗
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {rows[rows.length - 1].url.trim() ? (
        <button
          type="button"
          className={f.add}
          onClick={() => {
            onChange([...rows, { platform: 'soundcloud', url: '' }])
            requestAnimationFrame(() => {
              const inputs = root.current?.querySelectorAll<HTMLInputElement>('input[type="url"]')
              inputs?.[inputs.length - 1]?.focus()
            })
          }}
        >
          <Mark name="plus" size={13} /> Otra fuente
        </button>
      ) : null}
      {!compact ? <p className={f.note}>Puedes pegar varios enlaces a la vez, uno por línea.</p> : null}
    </div>
  )
}
