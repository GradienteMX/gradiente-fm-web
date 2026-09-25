/**
 * SEÑAL — what the deck hears, as numbers the field and the visualizer read.
 *
 * Three honest regimes, never mixed up:
 *   espectro  real FFT bands from the shared tab (captura.ts) + a kick onset
 *             detector (the live low band jumping above its running mean);
 *   bpm       no audio access: a tempo pulse derived from the mix's catalog
 *             BPM — the tempo is real, the phase isn't, and the UI says so
 *             ("pulso por BPM"); the spectrum stays empty, never faked;
 *   libre     playing with neither: a steady presence, no pulse.
 * Plus `reposo` when nothing plays: everything settles to zero.
 *
 * One module-level object, mutated in place by the Consola's loop; readers
 * (the Sala's espectrograma, the field feed) sample it inside their own frames, so
 * the analyser never pushes React state.
 */

import { pulseHz } from './sources'
import { readCapture, SPEC_BINS, type CaptureFrame } from './captura'

export const HIST_ROWS = 16
/** How often a spectrum row is pushed into the history (rows per second). */
const HIST_RATE = 24
/** Minimum gap between kicks — keeps full-field luminance changes ≤ 3 Hz. */
const KICK_REFRACTORY = 0.34

export type Regimen = 'espectro' | 'bpm' | 'libre' | 'reposo'

export interface Senal {
  regimen: Regimen
  /** 0..1 smoothed "is playing" presence. */
  play: number
  /** 0..1 smoothed "real spectrum" presence. */
  live: number
  low: number
  mid: number
  high: number
  level: number
  /** Kick onset envelope (espectro) — snaps up, falls fast. */
  kick: number
  /** The beat: kick in espectro, tempo envelope in bpm, 0 otherwise. */
  pulse: number
  /** Smoothed log spectrum, 64 bins. */
  spec: Float32Array
  /** 64 × 16 history, row 0 newest. */
  hist: Float32Array
  /** What the field receives. */
  field: { low: number; mid: number; high: number; level: number }
  // internals
  phase: number
  lowAvg: number
  sinceKick: number
  histClock: number
}

export const senal: Senal = {
  regimen: 'reposo',
  play: 0,
  live: 0,
  low: 0,
  mid: 0,
  high: 0,
  level: 0,
  kick: 0,
  pulse: 0,
  spec: new Float32Array(SPEC_BINS),
  hist: new Float32Array(SPEC_BINS * HIST_ROWS),
  field: { low: 0, mid: 0, high: 0, level: 0 },
  phase: 0,
  lowAvg: 0,
  sinceKick: 1,
  histClock: 0,
}

const frame: CaptureFrame = { low: 0, mid: 0, high: 0, level: 0, spec: new Float32Array(SPEC_BINS) }

/** One beat: a 40 ms attack, then an exponential fall — a kick drum's shape. */
export function beatEnvelope(phase: number): number {
  const a = Math.min(1, phase / 0.06)
  const attack = a * a * (3 - 2 * a)
  return attack * Math.exp(-phase * 4.2)
}

const approach = (v: number, target: number, dt: number, tau: number) => v + (target - v) * (1 - Math.exp(-dt / Math.max(1e-3, tau)))

export interface StepInput {
  playing: boolean
  bpm: number | null
  reduced: boolean
}

/** Advance the signal by `dt` seconds. Returns true while anything is moving. */
export function stepSenal(dt: number, input: StepInput): boolean {
  const s = senal
  s.play = approach(s.play, input.playing ? 1 : 0, dt, input.playing ? 0.25 : 0.7)
  const live = readCapture(frame)
  s.live = approach(s.live, live ? 1 : 0, dt, 0.4)
  s.sinceKick += dt

  if (live) {
    s.regimen = input.playing ? 'espectro' : 'reposo'
    s.low = frame.low
    s.mid = frame.mid
    s.high = frame.high
    s.level = frame.level
    // Kick onset: the low band jumping well above its slow running mean.
    const k60 = dt * 60
    s.lowAvg = s.lowAvg * Math.pow(0.9, k60) + frame.low * (1 - Math.pow(0.9, k60))
    const onset = Math.max(0, frame.low - s.lowAvg * 1.25) * 7
    if (onset > 0.35 && s.sinceKick > KICK_REFRACTORY && onset > s.kick) {
      s.kick = Math.min(1, onset)
      s.sinceKick = 0
    } else {
      s.kick *= Math.pow(0.8, k60)
    }
    s.pulse = s.kick
    for (let b = 0; b < SPEC_BINS; b++) {
      const v = frame.spec[b]
      s.spec[b] = v > s.spec[b] ? approach(s.spec[b], v, dt, 0.03) : approach(s.spec[b], v, dt, 0.16)
    }
    s.field.low = Math.min(1, 0.28 * s.low + 0.62 * s.kick)
    s.field.mid = Math.min(1, s.mid * 0.95)
    s.field.high = Math.min(1, s.high * 1.3)
    s.field.level = s.level
  } else {
    s.kick *= Math.pow(0.8, dt * 60)
    for (let b = 0; b < SPEC_BINS; b++) s.spec[b] = approach(s.spec[b], 0, dt, 0.25)
    if (input.playing && input.bpm && !input.reduced) {
      s.regimen = 'bpm'
      s.phase = (s.phase + dt * pulseHz(input.bpm)) % 1
      s.pulse = beatEnvelope(s.phase) * s.play
    } else {
      s.regimen = input.playing ? 'libre' : 'reposo'
      s.pulse = approach(s.pulse, 0, dt, 0.2)
    }
    const p = s.pulse
    s.low = approach(s.low, 0, dt, 0.3)
    s.mid = approach(s.mid, 0, dt, 0.3)
    s.high = approach(s.high, 0, dt, 0.3)
    s.level = approach(s.level, (input.playing ? 0.3 : 0) * s.play, dt, 0.4)
    const present = input.playing ? s.play : 0
    s.field.low = s.regimen === 'bpm' ? 0.1 + 0.42 * p : 0.12 * present
    s.field.mid = 0.12 * present
    s.field.high = 0.05 * present
    s.field.level = s.level
  }

  // History rows: newest at 0; older rows travel outward in the visualizer.
  s.histClock += dt
  const step = 1 / HIST_RATE
  if (s.histClock >= step) {
    s.histClock %= step
    s.hist.copyWithin(SPEC_BINS, 0, SPEC_BINS * (HIST_ROWS - 1))
    s.hist.set(s.spec, 0)
  }

  return input.playing || live || s.play > 0.01 || s.pulse > 0.01 || s.field.level > 0.005
}

/** Zero everything (reduced motion, teardown). */
export function restSenal() {
  const s = senal
  s.regimen = 'reposo'
  s.play = s.live = s.low = s.mid = s.high = s.level = s.kick = s.pulse = 0
  s.spec.fill(0)
  s.hist.fill(0)
  s.field.low = s.field.mid = s.field.high = s.field.level = 0
}
