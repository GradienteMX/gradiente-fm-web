'use client'

/**
 * The deck's status words. Every word is a real state of a real bridge —
 * never a spinner pretending, never a signal that isn't there.
 */

import { usePlayer, type CaptureState } from '@/lib/store/player'

export type Tono = 'vivo' | 'quieto' | 'falla'

export interface Estado {
  word: string
  tone: Tono
}

type Snap = ReturnType<typeof usePlayer.getState>

export function estadoDe(s: Pick<Snap, 'track' | 'playing' | 'loading' | 'fault' | 'preview' | 'time' | 'duration'>): Estado {
  if (!s.track) return { word: 'EN COLA', tone: 'quieto' }
  if (s.fault) return { word: s.fault, tone: 'falla' }
  if (s.loading) return { word: 'CARGANDO', tone: 'quieto' }
  if (s.playing) return { word: s.preview ? 'VISTA PREVIA' : 'SONANDO', tone: 'vivo' }
  if (s.duration > 0 && s.time >= s.duration - 1.5) return { word: 'TERMINÓ', tone: 'quieto' }
  return { word: 'EN PAUSA', tone: 'quieto' }
}

/** Subscribes to a primitive key so the component re-renders only on a real change. */
export function useEstado(): Estado {
  const key = usePlayer((s) => {
    const e = estadoDe(s)
    return `${e.tone}|${e.word}`
  })
  const [tone, word] = key.split('|') as [Tono, string]
  return { word, tone }
}

/**
 * The energy of what's loaded as a global spectrum token (`var(--e0…--e10)`),
 * so the deck follows the palette wherever it's defined.
 */
export function energiaVar(e: number): string {
  return `var(--e${Math.round(Math.max(0, Math.min(10, e)))})`
}

/** How the field is listening, in words (shown only while sounding). */
export function modoDe(capture: CaptureState, bpm: number | null, reduced = false): string {
  // Reduced motion: nothing pulses or follows the audio — say so.
  if (reduced) return 'sin pulso · movimiento reducido'
  if (capture === 'live') return 'espectro en vivo'
  if (bpm) return 'pulso por BPM'
  return 'sin pulso'
}
