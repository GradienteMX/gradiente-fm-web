'use client'

import { useEffect, useMemo } from 'react'
import type { ContentItem } from '@/lib/types'
import { getRelatedByVibe } from '@/lib/itemsCache'
import { fmtDateFull, isEditableTarget } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { ContentCard } from '@/components/cards/ContentCard'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { VibeFader } from '@/components/VibeFader'
import { OverlayLinks } from './OverlayLinks'
import { OverlayEntities } from './OverlayEntities'
import { AudioPlayer3D } from '@/components/audio/AudioPlayer3D'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { pickPlayableSource, pickOpenSourceUrl } from '@/components/audio/sources'
import { PLATFORM_LABELS, MIXCLOUD_UNSUPPORTED_NOTE } from '@/components/embed/platforms'
import {
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'

// ── MixOverlay — the record sleeve (fase C, «EL PLIEGO») ────────────────────
//
// Left: the editorial column on paper — MIX eyebrow in the swatch+code
// register, Syne title, spec-sheet meta dl on hairlines, the VibeFader on its
// black faceplate seat (instrument doctrine — the fader's grips/meter are
// dark-ground calibrated, same seat as the dashboard ReproductorWidget),
// body, paper genre chips.
//
// Right: the SYSTEM column — the instrument stack. AudioPlayer3D mounts
// UNTOUCHED inside an ink bezel (it is already a dark instrument); the status
// machine below re-voices the SAME real states onto paper (acid dot = live,
// sys-red-paper = error, ink otherwise). CONTEXTO and TRACKLIST are printed
// panels; the tracklist is a mono table on hairline rows.

interface Props {
  item: ContentItem
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2'

function fmtDurationHm(duration?: string): string {
  if (!duration) return '—'
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) {
    const [h, m] = parts
    return `${h} h ${String(m).padStart(2, '0')} min`
  }
  if (parts.length === 2) {
    const [m] = parts
    return `${m} min`
  }
  return duration
}

// mixStatus is REAL composer-authored catalog data (disponible / exclusivo /
// archivo / proximamente — see MixForm), not decorative status copy, so the
// CONTEXTO row stays. Only the old green accent died: on paper the value is
// plain ink like every other row.
const STATUS_LABEL: Record<NonNullable<ContentItem['mixStatus']>, string> = {
  disponible: 'Disponible',
  exclusivo: 'Exclusivo',
  archivo: 'Archivo',
  proximamente: 'Próximamente',
}

export function MixOverlay({ item }: Props) {
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  // Audio is owned by the global AudioPlayerProvider — one persistent iframe
  // + widget + tab-capture for the entire app. This overlay is only a *view*:
  // we tell the global player to load this mix when the user hits play, then
  // mirror its state back into our chrome.
  const audio = useAudioPlayer()
  // The best CONTROLLABLE source (SoundCloud / YouTube / Mixcloud / Spotify),
  // and the URL the "ABRIR FUENTE" button opens (falls back to any embed —
  // incl. Bandcamp — or the legacy mixUrl, so the link-out always works).
  const playable = pickPlayableSource(item)
  const openUrl = pickOpenSourceUrl(item)
  const openIsMixcloud = !!openUrl && openUrl.includes('mixcloud.com')
  // "Active" means this mix is the one actually loaded into a bridge — not
  // merely cued (cue sets currentItem without loading audio). Gating on
  // activePlatform keeps a cued track's overlay in the idle "PULSA PLAY" state
  // instead of a stuck "CARGANDO".
  const isActive =
    audio.activePlatform != null && audio.currentItem?.id === item.id

  // Prime the relevant platform's hidden player as soon as the overlay mounts,
  // ahead of the user's play click — so the API is bound and first play
  // autoplays within the gesture (no dead first tap on YouTube/Mixcloud/Spotify).
  useEffect(() => {
    if (playable) audio.primePlatform(playable.platform, playable.url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable?.platform, playable?.url])

  // When this is the active mix, mirror live transport. Otherwise show the
  // idle 00:00 state — pressing play will load this mix into the global player.
  const isPlaying = isActive && audio.isPlaying
  const currentTime = isActive ? audio.currentTime : 0
  const duration = isActive ? audio.duration : 0

  const openSource = () => {
    if (!openUrl) return
    window.open(openUrl, '_blank', 'noopener,noreferrer')
  }

  // Play handler defers everything to the global player. First call ever
  // requests tab capture; subsequent calls just switch tracks (no popup) or
  // toggle play/pause if we're already the active mix.
  const handleTransportToggle = () => {
    void audio.loadAndPlay(item)
  }
  const handleSeek = (sec: number) => {
    if (isActive) audio.seek(sec)
  }

  // Status strip — leans on the global matrix state plus this overlay's
  // local active/idle distinction. Every label is a REAL state.
  const statusLabel = (() => {
    if (audio.matrixActive) return 'CAPTURA EN VIVO'
    if (audio.matrixStatus === 'requesting') return 'SOLICITANDO PERMISO'
    if (audio.matrixStatus === 'denied') return 'PERMISO DENEGADO'
    if (audio.matrixStatus === 'unsupported') return 'NO COMPATIBLE'
    if (isPlaying) return 'REPRODUCIENDO'
    // Active but the bridge is still booting (cold-primed platform whose API
    // hasn't readied) — show loading, not a misleading "press play".
    if (isActive && !audio.widgetReady) return 'CARGANDO'
    if (isActive) return 'EN ESPERA'
    return 'PULSA PLAY'
  })()
  const statusTone: 'live' | 'paused' | 'idle' | 'error' =
    audio.matrixActive
      ? 'live'
      : audio.matrixStatus === 'denied' ||
          audio.matrixStatus === 'unsupported' ||
          audio.matrixStatus === 'error'
        ? 'error'
        : isPlaying
          ? 'live'
          : 'idle'
  const statusDetail =
    audio.matrixActive
      ? 'analizador · pestaña actual'
      : audio.matrixErrorMessage ||
        (playable
          ? isActive
            ? 'pulsa play para reanudar'
            : `pulsa play para cargar este mix · ${PLATFORM_LABELS[playable.platform]}`
          : 'fuente pendiente')

  // Hotkeys: O → open source. P → play/pause (or load). Skip when focus
  // is inside an editable element — MixOverlay also renders inside the
  // dashboard's LivePreview while the editor types in the composer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === 'o' || e.key === 'O') openSource()
      if (e.key === 'p' || e.key === 'P') handleTransportToggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openUrl, item.id])

  return (
    <article className="grid grid-cols-1 gap-0 bg-paper text-ink md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── LEFT: editorial column ──────────────────────────── */}
      <div className="flex flex-col gap-5 p-5 md:p-7">
        {/* Type eyebrow — swatch + 2-letter code (hue never the sole signal) */}
        <span className="inline-flex w-fit items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          <span
            aria-hidden
            className="h-[9px] w-[9px] shrink-0"
            style={{ backgroundColor: categoryColorOnLight(item.type) }}
          />
          {typeCode(item.type)} · {typeDisplayLabel(item.type)}
        </span>

        {/* Title */}
        <header className="flex flex-col gap-2">
          <h1 className="font-syne text-3xl font-black leading-[1.02] text-ink md:text-[44px]">
            {item.title}
          </h1>
          {item.subtitle && (
            <p className="font-syne text-2xl font-black leading-[1.05] text-ink md:text-[34px]">
              {item.subtitle}
            </p>
          )}
        </header>

        {item.excerpt && (
          <p className="font-grotesk text-sm leading-relaxed text-ink-soft md:text-[15px]">
            {item.excerpt}
          </p>
        )}

        {/* Meta dl — spec-sheet rows on hairlines */}
        <dl className="flex flex-col divide-y divide-ink-faint border-y border-ink">
          {item.author && (
            <div className="grid grid-cols-[110px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                ARTISTA
              </dt>
              <dd className="font-mono text-d13 text-ink">{item.author}</dd>
            </div>
          )}
          {item.publishedAt && (
            <div className="grid grid-cols-[110px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                PUBLICADO
              </dt>
              <dd className="font-mono text-d13 text-ink-soft">
                {fmtDateFull(item.publishedAt)}
              </dd>
            </div>
          )}
          {item.duration && (
            <div className="grid grid-cols-[110px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                DURACIÓN
              </dt>
              <dd className="font-mono text-d13 text-ink">
                {fmtDurationHm(item.duration)}
              </dd>
            </div>
          )}
        </dl>

        {/* Vibe fader — the REAL fader, byte-untouched, on its black
            faceplate seat (grips/meter are dark-ground calibrated). */}
        <div className="flex items-center gap-3 border border-ink bg-panel px-3 py-2">
          <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-panel-text">
            VIBE
          </span>
          <VibeFader item={item} />
        </div>

        {/* Body */}
        {item.bodyPreview && (
          <div className="flex flex-col gap-4 font-grotesk text-sm leading-relaxed text-ink md:text-[15px]">
            {item.bodyPreview.split('\n').map((p, i) =>
              p.trim() ? (
                <p key={i}>{p}</p>
              ) : null,
            )}
          </div>
        )}

        {/* Genres at bottom */}
        {genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                ground="paper"
                className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
              >
                {name}
              </GenreChipButton>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: system column — the instrument stack ──────── */}
      <div className="flex flex-col gap-4 border-t border-ink p-4 md:border-l md:border-t-0 md:p-5">
        {/* 01 REPRODUCTOR — view-only. Transport drives the global
            AudioPlayerProvider (hidden iframe lives at layout root), so
            closing this overlay does NOT stop playback. The matrix
            visualizer reads the same tab-capture stream as the persistent
            HUD in the sidebar. AudioPlayer3D is a dark instrument and mounts
            UNTOUCHED — the ink bezel frames it; the printed caption below
            re-voices its real state onto paper. */}
        {playable ? (
          <div className="flex flex-col gap-1.5">
            <div className="border border-ink bg-panel p-1.5">
              <AudioPlayer3D
                dataRef={audio.dataRef}
                sampleRate={audio.sampleRate}
                title={item.title}
                subtitle={item.subtitle}
                source={item.author}
                coverUrl={item.imageUrl}
                coverLabel={item.mixSeries}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                onPlayPause={handleTransportToggle}
                onSeek={handleSeek}
                liveMatrixActive={audio.matrixActive}
                onOpenSource={openSource}
                sourceUrl={openUrl ?? undefined}
                statusLabel={statusLabel}
                statusTone={statusTone}
                statusDetail={statusDetail}
              />
            </div>
            {/* Printed status caption — same machine, paper voice. Tones:
                acid dot (ink-outlined, ≥8px) = live signal, sys-red-paper =
                error, ink otherwise. All states are real provider states. */}
            <div className="flex min-w-0 items-center gap-2 font-mono text-d11">
              {statusTone === 'live' && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full border border-ink bg-acid"
                />
              )}
              <span
                className={`shrink-0 font-bold tracking-widest ${
                  statusTone === 'error' ? 'text-sys-red-paper' : 'text-ink'
                }`}
              >
                {statusLabel}
              </span>
              <span className="min-w-0 truncate text-ink-faint">
                {statusDetail}
              </span>
            </div>
          </div>
        ) : openUrl ? (
          // A source exists but isn't controllable in-app (Bandcamp, or an
          // unrecognised host). Offer the working link-out instead of a dead
          // panel — never trap the user with an empty REPRODUCTOR.
          <Panel title="REPRODUCTOR">
            <p className="font-mono text-d11 leading-relaxed text-ink-soft">
              {openIsMixcloud
                ? MIXCLOUD_UNSUPPORTED_NOTE
                : 'Esta fuente no se puede reproducir dentro de Gradiente. Ábrela en su plataforma original.'}
            </p>
            <button
              type="button"
              onClick={openSource}
              className={`mt-3 inline-flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d11 tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper-raised ${FOCUS}`}
            >
              {openIsMixcloud ? 'ABRIR EN MIXCLOUD' : 'ABRIR FUENTE'}
              <span aria-hidden>↗</span>
            </button>
          </Panel>
        ) : (
          <Panel title="REPRODUCTOR">
            <p className="font-mono text-d11 text-ink-soft">
              Sin fuente configurada para este mix.
            </p>
          </Panel>
        )}

        {/* 02 CONTEXTO — the paper dl. */}
        <Panel title="CONTEXTO">
          <dl className="grid grid-cols-[max-content_auto_1fr] gap-x-3 gap-y-1.5 font-mono text-d11">
            {item.mixSeries && (
              <ContextRow label="SERIE" value={item.mixSeries} />
            )}
            {item.recordedIn && (
              <ContextRow label="GRABADO EN" value={item.recordedIn} />
            )}
            {item.mixFormat && (
              <ContextRow label="FORMATO" value={item.mixFormat} />
            )}
            {item.bpmRange && (
              <ContextRow label="BPM" value={item.bpmRange} />
            )}
            {item.musicalKey && (
              <ContextRow label="KEY" value={item.musicalKey} />
            )}
            {item.mixStatus && (
              <ContextRow
                label="ESTATUS"
                value={STATUS_LABEL[item.mixStatus]}
              />
            )}
            {!item.mixSeries &&
              !item.recordedIn &&
              !item.mixFormat &&
              !item.bpmRange &&
              !item.musicalKey &&
              !item.mixStatus && (
                <div className="col-span-3 font-mono text-d11 text-ink-faint">
                  Sin metadata de contexto.
                </div>
              )}
          </dl>
          <div className="mt-3 flex flex-col gap-3">
            <OverlayEntities entities={item.entities} />
            <OverlayLinks links={item.links} />
          </div>
        </Panel>

        {/* 03 TRACKLIST / ETIQUETAS — printed table on hairline rows */}
        <Panel title="TRACKLIST / ETIQUETAS">
          {item.tracklist && item.tracklist.length > 0 ? (
            <div className="flex flex-col font-mono text-d11">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)_48px] gap-2 border-b border-ink pb-1 text-[10px] font-bold tracking-widest text-ink-soft">
                <span>#</span>
                <span>ARTISTA</span>
                <span>TEMA</span>
                <span className="text-right">BPM</span>
              </div>
              <div className="flex flex-col divide-y divide-ink-faint">
                {item.tracklist.map((t, i) => (
                  <div
                    key={i}
                    className="group grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)_48px] gap-2 py-1 transition-colors hover:bg-ink"
                  >
                    <span className="text-ink-faint group-hover:text-paper-raised">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-ink group-hover:text-paper-raised">
                      {t.artist}
                    </span>
                    <span className="truncate text-ink-soft group-hover:text-paper-raised">
                      {t.title}
                    </span>
                    <span className="text-right text-ink-faint group-hover:text-paper-raised">
                      {t.bpm ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-mono text-d11 text-ink-faint">
              Tracklist no publicado.
            </p>
          )}

          {tags.length > 0 && (
            <div className="mt-4 border-t border-ink-faint pt-3">
              <span className="mb-2 block font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                ETIQUETAS
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="border border-ink-faint px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Poll — when the mix has an attached poll, render between the
            tracklist panel and the hotkeys footer. Choices auto-derive
            from the mix's tracklist. */}
        {item.poll && <PollSection item={item} />}

        {/* Hotkeys hint footer */}
        <div className="flex items-center justify-end gap-3 border-t border-ink pt-2 font-mono text-[10px] tracking-widest text-ink-faint">
          <span>
            <span className="font-bold text-ink">O</span> ABRIR FUENTE
          </span>
          <span>
            <span className="font-bold text-ink">ESC</span> CERRAR
          </span>
        </div>

        {/* Related mixes — curated by genre overlap, fallback to recent */}
        <RelatedMixes item={item} />
      </div>
    </article>
  )
}

// ── Related mixes ───────────────────────────────────────────────────────────
// Up to 3 other REAL mixes from whatever the feed already streamed into the
// client items cache — ranked by vibe closeness exclusively, tie-broken by
// grid neighborhood (the mix most directly below this one in the mosaic).
// The cards are the fase-B paper ContentCards — card→overlay→card stays
// paper→paper.
function RelatedMixes({ item }: Props) {
  const related = useMemo(
    () => getRelatedByVibe(item, { types: ['mix'], limit: 3 }),
    [item],
  )

  if (related.length === 0) return null

  return (
    <section className="mt-2 border-t border-ink pt-3">
      <header className="mb-3">
        <span className="font-mono text-d11 font-bold tracking-widest text-ink">
          SIGUIENTES MIXES
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {related.map((r) => (
          <div key={r.id} className="h-[220px]">
            <ContentCard item={r} size="sm" />
          </div>
        ))}
      </div>
    </section>
  )
}

// Printed panel — paper-raised plate with an ink hairline header.
function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="relative border border-ink bg-paper-raised p-3">
      <header className="mb-3 border-b border-ink pb-2">
        <span className="font-mono text-d11 font-bold tracking-widest text-ink">
          {title}
        </span>
      </header>
      {children}
    </section>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        {label}
      </dt>
      <dd className="text-ink-faint">:</dd>
      <dd className="text-ink">{value}</dd>
    </>
  )
}
