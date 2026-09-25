'use client'

/**
 * LECTURAS — every text format on one surface, chosen by pictogram.
 * `/lecturas?tipo=review` is the canonical address; the legacy routes
 * (/editorial, /reviews, /opinion, /articulos, /noticias, /listas) render
 * this same surface with their tipo set and keep their own URL until you
 * choose another format. Choosing re-flows the organism in place (no
 * navigation, no reload) and rewrites the address.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import { useItems } from '@/lib/store/world'
import { useCampo } from '@/lib/store/campo'
import { presentGenres } from '@/lib/logic/genres'
import { Seccion } from './Seccion'
import { LIBREA_FORMATO, LIBREA_SECCION, type Librea } from '@/lib/librea'
import { SelectorTipos } from './SelectorTipos'
import { useFiltroSeccion } from './useFiltroSeccion'
import { TEXT_TYPES, TIPOS_LECTURA, TIPO_DEK, TIPO_LABEL, TIPO_NOUN, lecturasHref, parseTipo, type TipoLectura } from './tipos'

function countByType(list: ContentItem[]) {
  const out: Partial<Record<TipoLectura, number>> = {}
  for (const i of list) out[i.type as TipoLectura] = (out[i.type as TipoLectura] ?? 0) + 1
  return out
}

export function Lecturas({ initial }: { initial: TipoLectura | null }) {
  const all = useItems()
  const texts = useMemo(() => all.filter((i) => TEXT_TYPES.includes(i.type)), [all])
  const [tipo, setTipo] = useState<TipoLectura | null>(initial)
  const { energyOnly, filtered } = useFiltroSeccion(texts, { publishPresent: false })
  const setPresent = useCampo((s) => s.setPresent)

  const view = useMemo(() => (tipo ? filtered.filter((i) => i.type === tipo) : filtered), [filtered, tipo])
  const viewEnergy = useMemo(() => (tipo ? energyOnly.filter((i) => i.type === tipo) : energyOnly), [energyOnly, tipo])
  const counts = useMemo(() => countByType(filtered), [filtered])
  const totals = useMemo(() => countByType(texts), [texts])

  // The particles float where *this* view's genres actually are.
  useEffect(() => {
    setPresent(presentGenres(viewEnergy))
  }, [viewEnergy, setPresent])

  // Back/Forward across addresses this surface wrote.
  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname
      if (p === '/lecturas') setTipo(parseTipo(new URLSearchParams(window.location.search).get('tipo') ?? undefined))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const librea: Librea = useMemo(
    () =>
      tipo
        ? { ...LIBREA_FORMATO[tipo], canal: '03', code: `LCT·${LIBREA_FORMATO[tipo].code}`, nombre: TIPO_LABEL[tipo] }
        : LIBREA_SECCION.lecturas,
    [tipo],
  )

  const choose = (t: TipoLectura | null) => {
    if (t === tipo) return
    setTipo(t)
    window.history.replaceState(null, '', lecturasHref(t))
  }

  return (
    <Seccion
      librea={librea}
      glyph={tipo ?? 'lecturas'}
      glyphs={tipo ? [tipo] : TIPOS_LECTURA}
      index="03"
      kicker={tipo ? `Lecturas — ${TIPO_LABEL[tipo]}` : 'Lecturas — todos los formatos'}
      title={tipo ? TIPO_LABEL[tipo] : 'Lecturas'}
      dek={TIPO_DEK[tipo ?? 'todo']}
      filtered={view}
      total={tipo ? totals[tipo] ?? 0 : texts.length}
      emptyNoun={tipo ? TIPO_NOUN[tipo] : 'lecturas'}
      controls={<SelectorTipos value={tipo} onChange={choose} counts={counts} total={filtered.length} />}
    />
  )
}
