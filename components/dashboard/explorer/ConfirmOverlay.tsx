'use client'

import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileIcon } from './FileIcon'
import type { SelectionMeta } from './types'

// Lightweight confirm overlay for the dashboard explorer. Shares visual
// chrome with the content OverlayShell (CRT boot animation, NGE border,
// hazard-stripe accent, ESC/X/backdrop close) but lives in dashboard scope —
// it doesn't touch useOverlay / OverlayRouter / URL state. Replaces the
// right-side ExplorerDetails panel: clicking a template/draft/published item
// pops this overlay so the user reviews properties + commits via a big CTA.

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** Eyebrow text — e.g. "// SELECCIONANDO PLANTILLA · LISTA". */
  header: string
  selection: SelectionMeta
  ctaLabel: string
}

export function ConfirmOverlay({
  open,
  onClose,
  onConfirm,
  header,
  selection,
  ctaLabel,
}: Props) {
  // Exit animation state. User actions (ESC / X / backdrop / confirm) flip
  // `exiting` true; the backdrop-out animation's onAnimationEnd then fires
  // the parent callback which actually unmounts us. Mirrors the content
  // OverlayShell's pattern so visual feel matches.
  const [exiting, setExiting] = useState(false)
  const pendingRef = useRef<'close' | 'confirm' | null>(null)

  // Reset exit state when overlay opens fresh.
  useEffect(() => {
    if (open) {
      setExiting(false)
      pendingRef.current = null
    }
  }, [open])

  const triggerClose = useCallback(() => {
    setExiting((cur) => {
      if (cur) return cur
      pendingRef.current = 'close'
      return true
    })
  }, [])

  const triggerConfirm = useCallback(() => {
    setExiting((cur) => {
      if (cur) return cur
      pendingRef.current = 'confirm'
      return true
    })
  }, [])

  // Lock body scroll + ESC / Enter handlers while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        triggerClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        triggerConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, triggerClose, triggerConfirm])

  if (!open) return null

  const color = selection.color

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 ' +
        (exiting ? 'overlay-backdrop-out' : 'overlay-backdrop-in')
      }
      onClick={triggerClose}
      onAnimationEnd={(e) => {
        if (!exiting) return
        if (e.animationName !== 'overlay-backdrop-out') return
        const which = pendingRef.current
        pendingRef.current = null
        if (which === 'confirm') onConfirm()
        else onClose()
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-hidden
      />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          'eva-box eva-scanlines relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-base ' +
          (exiting ? 'overlay-panel-out' : 'overlay-panel-in')
        }
        style={{
          maxHeight: 'min(92vh, 720px)',
          transformOrigin: 'center center',
        }}
      >
        {/* Chrome / header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color }}
          >
            //CONFIRMAR
          </span>
          <button
            onClick={triggerClose}
            aria-label="Cerrar"
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
          >
            <span className="hidden sm:inline">[ESC]</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {/* Eyebrow header */}
          <span className="font-mono text-[10px] tracking-widest text-muted">
            {header}
          </span>

          {/* Big icon + label */}
          <div className="flex flex-col items-center gap-2 border border-dashed border-border/60 py-6">
            <FileIcon color={color} size={64} />
            <span
              className="font-syne text-2xl font-black tracking-tight"
              style={{ color }}
            >
              {selection.label}
            </span>
          </div>

          {/* Property table */}
          <dl className="flex flex-col gap-1.5 font-mono text-[11px]">
            <Row label="TIPO" value={selection.kind} />
            <Row label="NOMBRE" value={selection.label} />
            {selection.size && <Row label="TAMAÑO" value={selection.size} />}
            {selection.extra?.map((row) => (
              <Row
                key={row.key}
                label={row.key}
                value={row.value}
                valueColor={row.valueColor}
              />
            ))}
          </dl>

          {/* Description */}
          {selection.description && (
            <div className="flex flex-col gap-1 border-t border-dashed border-border/60 pt-3">
              <span className="font-mono text-[10px] tracking-widest text-muted">
                DESCRIPCIÓN
              </span>
              <p className="font-mono text-xs leading-relaxed text-secondary">
                {selection.description}
              </p>
            </div>
          )}
        </div>

        {/* Hazard-stripe accent above CTA — visual cue that this is the
            commit step. */}
        <div
          aria-hidden
          className="h-1.5 w-full shrink-0"
          style={{
            backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 6px, transparent 6px 12px)`,
          }}
        />

        {/* Big confirm CTA */}
        <button
          type="button"
          onClick={triggerConfirm}
          className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-4 font-syne text-base font-black tracking-widest transition-colors"
          style={{ color, backgroundColor: `${color}26` }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${color}40`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${color}26`
          }}
        >
          <span>{ctaLabel}</span>
          <span aria-hidden className="text-xl">
            ›
          </span>
        </button>

        {/* Phosphor warm-up flash — one-shot on mount */}
        {!exiting && (
          <div
            className="overlay-phosphor-in pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                'radial-gradient(circle at center, rgba(255,140,0,0.38) 0%, transparent 60%)',
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-2">
      <dt className="tracking-widest text-muted">{label}</dt>
      <dd
        className="truncate text-secondary"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}
