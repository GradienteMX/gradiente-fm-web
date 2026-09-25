'use client'

/**
 * LECTURA — the contained reading surface. Content opens *over* the field,
 * never on a new page. `?item=<slug>` deep-links it on any route; Back
 * closes it. The reader is chosen per format (Noche, Sesión, Texto,
 * Crónica, Lista, Estación) — per-type layouts, not one template.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useUI } from '@/lib/store/ui'
import { useItemBySlug, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { LecturaShell } from './LecturaShell'
import { Readers } from './readers'
import { Sheet } from '@/components/kit/Sheet'
import { Button } from '@/components/kit/Button'

export function LecturaHost() {
  const lectura = useUI((s) => s.lectura)
  const openLectura = useUI((s) => s.openLectura)
  const closeLectura = useUI((s) => s.closeLectura)
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const item = useItemBySlug(lectura?.slug)
  const hydrated = useWorld((s) => s.hydrated)
  const me = useMe()
  const dispatch = useWorld((s) => s.dispatch)
  const lastOpened = useRef<string | null>(null)

  // URL → state (deep links, Back/Forward).
  const urlSlug = params.get('item')
  useEffect(() => {
    if (urlSlug && urlSlug !== lectura?.slug) {
      openLectura(urlSlug, null, { comments: Boolean(params.get('hilo')), focusComment: params.get('comentario') })
    }
    if (!urlSlug && lectura) closeLectura()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSlug])

  // State → URL.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const current = sp.get('item')
    if (lectura && current !== lectura.slug) {
      sp.set('item', lectura.slug)
      window.history.pushState(null, '', `${pathname}?${sp.toString()}`)
    } else if (!lectura && current) {
      sp.delete('item')
      sp.delete('hilo')
      sp.delete('comentario')
      // An inspection belongs to one opening; later genuine reads must count.
      sp.delete('inspeccion')
      const q = sp.toString()
      window.history.replaceState(null, '', q ? `${pathname}?${q}` : pathname)
    }
  }, [lectura, pathname])

  // Reading counts as an open (HL), once per opening, for signed-in readers.
  useEffect(() => {
    if (!item || !lectura) {
      lastOpened.current = null
      return
    }
    if (lastOpened.current === item.id) return
    lastOpened.current = item.id
    if (me && !params.get('inspeccion')) dispatch({ t: 'touch', userId: me.id, itemId: item.id, kind: 'open', at: new Date().toISOString() })
  }, [item, lectura, me, dispatch, params])

  void router
  if (!lectura) return null

  if (!item) {
    if (!hydrated) return null
    return (
      <Sheet open onClose={closeLectura} label="Pieza no disponible" width={440}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="label" style={{ color: 'var(--red-ink)' }}>
            404 / Pieza no disponible
          </p>
          <p className="display" style={{ fontSize: 28, fontVariationSettings: '"wdth" 128, "wght" 560' }}>
            Esta pieza ya no está aquí.
          </p>
          <p className="meta">Pudo haberse archivado o borrado. El resto del campo sigue vivo.</p>
          <Button variant="ink" onClick={closeLectura}>
            Volver
          </Button>
        </div>
      </Sheet>
    )
  }

  const Reader = Readers[item.type] ?? Readers.editorial
  return (
    <LecturaShell key={item.id} item={item} origin={lectura.origin} comments={lectura.comments} focusComment={lectura.focusComment}>
      <Reader item={item} />
    </LecturaShell>
  )
}
