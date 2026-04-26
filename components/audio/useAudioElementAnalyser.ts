'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FFT_SIZE, FREQUENCY_BIN_COUNT, getOrCreateAudioContext } from './audioContext'
import type { AudioSourceStatus } from './types'

export interface UseAudioElementAnalyserResult {
  data: Uint8Array | null
  status: AudioSourceStatus
  errorMessage?: string
  sampleRate: number
  // The hidden <audio> element. Must be mounted somewhere in the tree
  // (display:none is fine) for playback to actually happen.
  audioRef: React.RefObject<HTMLAudioElement>
  loadFile: (file: File) => void
  loadUrl: (url: string) => void
  fileName: string | null
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (seconds: number) => void
  isPlaying: boolean
  currentTime: number
  duration: number
}

export function useAudioElementAnalyser(): UseAudioElementAnalyserResult {
  const audioRef = useRef<HTMLAudioElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)

  const [data, setData] = useState<Uint8Array | null>(null)
  const [status, setStatus] = useState<AudioSourceStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [fileName, setFileName] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [sampleRate, setSampleRate] = useState(44100)

  const ensureGraph = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return null
    const ctx = getOrCreateAudioContext()
    setSampleRate(ctx.sampleRate)
    if (!sourceRef.current) {
      // createMediaElementSource throws if called twice on the same element.
      sourceRef.current = ctx.createMediaElementSource(audio)
    }
    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = FFT_SIZE
      // Low temporal smoothing — let the visualizer's per-band envelopes
      // shape transients instead of averaging them out at the source.
      analyserRef.current.smoothingTimeConstant = 0.3
      sourceRef.current.connect(analyserRef.current)
      // Also route to speakers so the user can hear the file.
      analyserRef.current.connect(ctx.destination)
    }
    return analyserRef.current
  }, [])

  const startSampling = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const buffer = new Uint8Array(FREQUENCY_BIN_COUNT)
    const tick = () => {
      const a = analyserRef.current
      if (a) {
        a.getByteFrequencyData(buffer)
        // Hand a fresh copy to React so identity changes trigger re-renders.
        // Cheap — 1024 bytes, runs at rAF cadence.
        setData(new Uint8Array(buffer))
      }
      const audio = audioRef.current
      if (audio) {
        setCurrentTime(audio.currentTime)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopSampling = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => {
      ensureGraph()
      setIsPlaying(true)
      setStatus('live')
      startSampling()
    }
    const onPause = () => {
      setIsPlaying(false)
      setStatus((s) => (s === 'live' ? 'paused' : s))
      stopSampling()
    }
    const onEnded = () => {
      setIsPlaying(false)
      setStatus('ended')
      stopSampling()
    }
    const onLoaded = () => {
      setDuration(isFinite(audio.duration) ? audio.duration : 0)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onError = () => {
      setStatus('error')
      setErrorMessage('No se pudo decodificar el archivo')
      stopSampling()
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('error', onError)
      stopSampling()
    }
  }, [ensureGraph, startSampling, stopSampling])

  const loadFile = useCallback((file: File) => {
    const audio = audioRef.current
    if (!audio) return
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    audio.src = url
    audio.load()
    setFileName(file.name)
    setStatus('loading')
    setErrorMessage(undefined)
  }, [])

  const loadUrl = useCallback((url: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    audio.src = url
    audio.load()
    setFileName(url)
    setStatus('loading')
    setErrorMessage(undefined)
  }, [])

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {
      setStatus('error')
      setErrorMessage('Reproducción bloqueada por el navegador')
    })
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) play()
    else pause()
  }, [play, pause])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, seconds))
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  return {
    data,
    status,
    errorMessage,
    sampleRate,
    audioRef,
    loadFile,
    loadUrl,
    fileName,
    play,
    pause,
    toggle,
    seek,
    isPlaying,
    currentTime,
    duration,
  }
}
