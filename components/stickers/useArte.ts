'use client'

/**
 * The art, as URLs the DOM can use: the sticker itself (a same-origin blob
 * painted by lib/stickers/arte), its material's light tile, and its finish
 * (lib/stickers/acabado: the copy's foil, the window it shows through, the
 * relief's light). Nothing on the server — the first paint shows the die
 * line, the print lands after, the finish right behind it.
 */

import { useEffect, useState } from 'react'
import { artWidth, materialTexture, stickerArtURL } from '@/lib/stickers/arte'
import { acabado, muestra, type Kit } from '@/lib/stickers/acabado'
import type { StickerDef, StickerMaterial } from '@/lib/stickers/types'
import { useClientValue } from '@/lib/useMedia'

export function useStickerArtURL(def: StickerDef | null | undefined, cssWidth: number): string | null {
  const dpr = useClientValue(() => window.devicePixelRatio || 1, 1)
  const w = artWidth(cssWidth, dpr)
  const key = def ? `${def.id}@${w}` : null
  const [got, setGot] = useState<{ key: string; url: string } | null>(null)
  useEffect(() => {
    if (!def || !key) return
    let live = true
    stickerArtURL(def, w).then((url) => {
      if (live && url) setGot({ key, url })
    })
    return () => {
      live = false
    }
  }, [def, key, w])
  return got && got.key === key ? got.url : null
}

export function useMaterialTexture(material: StickerMaterial): string | null {
  const [got, setGot] = useState<{ m: StickerMaterial; url: string } | null>(null)
  useEffect(() => {
    let live = true
    materialTexture(material).then((url) => {
      if (live && url) setGot({ m: material, url })
    })
    return () => {
      live = false
    }
  }, [material])
  return got && got.m === material ? got.url : null
}

/** The finish of one copy (its seed) at this size: null until painted. */
export function useAcabado(def: StickerDef | null | undefined, seed: number, cssWidth: number): Kit | null {
  const dpr = useClientValue(() => window.devicePixelRatio || 1, 1)
  const w = artWidth(cssWidth, dpr)
  const key = def ? `${def.id}@${w}:${seed}` : null
  const [got, setGot] = useState<{ key: string; kit: Kit } | null>(null)
  useEffect(() => {
    if (!def || !key) return
    let live = true
    acabado(def, seed, w).then((kit) => {
      if (live) setGot({ key, kit })
    })
    return () => {
      live = false
    }
  }, [def, key, seed, w])
  return got && got.key === key ? got.kit : null
}

/** A small square of a finish's stock (a foil family, a metal, glitter): '' when it has none. */
export function useMuestra(def: StickerDef, seed: number): string | null {
  const key = `${def.id}:${seed}`
  const [got, setGot] = useState<{ key: string; url: string } | null>(null)
  useEffect(() => {
    let live = true
    muestra(def, seed).then((url) => {
      if (live) setGot({ key, url })
    })
    return () => {
      live = false
    }
  }, [def, key, seed])
  return got && got.key === key ? got.url : null
}
