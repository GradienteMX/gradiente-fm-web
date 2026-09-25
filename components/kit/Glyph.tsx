/**
 * Pictograms. Format is encoded by shape and by paper STOCK (a pale flat
 * plate, like forms printed on coloured paper) — never by ink hue, which
 * belongs to energy. Circle-and-line geometry on a 20-unit grid, 1.5
 * stroke — a small family in the lineage of '68/'72 Olympic pictograms,
 * not of UI icon packs.
 */

import type { ContentType, UserRank } from '@/lib/types'

interface Props {
  size?: number
  className?: string
  title?: string
}

const S = 1.5

function Svg({ size = 16, className, title, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={S}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export const FORMAT_LABEL: Record<ContentType, string> = {
  evento: 'Evento',
  mix: 'Mix',
  noticia: 'Noticia',
  review: 'Reseña',
  editorial: 'Editorial',
  opinion: 'Opinión',
  articulo: 'Artículo',
  listicle: 'Lista',
  franja: 'Franja',
}

export const FORMAT_PLURAL: Record<ContentType, string> = {
  evento: 'Eventos',
  mix: 'Mixes',
  noticia: 'Noticias',
  review: 'Reseñas',
  editorial: 'Editoriales',
  opinion: 'Opinión',
  articulo: 'Artículos',
  listicle: 'Listas',
  franja: 'Franjas',
}

/** Two-letter codes, set in mono on the format's stock. */
export const FORMAT_CODE: Record<ContentType, string> = {
  evento: 'EV',
  mix: 'MX',
  noticia: 'NT',
  review: 'RS',
  editorial: 'ED',
  opinion: 'OP',
  articulo: 'AR',
  listicle: 'LS',
  franja: 'FR',
}

/** The format's livery colour (CSS custom property) — docs/06-LIBREA.md. */
export const FORMAT_STOCK: Record<ContentType, string> = {
  evento: 'var(--l-ev)',
  mix: 'var(--l-mx)',
  noticia: 'var(--l-nt)',
  review: 'var(--l-rs)',
  editorial: 'var(--l-ed)',
  opinion: 'var(--l-op)',
  articulo: 'var(--l-ar)',
  listicle: 'var(--l-ls)',
  franja: 'var(--l-fr)',
}

/** Ink that reads on the format's livery. */
export const FORMAT_ON: Record<ContentType, string> = {
  evento: 'var(--l-ev-on)',
  mix: 'var(--l-mx-on)',
  noticia: 'var(--l-nt-on)',
  review: 'var(--l-rs-on)',
  editorial: 'var(--l-ed-on)',
  opinion: 'var(--l-op-on)',
  articulo: 'var(--l-ar-on)',
  listicle: 'var(--l-ls-on)',
  franja: 'var(--l-fr-on)',
}

export function FormatGlyph({ type, ...p }: Props & { type: ContentType }) {
  switch (type) {
    case 'evento': // a place in time
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="7" />
          <circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'mix': // a record: grooves around a spindle
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="7.25" />
          <circle cx="10" cy="10" r="4.4" />
          <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'noticia': // a bulletin on the wire
      return (
        <Svg {...p}>
          <circle cx="4" cy="10" r="1.8" fill="currentColor" stroke="none" />
          <path d="M8 10h9" />
        </Svg>
      )
    case 'review': // a judgement: half lit
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'editorial': // the masthead
      return (
        <Svg {...p}>
          <rect x="4" y="4" width="12" height="12" rx="0.6" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'opinion': // a stance
      return (
        <Svg {...p}>
          <path d="M10 3.6 17 16.2H3z" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'articulo': // a long body
      return (
        <Svg {...p}>
          <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h8" />
        </Svg>
      )
    case 'listicle': // a ranked stack
      return (
        <Svg {...p}>
          <circle cx="4.5" cy="5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="10" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="15" r="1.4" fill="currentColor" stroke="none" />
          <path d="M8.5 5h8M8.5 10h6M8.5 15h4" />
        </Svg>
      )
    case 'franja': // a band on the dial
      return (
        <Svg {...p}>
          <rect x="2.5" y="7" width="15" height="6" rx="0.6" />
          <path d="M8 7v6" />
        </Svg>
      )
  }
}

/** Section pictograms — the same 20-unit family, one per channel. */
export function SeccionGlyph({ seccion, ...p }: Props & { seccion: string }) {
  // A format key borrows its own pictogram.
  if (seccion !== 'franja' && seccion in FORMAT_CODE) return <FormatGlyph type={seccion as ContentType} {...p} />
  switch (seccion) {
    case 'campo': // the horizon: a scale and its two caps
      return (
        <Svg {...p}>
          <path d="M2.5 10h15" />
          <path d="M6 5.5v9M14 5.5v9" strokeWidth={2.4} />
        </Svg>
      )
    case 'agenda': // nights on a grid, one lit
      return (
        <Svg {...p}>
          <rect x="3" y="3" width="14" height="14" rx="0.6" />
          <path d="M3 8.5h14M3 12.8h14M7.7 3v14M12.3 3v14" strokeWidth={1} />
          <rect x="12.3" y="12.8" width="4.7" height="4.2" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'mixes':
      return <FormatGlyph type="mix" {...p} />
    case 'lecturas':
      return <FormatGlyph type="articulo" {...p} />
    case 'foro': // posters on a wall, offset
      return (
        <Svg {...p}>
          <rect x="2.5" y="3" width="7" height="7" />
          <rect x="10.5" y="5" width="7" height="7" fill="currentColor" stroke="none" />
          <rect x="4.5" y="11" width="7" height="6" />
        </Svg>
      )
    case 'mapa': // one cell of the territory
      return (
        <Svg {...p}>
          <path d="M10 2.6 16.4 6.3v7.4L10 17.4 3.6 13.7V6.3z" />
          <circle cx="10" cy="10" r="1.8" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'mercado': // a price tag
      return (
        <Svg {...p}>
          <path d="M3.5 10.5 10.5 3.5h6v6l-7 7z" />
          <circle cx="13.6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'taller': // crop marks around a sheet
      return (
        <Svg {...p}>
          <path d="M2.5 6V2.5H6M14 2.5h3.5V6M17.5 14v3.5H14M6 17.5H2.5V14" />
          <rect x="6.5" y="6.5" width="7" height="7" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'central': // a crosshair
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="5.5" />
          <path d="M10 1.5v5M10 13.5v5M1.5 10h5M13.5 10h5" />
        </Svg>
      )
    case 'puerta': // the wheel
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="3" />
          <path d="M10 2v3.5M10 14.5V18M2 10h3.5M14.5 10H18M4.3 4.3l2.5 2.5M13.2 13.2l2.5 2.5M15.7 4.3l-2.5 2.5M6.8 13.2l-2.5 2.5" />
        </Svg>
      )
    case 'credencial': // a card with its chip
      return (
        <Svg {...p}>
          <rect x="2.5" y="4.5" width="15" height="11" rx="1" />
          <rect x="5" y="7.5" width="3.6" height="3" fill="currentColor" stroke="none" />
          <path d="M11 8h4M11 11h3" />
        </Svg>
      )
    case 'entidad': // a name on a bill
      return (
        <Svg {...p}>
          <circle cx="10" cy="7.2" r="3.2" />
          <path d="M3.8 17c.8-3.4 3.3-5.2 6.2-5.2s5.4 1.8 6.2 5.2" />
        </Svg>
      )
    case 'franja':
      return <FormatGlyph type="franja" {...p} />
    default: // la casa: the registration mark
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="4.6" />
          <path d="M10 1.5v17M1.5 10h17" />
        </Svg>
      )
  }
}

export const RANK_LABEL: Record<UserRank, string> = {
  normie: 'NORMIE',
  detonador: 'DETONADOR',
  enigma: 'ENIGMA',
  espectro: 'ESPECTRO',
}

export const RANK_MEANING: Record<UserRank, string> = {
  normie: 'Aún sin textura: menos de dos reacciones recibidas.',
  detonador: 'Lo que escribe prende: la mayoría de sus reacciones son [!].',
  enigma: 'Lo que escribe abre preguntas: la mayoría de sus reacciones son [?].',
  espectro: 'Balance entre señal y duda.',
}

export function RankSigil({ rank, ...p }: Props & { rank: UserRank }) {
  switch (rank) {
    case 'normie':
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="6" />
        </Svg>
      )
    case 'detonador': // a burst
      return (
        <Svg {...p}>
          <path d="M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4M4.7 4.7l2.8 2.8M12.5 12.5l2.8 2.8M15.3 4.7l-2.8 2.8M7.5 12.5l-2.8 2.8" />
        </Svg>
      )
    case 'enigma': // a spiral
      return (
        <Svg {...p}>
          <path d="M10 10.2a1.4 1.4 0 1 1 1.4-1.4 3 3 0 0 1-3 3 4.4 4.4 0 0 1-4.4-4.4A5.8 5.8 0 0 1 9.8 1.6a7.2 7.2 0 0 1 7.2 7.2" />
        </Svg>
      )
    case 'espectro': // a wave through a circle
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="7" />
          <path d="M3.2 10c1.2-2.6 2.4-2.6 3.4 0s2.2 2.6 3.4 0 2.2-2.6 3.4 0 2.2 2.6 3.4 0" />
        </Svg>
      )
  }
}

/** Small functional marks used across instruments. */
export function Mark({ name, ...p }: Props & { name: 'save' | 'saved' | 'share' | 'close' | 'play' | 'pause' | 'next' | 'prev' | 'search' | 'comments' | 'arrow' | 'external' | 'plus' | 'minus' | 'check' | 'lock' | 'dot' | 'menu' | 'flag' | 'pin' | 'expand' | 'seed' }) {
  switch (name) {
    case 'save':
      return (
        <Svg {...p}>
          <path d="M6 3.5h8v13l-4-3-4 3z" />
        </Svg>
      )
    case 'saved':
      return (
        <Svg {...p}>
          <path d="M6 3.5h8v13l-4-3-4 3z" fill="currentColor" />
        </Svg>
      )
    case 'share':
      return (
        <Svg {...p}>
          <path d="M8 12 12 8M7 9.5 5.2 11.3a2.6 2.6 0 0 0 3.6 3.6L10.5 13M13 10.5l1.8-1.8a2.6 2.6 0 0 0-3.6-3.6L9.5 7" />
        </Svg>
      )
    case 'close':
      return (
        <Svg {...p}>
          <path d="M5 5l10 10M15 5 5 15" />
        </Svg>
      )
    case 'play':
      return (
        <Svg {...p}>
          <path d="M6.5 4.5v11l9-5.5z" fill="currentColor" />
        </Svg>
      )
    case 'pause':
      return (
        <Svg {...p}>
          <path d="M6.5 4.5v11M13.5 4.5v11" strokeWidth={2.4} />
        </Svg>
      )
    case 'next':
      return (
        <Svg {...p}>
          <path d="M5 5v10l7.5-5z" fill="currentColor" />
          <path d="M15.5 5v10" />
        </Svg>
      )
    case 'prev':
      return (
        <Svg {...p}>
          <path d="M15 5v10L7.5 10z" fill="currentColor" />
          <path d="M4.5 5v10" />
        </Svg>
      )
    case 'search':
      return (
        <Svg {...p}>
          <circle cx="8.6" cy="8.6" r="5" />
          <path d="M12.4 12.4 16.5 16.5" />
        </Svg>
      )
    case 'comments':
      return (
        <Svg {...p}>
          <path d="M3.5 5.5h13v8h-7l-3.5 3v-3H3.5z" />
        </Svg>
      )
    case 'arrow':
      return (
        <Svg {...p}>
          <path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" />
        </Svg>
      )
    case 'external':
      return (
        <Svg {...p}>
          <path d="M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5 9 11" />
        </Svg>
      )
    case 'plus':
      return (
        <Svg {...p}>
          <path d="M10 4.5v11M4.5 10h11" />
        </Svg>
      )
    case 'minus':
      return (
        <Svg {...p}>
          <path d="M4.5 10h11" />
        </Svg>
      )
    case 'check':
      return (
        <Svg {...p}>
          <path d="m4.5 10.5 3.5 3.5 7.5-8" />
        </Svg>
      )
    case 'lock':
      return (
        <Svg {...p}>
          <rect x="4.5" y="9" width="11" height="8" rx="1" />
          <path d="M7 9V6.8a3 3 0 0 1 6 0V9" />
        </Svg>
      )
    case 'dot':
      return (
        <Svg {...p}>
          <circle cx="10" cy="10" r="3" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'menu':
      return (
        <Svg {...p}>
          <path d="M3.5 6.5h13M3.5 13.5h13" />
        </Svg>
      )
    case 'flag':
      return (
        <Svg {...p}>
          <path d="M5 17V3.5M5 4h9.5l-2 3.2 2 3.3H5" />
        </Svg>
      )
    case 'pin':
      return (
        <Svg {...p}>
          <path d="M10 17v-5M6 12h8l-1.5-3V4.5h-5V9z" />
        </Svg>
      )
    case 'expand':
      return (
        <Svg {...p}>
          <path d="M11.5 4h4.5v4.5M8.5 16H4v-4.5M16 4l-5 5M4 16l5-5" />
        </Svg>
      )
    case 'seed':
      return (
        <Svg {...p}>
          <path d="M10 17V9.5M10 9.5c0-3.4 2.2-5.4 5.5-5.4 0 3.4-2.2 5.4-5.5 5.4ZM10 12c0-2.6-1.8-4.1-4.5-4.1 0 2.6 1.8 4.1 4.5 4.1Z" />
        </Svg>
      )
  }
}
