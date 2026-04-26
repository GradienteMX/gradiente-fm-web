// Shared AudioContext for the audio reactive subsystem.
// Browsers throw if you create one before a user gesture; getOrCreate is called
// from gesture-bound callbacks (file pick, button click).

let ctx: AudioContext | null = null

export function getOrCreateAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext requested in non-browser environment')
  }
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

export function getAudioContext(): AudioContext | null {
  return ctx
}

export const FFT_SIZE = 2048
export const FREQUENCY_BIN_COUNT = FFT_SIZE / 2
