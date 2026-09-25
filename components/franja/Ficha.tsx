'use client'

/**
 * FICHA — catalog facts, and only those. How many nights, releases and texts
 * a franja has put its name on, how many things it has for sale, since when.
 * No followers, no members, no views: they describe a body of work, never
 * popularity. Zeros are shown quietly because they are also true.
 */

import Link from 'next/link'
import { bandLabel, energyHex, SPECTRUM_GRADIENT } from '@/lib/vibe'
import type { ArchiveKey, CatalogFacts, FranjaCatalog } from './catalog'
import styles from './Ficha.module.css'

interface Fact {
  key: ArchiveKey | 'productos' | 'desde'
  label: string
  value: string
  zero: boolean
  title?: string
}

export function factsList(f: CatalogFacts): Fact[] {
  const list: Fact[] = [
    { key: 'eventos', label: f.eventos === 1 ? 'Evento' : 'Eventos', value: String(f.eventos), zero: !f.eventos },
    { key: 'lanzamientos', label: f.lanzamientos === 1 ? 'Lanzamiento' : 'Lanzamientos', value: String(f.lanzamientos), zero: !f.lanzamientos, title: 'Mixes y reseñas' },
    { key: 'articulos', label: f.articulos === 1 ? 'Artículo' : 'Artículos', value: String(f.articulos), zero: !f.articulos, title: 'Artículos y listas' },
    { key: 'todo', label: f.publicaciones === 1 ? 'Publicación' : 'Publicaciones', value: String(f.publicaciones), zero: !f.publicaciones, title: 'Todo lo que lleva su nombre' },
    { key: 'productos', label: f.productos === 1 ? 'Producto' : 'Productos', value: String(f.productos), zero: !f.productos, title: 'Piezas en su tienda' },
  ]
  if (f.desde) {
    list.push({
      key: 'desde',
      label: f.desde.declared ? 'Desde' : 'Primer registro',
      value: String(f.desde.year),
      zero: false,
      title: f.desde.declared ? 'Año declarado por la franja' : 'Año de su pieza más antigua en el archivo',
    })
  }
  return list
}

export function Ficha({
  facts,
  layout = 'strip',
  hrefFor,
  onProductos,
}: {
  facts: CatalogFacts
  layout?: 'strip' | 'column'
  hrefFor?: (key: ArchiveKey) => string
  onProductos?: () => void
}) {
  const list = factsList(facts)
  return (
    <ul className={styles.ficha} data-layout={layout} aria-label="Ficha: hechos del catálogo">
      {list.map((f) => {
        const body = (
          <>
            <span className={styles.value}>{f.value}</span>
            <span className={styles.label}>{f.label}</span>
          </>
        )
        const href = f.key !== 'productos' && f.key !== 'desde' && hrefFor && !f.zero ? hrefFor(f.key) : undefined
        return (
          <li key={f.key}>
            {href ? (
              <Link href={href} className={styles.fact} data-link="" title={f.title ? `${f.title} · ver en el archivo` : 'Ver en el archivo'}>
                {body}
              </Link>
            ) : f.key === 'productos' && onProductos && !f.zero ? (
              <button type="button" className={styles.fact} data-link="" onClick={onProductos} title="Abrir su tienda">
                {body}
              </button>
            ) : (
              <span className={styles.fact} data-zero={f.zero || undefined} title={f.title}>
                {body}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Where the catalog sits on the energy axis — one tick per piece, hue = energy. */
export function Banda({ spectrum, label = 'Banda del catálogo' }: { spectrum: FranjaCatalog['spectrum']; label?: string }) {
  if (!spectrum) return null
  const { mids, min, max } = spectrum
  const code = (v: number) => String(Math.round(v)).padStart(2, '0')
  return (
    <div className={styles.banda}>
      <div className={styles.bandaHead}>
        <span className={styles.bandaLabel}>{label}</span>
        <span className={styles.bandaName}>
          {code(min)}–{code(max)} · {bandLabel(min, max)}
        </span>
      </div>
      <div className={styles.bandaTrack} role="img" aria-label={`${label}: ${bandLabel(min, max)}`}>
        <span className={styles.bandaSpectrum} style={{ background: SPECTRUM_GRADIENT }} />
        <span className={styles.bandaSpan} style={{ left: `${min * 10}%`, width: `${Math.max(0.6, (max - min) * 10)}%` }} />
        {mids.map((m, i) => (
          <span key={i} className={styles.tick} style={{ left: `${m * 10}%`, background: energyHex(m) }} />
        ))}
      </div>
    </div>
  )
}
