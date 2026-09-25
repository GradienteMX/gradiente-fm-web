/**
 * CAPTURA — «Escuchar el espectro».
 *
 * The mixes sound inside cross-origin iframes, so their samples are sealed.
 * The only honest path to real frequencies is to ask the listener to share
 * this tab's audio (getDisplayMedia, Chromium desktop). Rules ported from the
 * original deck, all load-bearing:
 *
 *   · getDisplayMedia is the FIRST async call in the click — nothing awaits
 *     before it, or the browser drops the user activation;
 *   · `preferCurrentTab` + `selfBrowserSurface: 'include'` offer this tab;
 *   · the video track is stopped at once (no border, no CPU) — audio only;
 *   · the AnalyserNode (fftSize 2048) is a sink: NEVER connected to the
 *     destination, or the tab would feed back into itself;
 *   · "Stop sharing" in the browser bar ends the track → we clean up.
 *
 * Nothing is recorded, nothing leaves the browser.
 */

import type { CaptureState } from '@/lib/store/player'

export const FFT_SIZE = 2048
export const SPEC_BINS = 64
const F_LO = 30
const F_HI = 16000

let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null
let freq: Uint8Array<ArrayBuffer> | null = null
let ranges: Array<[number, number]> = []
let bands: { low: [number, number]; mid: [number, number]; high: [number, number] } | null = null
let endListener: (() => void) | null = null

export function captureSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices) && typeof navigator.mediaDevices.getDisplayMedia === 'function'
}

export function captureLive(): boolean {
  return analyser !== null
}

/** Called when the listener stops sharing from the browser's own bar. */
export function onCaptureEnded(fn: (() => void) | null) {
  endListener = fn
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export interface CaptureResult {
  state: CaptureState
  note?: string
}

function classify(err: unknown): CaptureResult {
  const name = (err as DOMException | undefined)?.name ?? ''
  if (name === 'NotAllowedError' || name === 'AbortError') return { state: 'denied', note: 'No se compartió la pestaña.' }
  if (name === 'NotSupportedError' || name === 'TypeError' || name === 'NotFoundError')
    return { state: 'unsupported', note: 'Este navegador no puede escuchar la pestaña (sí Chrome y Edge de escritorio).' }
  return { state: 'denied', note: 'El navegador no entregó el audio de la pestaña.' }
}

/**
 * Must run synchronously inside the listener's click. Resolves with the new
 * capture state (and a note in words when it isn't live).
 */
export function requestCapture(): Promise<CaptureResult> {
  if (!captureSupported()) return Promise.resolve({ state: 'unsupported', note: 'Este navegador no puede escuchar la pestaña (sí Chrome y Edge de escritorio).' })
  if (analyser) return Promise.resolve({ state: 'live' })
  // Creating/resuming the context doesn't consume the activation; the
  // capture call right after still runs inside the gesture.
  const c = ensureContext()
  let pending: Promise<MediaStream>
  try {
    pending = navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'include',
    } as DisplayMediaStreamOptions)
  } catch (err) {
    return Promise.resolve(classify(err))
  }
  return pending.then(
    (s) => {
      const audio = s.getAudioTracks()
      if (!audio.length) {
        s.getTracks().forEach((t) => t.stop())
        return { state: 'denied' as const, note: 'Se compartió sin audio: marca «Compartir audio de la pestaña».' }
      }
      // Audio only — drop the picture right away.
      s.getVideoTracks().forEach((t) => t.stop())
      const ac = c ?? ensureContext()
      if (!ac) {
        s.getTracks().forEach((t) => t.stop())
        return { state: 'unsupported' as const, note: 'Este navegador no tiene Web Audio.' }
      }
      stream = s
      source = ac.createMediaStreamSource(s)
      const a = ac.createAnalyser()
      a.fftSize = FFT_SIZE
      a.smoothingTimeConstant = 0.3
      // A sink, never connected to ac.destination (no feedback, no double audio).
      source.connect(a)
      analyser = a
      freq = new Uint8Array(new ArrayBuffer(a.frequencyBinCount))
      prepareRanges(ac.sampleRate)
      audio[0].addEventListener('ended', () => {
        stopCapture()
        endListener?.()
      })
      return { state: 'live' as const }
    },
    (err) => classify(err),
  )
}

export function stopCapture() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  try {
    source?.disconnect()
  } catch {
    /* already */
  }
  try {
    analyser?.disconnect()
  } catch {
    /* already */
  }
  source = null
  analyser = null
  freq = null
}

function prepareRanges(sampleRate: number) {
  const binHz = sampleRate / FFT_SIZE
  const n = FFT_SIZE / 2
  const at = (hz: number) => Math.max(1, Math.min(n - 1, Math.round(hz / binHz)))
  ranges = []
  for (let b = 0; b < SPEC_BINS; b++) {
    const f0 = F_LO * Math.pow(F_HI / F_LO, b / SPEC_BINS)
    const f1 = F_LO * Math.pow(F_HI / F_LO, (b + 1) / SPEC_BINS)
    const i0 = at(f0)
    ranges.push([i0, Math.max(i0 + 1, at(f1))])
  }
  bands = {
    low: [at(20), at(250)],
    mid: [at(250), at(4000)],
    high: [at(4000), at(Math.min(18000, sampleRate / 2 - binHz))],
  }
}

export interface CaptureFrame {
  low: number
  mid: number
  high: number
  level: number
  /** 64 log-spaced magnitudes, 30 Hz → 16 kHz, 0..1. */
  spec: Float32Array
}

/** Fill `out` from the live analyser. False when capture isn't live. */
export function readCapture(out: CaptureFrame): boolean {
  if (!analyser || !freq || !bands) return false
  analyser.getByteFrequencyData(freq)
  const f = freq
  const mean = ([a, b]: [number, number]) => {
    let s = 0
    for (let i = a; i < b; i++) s += f[i]
    return b > a ? s / (b - a) / 255 : 0
  }
  out.low = mean(bands.low)
  out.mid = mean(bands.mid)
  out.high = mean(bands.high)
  let sq = 0
  for (let i = 1; i < f.length; i++) sq += (f[i] / 255) ** 2
  out.level = Math.sqrt(sq / (f.length - 1))
  for (let b = 0; b < SPEC_BINS; b++) {
    const [i0, i1] = ranges[b]
    let m = 0
    for (let i = i0; i < i1; i++) if (f[i] > m) m = f[i]
    // A gentle tilt so the top octaves (always lower in level) still read.
    out.spec[b] = Math.min(1, (m / 255) * (0.86 + 0.34 * (b / (SPEC_BINS - 1))))
  }
  return true
}
