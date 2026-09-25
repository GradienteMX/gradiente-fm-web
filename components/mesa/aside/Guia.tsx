'use client'

/**
 * GUÍA — how to shape this format, step by step, with the user guide's
 * target lengths and a live count against them. Advice, never a gate.
 */

import type { ContentItem } from '@/lib/types'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { FORMATO_INFO, readMinutes, usableUrl, validIso, wordsOf, type Formato, type StepId } from '../model'
import s from './aside.module.css'

interface Guide {
  title: string
  tips: [string, string, string]
  note: string
}

const GUIDES: Record<Formato, Guide> = {
  articulo: {
    title: 'Dale forma a tu historia',
    tips: ['Abre con una escena o una idea.', 'Usa secciones para cambiar de tema.', 'Intercala una imagen o una voz.'],
    note: 'Una cita destaca una voz; una sección ayuda a orientarse. Úsalas cuando aporten a la historia.',
  },
  editorial: {
    title: 'Una idea desde la redacción',
    tips: ['Presenta el tema y tu postura.', 'Desarrolla argumentos con contexto.', 'Cierra con una idea para discutir.'],
    note: 'Distingue los hechos de la postura editorial. Enlaza las fuentes que sostienen tus argumentos.',
  },
  opinion: {
    title: 'Haz visible tu argumento',
    tips: ['Plantea una postura concreta.', 'Sostén tu idea con ejemplos.', 'Cierra con una reflexión propia.'],
    note: 'La negrita para una idea clave; la cursiva para dar énfasis. Los enlaces amplían el contexto.',
  },
  noticia: {
    title: 'Una noticia que se entiende',
    tips: ['Di qué ocurrió en el titular.', 'Responde quién, cuándo y dónde.', 'Incluye la fuente de la información.'],
    note: 'Párrafos breves. La imagen, el resumen y el contexto son opcionales y están debajo del texto.',
  },
  review: {
    title: 'De la escucha a la crítica',
    tips: ['Identifica la obra y a quien la hizo.', 'Describe detalles que escuchaste.', 'Explica tu lectura de la obra.'],
    note: 'Un ejemplo concreto dice más que un adjetivo. Aquí no hay estrellas ni puntuaciones: hay lectura.',
  },
  evento: {
    title: 'Una invitación completa',
    tips: ['Fecha, hora y lugar reconocibles.', 'Cartel y nombres de quienes participan.', 'Entradas y detalles para llegar.'],
    note: 'El cartel acompaña los datos: escribe también la fecha, el lugar y los artistas para que se puedan consultar.',
  },
  mix: {
    title: 'Prepara la escucha',
    tips: ['Pega y comprueba el enlace de audio.', 'Cuenta quién toca y qué vamos a oír.', 'Añade la lista de temas si la tienes.'],
    note: 'El enlace es la pieza central. La lista de temas da crédito a los artistas; puedes añadirla después.',
  },
  listicle: {
    title: 'Una selección con criterio',
    tips: ['Explica qué conecta las obras.', 'Una entrada por disco o tema.', 'Tu comentario y dónde escucharlo.'],
    note: 'Si dudas del formato, escoge el más corto que sirva. Una lista de tus discos favoritos siempre sirve.',
  },
}

const PRESENTING: Guide = {
  title: 'Presenta tu pieza',
  tips: ['Una imagen legible incluso en pequeño.', 'Un resumen que invite a abrirla.', 'La energía en el horizonte; los géneros, aparte.'],
  note: 'La tarjeta es una puerta de entrada. En reposo es un cartel; al pasar el cursor, muestra el resto.',
}

const DETAILS: Guide = {
  title: 'Contexto con propósito',
  tips: ['Cita una fuente cuando amplíe una idea.', 'Notas solo donde hagan falta.', 'Una encuesta, si abre conversación.'],
  note: 'Todo esto es opcional. Puedes pasar a revisar sin llenarlo.',
}

const EVENT_STEPS: Partial<Record<StepId, Guide>> = {
  cartel: {
    title: 'El cartel y la gente',
    tips: ['Un cartel legible incluso en pequeño.', 'Los nombres en texto, uno por línea.', 'Una línea que invite a la noche.'],
    note: 'Los nombres escritos se leen, se buscan y enlazan a sus fichas; el cartel solo se mira.',
  },
  ambiente: {
    title: 'Para llegar y saber qué esperar',
    tips: ['La energía de la noche, no la del género.', 'Precio y boletos claros.', 'Vincula el venue y la promotora.'],
    note: 'Los boletos son una salida explícita: se abren fuera de Gradiente.',
  },
}

function guideFor(t: Formato, step: StepId): Guide {
  if (t === 'evento' && EVENT_STEPS[step]) return EVENT_STEPS[step]!
  if (step === 'portada') return PRESENTING
  if (step === 'detalles') return DETAILS
  return GUIDES[t]
}

export function Guia({ item, type, step, onPreview, onJump }: { item: ContentItem; type: Formato; step: StepId; onPreview: () => void; onJump: (blockIndex: number) => void }) {
  const g = guideFor(type, step)
  const info = FORMATO_INFO[type]
  const words = wordsOf(item)
  const minutes = readMinutes(words)
  const outline = type === 'articulo' && step === 'escribir' ? (item.articleBody ?? []).map((b, i) => ({ b, i })).filter(({ b }) => b.kind === 'h2' || b.kind === 'h3') : []

  return (
    <section className={s.guia} aria-label={`Guía de ${FORMAT_LABEL[type].toLowerCase()}`}>
      <div className={s.guiaHead}>
        <span className={s.guiaFormat}>
          <FormatGlyph type={type} size={13} /> {FORMAT_LABEL[type]} · {info.que}
        </span>
        <h2 className={s.guiaTitle}>{g.title}</h2>
      </div>

      <ol className={s.tips}>
        {g.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <p className={s.guiaNote}>{g.note}</p>

      <Largo item={item} type={type} words={words} />

      {minutes && type !== 'evento' && type !== 'mix' ? (
        <p className={s.meterNote}>
          Lectura estimada: <b style={{ color: 'var(--ink)' }}>{minutes} min</b>
        </p>
      ) : null}

      {outline.length ? (
        <nav className={s.outline} aria-label="Secciones de tu pieza">
          <span className="label" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>
            En esta pieza
          </span>
          {outline.map(({ b, i }, n) => (
            <button key={i} type="button" onClick={() => onJump(i)}>
              <span>{b.kind === 'h2' ? `§${String(outline.slice(0, n + 1).filter((x) => x.b.kind === 'h2').length).padStart(2, '0')}` : '·'}</span>
              <span>{'text' in b && b.text ? b.text : 'Sección sin título'}</span>
            </button>
          ))}
        </nav>
      ) : null}

      <button type="button" className={s.seeBtn} onClick={onPreview}>
        Ver mi pieza <Mark name="arrow" size={14} />
      </button>
    </section>
  )
}

/** Target length from the user guide, measured live — or the format's own yardstick. */
function Largo({ item, type, words }: { item: ContentItem; type: Formato; words: number }) {
  const info = FORMATO_INFO[type]
  if (info.target) {
    const [lo, hi] = info.target
    const top = hi * 1.25
    const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`
    const note =
      words === 0 ? `Largo sugerido: ${info.largo}.` : words < lo ? `Faltan unas ${(lo - words).toLocaleString('es-MX')} para el largo sugerido.` : words <= hi ? 'Dentro del largo sugerido.' : 'Pasa del largo sugerido; está bien si lo necesita.'
    return (
      <div className={s.meter}>
        <div className={s.meterHead}>
          <span>
            <b>{words.toLocaleString('es-MX')}</b> {words === 1 ? 'palabra' : 'palabras'}
          </span>
          <span>{info.largo}</span>
        </div>
        <div className={s.bar} role="img" aria-label={`${words} palabras de ${info.largo}`}>
          <span className={s.zone} style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
          <span className={s.fill} style={{ width: pct(words) }} />
        </div>
        <p className={s.meterNote}>{note}</p>
      </div>
    )
  }
  const checks: Array<[string, boolean]> =
    type === 'evento'
      ? [
          ['Fecha', validIso(item.date)],
          [`Line-up${item.artists?.length ? ` · ${item.artists.length}` : ''}`, !!item.artists?.length],
          ['Boletos o precio', usableUrl(item.ticketUrl) || !!item.price?.trim()],
        ]
      : type === 'mix'
        ? [
            ['Audio', (item.embeds ?? []).some((e) => usableUrl(e.url))],
            [`Tracklist${item.tracklist?.length ? ` · ${item.tracklist.length} temas` : ''}`, !!item.tracklist?.length],
            ['BPM', !!item.bpmRange?.trim() || (item.tracklist ?? []).some((t) => typeof t.bpm === 'number')],
          ]
        : (() => {
            const n = (item.articleBody ?? []).filter((b) => b.kind === 'track').length
            return [
              [`Entradas${n ? ` · ${n}` : ''}`, n > 0],
              ['Una introducción', (item.articleBody ?? []).some((b) => b.kind === 'lede' && b.text.trim())],
              ['Audio en las entradas', (item.articleBody ?? []).some((b) => b.kind === 'track' && (b.embeds ?? []).some((e) => usableUrl(e.url)))],
            ] as Array<[string, boolean]>
          })()
  return (
    <div className={s.meter}>
      <div className={s.meterHead}>
        <span>Largo sugerido</span>
        <span>{info.largo}</span>
      </div>
      <ul className={s.checks}>
        {checks.map(([label, ok]) => (
          <li key={label} data-ok={ok || undefined}>
            <span>{ok ? <Mark name="check" size={11} /> : null}</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
