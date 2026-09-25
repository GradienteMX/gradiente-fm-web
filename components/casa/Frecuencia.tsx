'use client'

/**
 * SIN SEÑAL — the 404, and the empty ficha. A frequency nobody broadcasts
 * on: the title is set glacial (wide, light, cold), the copy says what is
 * true, and every way back actually goes somewhere.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ContentType } from '@/lib/types'
import { useUI } from '@/lib/store/ui'
import { FormatGlyph, Mark } from '@/components/kit/Glyph'
import { EnergyTitle } from '@/components/secciones/EnergyTitle'
import { CampoGlyph } from '@/components/secciones/Pictos'
import styles from './SinSenal.module.css'

const SALIDAS: Array<{ href: string; name: string; line: string; glyphs: ContentType[] }> = [
  { href: '/', name: 'Campo', line: 'Todo lo que vive, del tamaño de su vida.', glyphs: [] },
  { href: '/agenda', name: 'Agenda', line: 'Las noches de la escena, una por una.', glyphs: ['evento'] },
  { href: '/mixes', name: 'Mixes', line: 'Sets, sesiones y programas de radio.', glyphs: ['mix'] },
  { href: '/lecturas', name: 'Lecturas', line: 'Lo que la escena escribe sobre sí misma.', glyphs: ['editorial', 'review', 'articulo'] },
]

export function Frecuencia({ motivo = 'ruta' }: { motivo?: 'ruta' | 'ficha' }) {
  const pathname = usePathname() ?? ''
  const setSearch = useUI((s) => s.setSearch)
  const slug = motivo === 'ficha' ? decodeURIComponent(pathname.replace(/^\/e\//, '')) : ''

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.kicker}>
          <span className={styles.flat} aria-hidden="true" />
          <span className="label">{motivo === 'ficha' ? 'Ficha sin piezas' : 'Sin señal'}</span>
        </p>

        <EnergyTitle text="Esta frecuencia no existe." energy={0} max={118} min={40} share={0.96} />

        <p className={styles.lede}>
          {motivo === 'ficha' ? (
            <>
              Ninguna pieza nombra a <b>«{slug}»</b> todavía. Las fichas nacen de lo que la escena publica: cuando alguien la ponga en un
              line-up, firme un mix o la incluya en una lista, aparecerá aquí.
            </>
          ) : (
            <>
              Nada está sintonizado en <b className={styles.path}>{pathname || '/'}</b>. Puede que la dirección esté mal escrita, que la
              pieza se haya archivado o que todavía nadie la haya sembrado.
            </>
          )}
        </p>

        <nav className={styles.salidas} aria-label="Volver a sintonizar">
          {SALIDAS.map((s) => (
            <Link key={s.href} href={s.href} className={styles.salida}>
              <span className={styles.salidaGlyphs} aria-hidden="true">
                {s.glyphs.length ? s.glyphs.map((g) => <FormatGlyph key={g} type={g} size={14} />) : <CampoGlyph size={14} />}
              </span>
              <span className={styles.salidaName}>{s.name}</span>
              <span className={styles.salidaLine}>{s.line}</span>
              <span className={styles.salidaGo} aria-hidden="true">
                <Mark name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </nav>

        <div className={styles.extra}>
          <button type="button" className={styles.buscar} onClick={() => setSearch(true)}>
            <Mark name="search" size={15} />
            Buscar en todo el campo
            <kbd className={styles.kbd}>/</kbd>
          </button>
          <Link href="/about" className={styles.queEs}>
            ¿Primera vez aquí? Qué es Gradiente
          </Link>
        </div>
      </div>
    </div>
  )
}
