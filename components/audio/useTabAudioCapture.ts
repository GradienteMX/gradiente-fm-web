'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FFT_SIZE, FREQUENCY_BIN_COUNT, getOrCreateAudioContext } from './audioContext'
import type { AudioSourceStatus } from './types'

export interface UseTabAudioCaptureResult {
  data: Uint8Array | null
  status: AudioSourceStatus
  errorMessage?: string
  sampleRate: number
  // Browsers that don't support getDisplayMedia or its audio track at all.
  isSupported: boolean
  request: () => Promise<void>
  stop: () => void
}

export function useTabAudioCapture(): UseTabAudioCaptureResult {
  const streamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)

  const [data, setData] = useState<Uint8Array | null>(null)
  const [status, setStatus] = useState<AudioSourceStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [sampleRate, setSampleRate] = useState(44100)
  const [isSupported, setIsSupported] = useState(true)

  // Initial capability probe — purely to detect Safari, which lacks getDisplayMedia
  // entirely. Firefox has the API but rejects audio:true; we surface that at request
  // time, since detecting it ahead of time isn't reliable.
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const md = navigator.mediaDevices
    if (!md || typeof md.getDisplayMedia !== 'function') {
      setIsSupported(false)
      setStatus('unsupported')
    }
  }, [])

  const stopSampling = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  const stop = useCallback(() => {
    stopSampling()
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect()
      } catch {
        /* already disconnected */
      }
      sourceRef.current = null
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {
        /* already disconnected */
      }
      analyserRef.current = null
    }
    setData(null)
    setStatus('idle')
  }, [stopSampling])

  const startSampling = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const buffer = new Uint8Array(FREQUENCY_BIN_COUNT)
    const tick = () => {
      const a = analyserRef.current
      if (a) {
        a.getByteFrequencyData(buffer)
        setData(new Uint8Array(buffer))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const request = useCallback(async () => {
    if (typeof navigator === 'undefined') return
    const md = navigator.mediaDevices
    if (!md || typeof md.getDisplayMedia !== 'function') {
      setIsSupported(false)
      setStatus('unsupported')
      setErrorMessage('Tu navegador no permite capturar audio de la pestaña')
      return
    }

    setStatus('requesting')
    setErrorMessage(undefined)

    try {
      // `preferCurrentTab` is non-standard but Chromium-only and harmless elsewhere.
      const stream = await md.getDisplayMedia({
        video: true,
        audio: true,
        // @ts-expect-error — preferCurrentTab is a Chromium hint, not in the TS lib yet
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        systemAudio: 'include',
      } as DisplayMediaStreamOptions)

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        // User shared without ticking the audio box, or browser doesn't deliver audio.
        stream.getTracks().forEach((t) => t.stop())
        setStatus('denied')
        setErrorMessage('No se compartió audio. Marca "Compartir audio" en el diálogo del navegador.')
        return
      }

      // Discard the video track — we only need audio. Stops the green border / CPU cost.
      stream.getVideoTracks().forEach((t) => t.stop())

      streamRef.current = stream

      const ctx = getOrCreateAudioContext()
      setSampleRate(ctx.sampleRate)
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      // Low temporal smoothing — the visualizer's per-band envelopes shape
      // transients; we want raw FFT here, not averaged-out data.
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      // CRITICAL: do NOT connect to ctx.destination — that would feed tab audio
      // back into itself, creating a feedback loop. Analyser is a sink; the
      // user is already hearing the source via the iframe's own playback.

      sourceRef.current = source
      analyserRef.current = analyser

      // If the user clicks "Stop sharing" in the browser's persistent banner,
      // tracks emit `ended` — clean up.
      audioTracks[0].addEventListener('ended', () => {
        stop()
      })

      setStatus('live')
      startSampling()
    } catch (err) {
      const e = err as DOMException
      if (e.name === 'NotAllowedError') {
        setStatus('denied')
        setErrorMessage('Permiso denegado')
      } else if (e.name === 'NotSupportedError' || e.name === 'TypeError') {
        setIsSupported(false)
        setStatus('unsupported')
        setErrorMessage('Tu navegador no soporta captura de audio de pestaña')
      } else {
        setStatus('error')
        setErrorMessage(e.message || 'Error desconocido')
      }
    }
  }, [startSampling, stop])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    data,
    status,
    errorMessage,
    sampleRate,
    isSupported,
    request,
    stop,
  }
}
