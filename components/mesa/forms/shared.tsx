'use client'

/**
 * Sections every format shares: portada, resumen, energía, géneros y
 * etiquetas, vínculos, firma y enlace, encuesta. Formats compose these with
 * their own sections (per-type forms, shared parts).
 */

import type { ReactNode } from 'react'
import type { EntityKind } from '@/lib/types'
import { TextArea, TextField } from '@/components/kit/Field'
import type { FormApi } from '../context'
import { FIELD_ID, readMinutes, wordsOf, type PlannedSection, type SectionKey } from '../model'
import { Seccion } from '../fields/bits'
import { Imagen } from '../fields/Imagen'
import { Energia } from '../fields/Energia'
import { Generos } from '../fields/Generos'
import { Etiquetas } from '../fields/Etiquetas'
import { Entidades, FranjasSobre } from '../fields/Vinculos'
import { Enlaces } from '../fields/Enlaces'
import { Encuesta } from '../fields/Encuesta'
import { Slug } from '../fields/Slug'
import { Fuentes } from '../fields/Fuentes'
import f from '../fields/fields.module.css'

const KINDS: Record<string, EntityKind[]> = {
  evento: ['venue', 'promoter', 'artist'],
  mix: ['artist', 'label', 'venue'],
  default: ['artist', 'label'],
}

const LINK_PRESETS: Record<string, string[]> = {
  mix: ['Bandcamp', 'Discogs', 'Sitio'],
  review: ['Bandcamp', 'Discogs', 'Fuente'],
  listicle: ['Bandcamp', 'Spotify', 'Sitio', 'Fuente'],
  noticia: ['Fuente', 'Sitio'],
  default: ['Fuente', 'Sitio', 'Referencia'],
}

export const HINTS: Partial<Record<SectionKey, ReactNode>> = {
  portada: 'La tarjeta es un cartel: la imagen manda. Elige una que se lea incluso en pequeño.',
  cartel: 'El cartel es la tarjeta. Los datos van aparte, para que se puedan leer y buscar.',
  resumen: 'Aparece en la cara densa de la tarjeta, cuando alguien se detiene sobre ella.',
  energia: 'Ubica tu pieza por energía, no por género. Hay techno que medita y jazz que detona.',
  clasificacion: 'Los géneros ubican; las etiquetas conectan piezas entre sí. Al menos uno de cada.',
  vinculos: 'A quién o a qué toca tu pieza. Aparece en su contexto y alimenta el mapa.',
  encuesta: 'Una pregunta para quien lee. Los resultados se ven solo después de votar.',
}

export function need(api: FormApi, key: SectionKey): boolean {
  return api.env.needs.some((n) => n.section === key && n.level === 'hard' && !n.done)
}

/** Renders a shared section, or null if the key belongs to the format. */
export function sharedSection(def: PlannedSection, api: FormApi): ReactNode | null {
  const { item, patch, env } = api
  const t = env.type
  const wrap = (children: ReactNode, hint: ReactNode = HINTS[def.key]) => (
    <Seccion key={def.key} def={def} need={need(api, def.key)} hint={hint}>
      {children}
    </Seccion>
  )

  switch (def.key) {
    case 'portada':
    case 'cartel':
      return wrap(
        <Imagen
          id={FIELD_ID.cover}
          label={def.key === 'cartel' ? 'Cartel' : 'Portada'}
          value={item.imageUrl}
          onChange={(imageUrl) => patch({ imageUrl })}
          emptyText={def.key === 'cartel' ? 'Sin cartel: la tarjeta pintará una placa con la energía de la noche.' : undefined}
          caption={{ value: item.heroCaption ?? '', onChange: (heroCaption) => patch({ heroCaption }), label: 'Pie o crédito de la imagen' }}
        />,
      )
    case 'resumen':
      return wrap(
        <TextArea
          label="Resumen para la tarjeta"
          value={item.excerpt ?? ''}
          onChange={(e) => patch({ excerpt: e.target.value })}
          rows={3}
          placeholder={t === 'evento' ? 'Una línea que invite a la noche…' : 'En una o dos frases, qué encontrará quien la abra…'}
          counter={{ value: (item.excerpt ?? '').length, max: 280 }}
          hint={(item.excerpt ?? '').length > 280 ? 'Más de 280 caracteres se corta en la tarjeta.' : undefined}
        />,
      )
    case 'energia':
      return wrap(
        <Energia
          id={FIELD_ID.energy}
          min={item.vibeMin}
          max={item.vibeMax}
          prior={env.prior}
          onLive={env.onEnergyLive}
          onChange={(vibeMin, vibeMax) => patch({ vibeMin, vibeMax })}
        />,
      )
    case 'clasificacion':
      return wrap(
        <div className={f.stack} style={{ gap: 30 }}>
          <Generos id={FIELD_ID.genres} value={item.genres} onChange={(genres) => patch({ genres })} />
          <Etiquetas id={FIELD_ID.tags} value={item.tags} onChange={(tags) => patch({ tags })} />
        </div>,
      )
    case 'vinculos':
      return wrap(
        <div className={f.stack} style={{ gap: 28 }}>
          <Entidades id={FIELD_ID.context} kinds={KINDS[t] ?? KINDS.default} value={item.entities ?? []} onChange={(entities) => patch({ entities })} />
          <FranjasSobre value={item.franjaRefs ?? []} onChange={(franjaRefs) => patch({ franjaRefs })} />
          {t === 'review' ? (
            <div className={f.stack} style={{ gap: 10 }}>
              <span className={f.label}>Dónde escuchar la obra</span>
              <Fuentes compact value={item.embeds ?? []} onChange={(embeds) => patch({ embeds })} />
            </div>
          ) : null}
          {t !== 'evento' ? <Enlaces value={item.links ?? []} onChange={(links) => patch({ links })} presets={LINK_PRESETS[t] ?? LINK_PRESETS.default} /> : null}
        </div>,
      )
    case 'firma': {
      const slug = <Slug id={FIELD_ID.slug} value={item.slug} onChange={(s) => patch({ slug: s })} />
      if (t === 'evento' || t === 'mix' || t === 'noticia') return wrap(slug, 'Dónde vive la pieza. Se escribe sola a partir del título.')
      const words = wordsOf(item)
      const suggested = readMinutes(words)
      return wrap(
        <>
          <div className={f.row2}>
            <TextField
              label="Firma"
              value={item.author ?? ''}
              onChange={(e) => patch({ author: e.target.value })}
              placeholder={env.me.displayName}
              hint={`Se lee «Por ${item.author?.trim() || '…'}». Tu credencial @${env.me.username} acompaña la pieza siempre.`}
            />
            <div className={f.stack} style={{ gap: 7 }}>
              <TextField
                label="Minutos de lectura"
                inputMode="numeric"
                value={item.readTime ?? ''}
                placeholder={suggested ? String(suggested) : '—'}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                  patch({ readTime: Number.isFinite(n) && n > 0 ? n : undefined })
                }}
              />
              <p className={f.note}>
                {suggested ? (
                  <>
                    {words.toLocaleString('es-MX')} palabras → <b>{suggested} min</b>.{' '}
                    {item.readTime !== suggested ? (
                      <button type="button" className={f.textBtn} onClick={() => patch({ readTime: suggested })}>
                        Usar {suggested} min
                      </button>
                    ) : null}
                    {!item.readTime ? ' Si lo dejas vacío, se calcula al publicar.' : null}
                  </>
                ) : (
                  'Se calcula de las palabras cuando escribas.'
                )}
              </p>
            </div>
          </div>
          {slug}
        </>,
        'Cómo firmas y dónde vive la pieza.',
      )
    }
    case 'encuesta':
      return wrap(<Encuesta id={FIELD_ID.poll} item={item} type={t} onChange={(poll) => patch({ poll })} />)
    default:
      return null
  }
}
