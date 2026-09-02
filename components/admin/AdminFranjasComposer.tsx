'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { usePrompt } from '@/components/prompt/usePrompt'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { slugify } from '@/components/dashboard/forms/shared/Fields'
import { VibeFieldL } from '@/components/dashboard/compose/kit/VibeFieldL'
import { PliegoSection } from '@/components/dashboard/compose/kit/PliegoSection'
import type { Database } from '@/lib/supabase/database.types'

type FranjaKind = Database['public']['Enums']['franja_kind']

const FRANJA_KIND_LABEL: Record<FranjaKind, string> = {
  label: 'LABEL · sello discográfico',
  promoter: 'PROMOTER · evento / promotora',
  venue: 'VENUE · espacio físico',
  plataforma: 'PLATAFORMA · servicio / boletera',
  dealer: 'DEALER · vinilos / equipo / merch',
  colectivo: 'COLECTIVO · crew / colectivo',
  festival: 'FESTIVAL · festival',
  club: 'CLUB · club nocturno',
  medios: 'MEDIOS · medio / prensa',
  'mix-series': 'MIX-SERIES · serie de mixes',
}

interface ExistingFranja {
  id: string
  title: string
  // string | null because the upstream FranjaOption uses the wider type
  // (it's pulled from a SELECT that doesn't narrow to the enum). Render
  // logic guards against unknown kinds via the lookup map.
  franja_kind: string | null
}

// Detail shape returned by GET /api/admin/franjas/[id] — drives the edit
// form prefill. Wider than ExistingFranja (which only carries enough for
// the catalog overview).
interface FranjaDetail {
  id: string
  slug: string
  title: string
  franja_kind: FranjaKind
  franja_url: string | null
  image_url: string
  vibe_min: number
  vibe_max: number
  marketplace_enabled: boolean
  marketplace_description: string | null
  marketplace_location: string | null
  marketplace_currency: string | null
}

function isFranjaKind(v: string | null): v is FranjaKind {
  return v != null && v in FRANJA_KIND_LABEL
}

type Mode = { kind: 'create' } | { kind: 'edit'; franjaId: string }

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

const INPUT_CLS = `min-h-11 w-full border border-ink bg-paper px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white read-only:bg-paper-raised read-only:text-ink-faint ${FOCUS_RING}`

// AdminFranjasComposer — admin-only form for onboarding a new franja OR
// editing / deleting an existing one. Tabbed by mode:
//   - create: blank form, CREAR FRANJA button
//   - edit:   prefilled from GET /api/admin/franjas/[id], GUARDAR + BORRAR
//             buttons. Borrar opens a typeToConfirm overlay requiring the
//             admin to type "BORRAR <franja name>" verbatim.
//
// Cascades on hard delete (per migration 0001 schema):
//   comments / user_saves / polls / hp_events on this franja item are
//   CASCADE deleted; users.franja_id + invite_codes.intended_franja_id
//   pointing here go to NULL (team members + pending invites lose the
//   link but their accounts / codes survive).
//
// MARKETPLACE GOVERNANCE — activation is SELF-SERVICE for the franja team
// (they switch their own storefront on from their space). Admin keeps ONE
// power over it: the abuse kill-switch in section 04, which hides a
// storefront regardless of what its team set. This surface is therefore not
// an approval queue, and the create form does not offer activation at all.
//
// «EL PLIEGO» chrome (fase F): the composer is the compose pliego's numbered
// section register; the kind hue map is retired (a kind is a word, not a
// colour) and the two shared field machines moved to their pliego forks
// (VibeFieldL / the paper inputs) — identical props, identical payloads.
export function AdminFranjasComposer({
  existing,
}: {
  existing: ExistingFranja[]
}) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { typeToConfirm } = usePrompt()

  const [mode, setMode] = useState<Mode>({ kind: 'create' })
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [franjaKind, setFranjaKind] = useState<FranjaKind>('colectivo')
  const [franjaUrl, setFranjaUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  // Franjas are typically wide-band (a label spans multiple vibes); admin
  // slides the thumbs apart in the composer rather than getting a forced
  // wide default. Both at 5 keeps the initial state explicit.
  const [vibeMin, setVibeMin] = useState(5)
  const [vibeMax, setVibeMax] = useState(5)
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false)
  const [marketplaceLocation, setMarketplaceLocation] = useState('')
  const [marketplaceCurrency, setMarketplaceCurrency] = useState('MXN')
  const [marketplaceDescription, setMarketplaceDescription] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ kind: 'created' | 'updated' | 'deleted'; title: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-derive slug from title until the admin manually edits it.
  // In edit mode the slug is read-only anyway, but keep the gate consistent.
  useEffect(() => {
    if (mode.kind === 'edit') return
    if (slugManuallyEdited) return
    setSlug(slugify(title))
  }, [title, slugManuallyEdited, mode.kind])

  const resetForm = () => {
    setTitle('')
    setSlug('')
    setSlugManuallyEdited(false)
    setFranjaKind('colectivo')
    setFranjaUrl('')
    setImageUrl('')
    setVibeMin(5)
    setVibeMax(5)
    setMarketplaceEnabled(false)
    setMarketplaceLocation('')
    setMarketplaceCurrency('MXN')
    setMarketplaceDescription('')
    setError(null)
  }

  const enterCreateMode = () => {
    setMode({ kind: 'create' })
    resetForm()
  }

  const enterEditMode = async (franjaId: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/franjas/${encodeURIComponent(franjaId)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'FAILED' }))
        setError((body.error ?? 'FAILED').toString().toUpperCase())
        return
      }
      const json = await res.json()
      const p = json.franja as FranjaDetail
      // Hydrate form state from the detail.
      setTitle(p.title)
      setSlug(p.slug)
      // Slug is read-only in edit mode (changing it would break links).
      // Set the manual-edit gate so the create-mode auto-derive doesn't fire.
      setSlugManuallyEdited(true)
      setFranjaKind(p.franja_kind)
      setFranjaUrl(p.franja_url ?? '')
      setImageUrl(p.image_url)
      setVibeMin(p.vibe_min)
      setVibeMax(p.vibe_max)
      setMarketplaceEnabled(p.marketplace_enabled)
      setMarketplaceLocation(p.marketplace_location ?? '')
      setMarketplaceCurrency(p.marketplace_currency ?? 'MXN')
      setMarketplaceDescription(p.marketplace_description ?? '')
      setMode({ kind: 'edit', franjaId: p.id })
      setFlash(null)
    } catch {
      // Network-level failure (fetch rejected) — surface it instead of
      // letting the rejection escape silently.
      setError('SEÑAL INTERRUMPIDA — SIN RESPUESTA')
    } finally {
      setLoadingDetail(false)
    }
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!currentUser) {
      setImageError('Sesión expirada — vuelve a iniciar sesión.')
      return
    }
    setImageError(null)
    setImageUploading(true)
    try {
      const res = await compressAndUploadImage(file, currentUser.id, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
      })
      if (res.ok) setImageUrl(res.url)
      else setImageError(res.error)
    } finally {
      setImageUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFlash(null)
    setSubmitting(true)
    try {
      if (mode.kind === 'create') {
        const res = await fetch('/api/admin/franjas', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            franja_kind: franjaKind,
            franja_url: franjaUrl.trim() || undefined,
            image_url: imageUrl,
            vibe_min: vibeMin,
            vibe_max: vibeMax,
            marketplace_enabled: marketplaceEnabled,
            marketplace_description: marketplaceDescription.trim() || undefined,
            marketplace_location: marketplaceLocation.trim() || undefined,
            marketplace_currency: marketplaceCurrency.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'FAILED' }))
          setError((body.error ?? 'FAILED').toString().toUpperCase())
          return
        }
        const json = await res.json()
        setFlash({ kind: 'created', title: json.franja.title })
        resetForm()
        router.refresh()
      } else {
        const res = await fetch(
          `/api/admin/franjas/${encodeURIComponent(mode.franjaId)}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              franja_kind: franjaKind,
              franja_url: franjaUrl.trim(),
              image_url: imageUrl,
              vibe_min: vibeMin,
              vibe_max: vibeMax,
              marketplace_enabled: marketplaceEnabled,
              marketplace_description: marketplaceDescription.trim(),
              marketplace_location: marketplaceLocation.trim(),
              marketplace_currency: marketplaceCurrency.trim(),
            }),
          },
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'FAILED' }))
          setError((body.error ?? 'FAILED').toString().toUpperCase())
          return
        }
        const json = await res.json()
        setFlash({ kind: 'updated', title: json.franja.title })
        router.refresh()
      }
    } catch {
      setError('SEÑAL INTERRUMPIDA — SIN RESPUESTA')
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (mode.kind !== 'edit') return
    const franjaTitle = title.trim()
    const required = `BORRAR ${franjaTitle}`
    const confirmed = await typeToConfirm({
      title: `Borrar ${franjaTitle}`,
      body:
        `Esta acción es permanente. Se eliminará el registro del franja y por cascada de FK también sus comentarios, guardados, polls y eventos HP. ` +
        `Los miembros del equipo (users.franja_id) y códigos de invitación pendientes asociados quedarán desvinculados pero conservados.`,
      requiredText: required,
      placeholder: required,
      confirmLabel: 'BORRAR PERMANENTE',
      cancelLabel: 'CANCELAR',
      destructive: true,
    })
    if (!confirmed) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/franjas/${encodeURIComponent(mode.franjaId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'FAILED' }))
        setError((body.error ?? 'FAILED').toString().toUpperCase())
        return
      }
      setFlash({ kind: 'deleted', title: franjaTitle })
      enterCreateMode()
      router.refresh()
    } catch {
      setError('SEÑAL INTERRUMPIDA — SIN RESPUESTA')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Existing franjas — clickable chips. Click loads the franja into
          edit mode below. */}
      <div className="flex flex-col gap-3 border border-ink bg-paper-raised p-4">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            FRANJAS EXISTENTES · {existing.length}
          </span>
          {mode.kind === 'edit' && (
            <button
              type="button"
              onClick={enterCreateMode}
              className={`inline-flex min-h-11 items-center gap-1.5 border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
            >
              <Plus size={12} strokeWidth={1.5} aria-hidden />
              NUEVO
            </button>
          )}
        </header>
        {existing.length === 0 ? (
          <p className="font-mono text-d13 uppercase tracking-widest text-ink-faint">
            NINGUNA FRANJA AÚN — LA PRIMERA SE CREA ABAJO
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {existing.map((p) => {
              const kind = isFranjaKind(p.franja_kind) ? p.franja_kind : null
              const isSelected = mode.kind === 'edit' && mode.franjaId === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => enterEditMode(p.id)}
                    disabled={loadingDetail || isSelected}
                    aria-pressed={isSelected}
                    data-cue="latch"
                    className={`inline-flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d13 uppercase tracking-widest transition-colors disabled:cursor-default ${FOCUS_RING} ${
                      isSelected
                        ? 'bg-ink font-bold text-paper'
                        : 'text-ink hover:bg-ink hover:text-paper'
                    }`}
                  >
                    <Pencil size={11} strokeWidth={1.5} aria-hidden />
                    <span>{p.title}</span>
                    {kind && <span className="opacity-60">· {kind.toUpperCase()}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {loadingDetail && (
          <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            CARGANDO DETALLES…
          </p>
        )}
      </div>

      {/* Composer — same form for create + edit. The mode flag swaps the
          header copy + the action buttons. */}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 border-b border-ink pb-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {mode.kind === 'create'
              ? 'NUEVA FRANJA'
              : `EDITANDO · ${title || '(sin título)'}`}
          </span>
          <h2 className="font-syne text-d28 font-extrabold uppercase text-ink">
            {mode.kind === 'create' ? 'Onboarding' : 'Editar franja'}
          </h2>
          <p className="font-grotesk text-d13 leading-snug text-ink-soft">
            {mode.kind === 'create' ? (
              <>
                Crea la entrada base. Después podés enlazar usuarios a esta
                franja desde USUARIOS; los listados de mercado los publica el
                propio equipo desde su panel.
              </>
            ) : (
              <>
                Cambios se aplican al guardar. El slug es de solo lectura para
                no romper enlaces existentes — si necesitás renombrar, borrá y
                crea uno nuevo.
              </>
            )}
          </p>
        </header>

        {flash && (
          <p
            className={`border px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest ${
              flash.kind === 'deleted'
                ? 'border-sys-red-paper text-sys-red-paper'
                : 'border-ink bg-acid text-ink'
            }`}
          >
            {flash.kind === 'created' && <>✓ CREADA — {flash.title}</>}
            {flash.kind === 'updated' && <>✓ ACTUALIZADA — {flash.title}</>}
            {flash.kind === 'deleted' && <>⌫ BORRADA — {flash.title}</>}
          </p>
        )}

        <PliegoSection number="01" label="IDENTIDAD" required>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="TITLE" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="N.A.A.F.I."
                required
                className={INPUT_CLS}
              />
            </Field>

            <Field
              label="SLUG"
              required
              hint={
                mode.kind === 'create'
                  ? 'auto desde el title — editable'
                  : 'solo lectura — el slug fija el URL'
              }
            >
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  if (mode.kind === 'edit') return
                  setSlugManuallyEdited(true)
                  setSlug(slugify(e.target.value))
                }}
                placeholder="naafi"
                required
                readOnly={mode.kind === 'edit'}
                className={INPUT_CLS}
              />
            </Field>

            <Field label="FRANJA KIND" required>
              <select
                value={franjaKind}
                onChange={(e) => setFranjaKind(e.target.value as FranjaKind)}
                className={INPUT_CLS}
              >
                {(Object.keys(FRANJA_KIND_LABEL) as FranjaKind[]).map((k) => (
                  <option key={k} value={k}>
                    {FRANJA_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="FRANJA URL" hint="opcional — sitio externo">
              <input
                type="url"
                value={franjaUrl}
                onChange={(e) => setFranjaUrl(e.target.value)}
                placeholder="https://naafi.bandcamp.com"
                className={INPUT_CLS}
              />
            </Field>
          </div>
        </PliegoSection>

        <PliegoSection number="02" label="ESPECTRO" required>
          <Field
            label="RANGO DE VIBE"
            hint="0 glacial → 10 volcán · las franjas suelen ocupar un rango ancho"
          >
            <VibeFieldL
              valueMin={vibeMin}
              valueMax={vibeMax}
              onChange={(min, max) => {
                setVibeMin(min)
                setVibeMax(max)
              }}
            />
          </Field>
        </PliegoSection>

        <PliegoSection number="03" label="IMAGEN" required>
          <Field label="LOGO / PORTADA" hint="≤1MB tras compresión">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                disabled={imageUploading}
                aria-label="Subir logo o portada"
                className={`min-h-11 font-mono text-d11 text-ink-soft file:mr-3 file:min-h-11 file:border file:border-ink file:bg-paper file:px-3 file:font-mono file:text-d11 file:font-bold file:uppercase file:tracking-widest file:text-ink hover:file:bg-ink hover:file:text-paper ${FOCUS_RING}`}
              />
              {imageUploading && (
                <span className="font-mono text-d11 uppercase tracking-widest text-ink">
                  SUBIENDO…
                </span>
              )}
            </div>
            {imageUrl && !imageUploading && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="h-12 w-12 border border-ink bg-paper object-cover"
                />
                <span
                  className="min-w-0 truncate font-mono text-d11 text-ink-faint"
                  title={imageUrl}
                >
                  {imageUrl.split('/').pop()}
                </span>
              </div>
            )}
            {imageError && (
              <p className="mt-2 font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
                ⚠ {imageError.toUpperCase()}
              </p>
            )}
          </Field>
        </PliegoSection>

        {/* ── 04 · MERCADO — the abuse kill-switch, NOT an approval queue ──
            Activation belongs to the franja team (self-service from their
            own space). The only admin power here is hiding a storefront. */}
        <PliegoSection number="04" label="MERCADO">
          {mode.kind === 'create' ? (
            <p className="border border-dashed border-ink/45 p-4 font-grotesk text-d13 leading-relaxed text-ink-soft">
              El escaparate de mercado no se activa desde aquí: lo enciende el
              propio equipo de la franja desde su panel. Una franja nueva nace
              sin escaparate. Cuando exista, este bloque se convierte en el
              interruptor de abuso.
            </p>
          ) : (
            <>
              <p className="border border-dashed border-ink/45 p-4 font-grotesk text-d13 leading-relaxed text-ink-soft">
                <span className="font-mono font-bold uppercase tracking-widest text-ink">
                  ANULACIÓN ADMIN ·{' '}
                </span>
                la activación del mercado es autoservicio del equipo de la
                franja. Aquí sólo vive el interruptor de abuso: apagarlo oculta
                el escaparate de esta franja aunque su equipo lo tenga
                encendido.
              </p>

              <button
                type="button"
                role="switch"
                aria-checked={marketplaceEnabled}
                aria-label="Escaparate de mercado visible"
                onClick={() => setMarketplaceEnabled(!marketplaceEnabled)}
                data-cue="latch"
                className={`flex min-h-11 items-center gap-3 border px-3 font-mono text-d13 font-bold uppercase tracking-widest transition-colors ${FOCUS_RING} ${
                  marketplaceEnabled
                    ? 'border-ink bg-ink text-paper'
                    : 'border-sys-red-paper bg-sys-red-paper text-paper'
                }`}
              >
                <span
                  aria-hidden
                  className="grid h-4 w-4 place-items-center border border-paper"
                >
                  {marketplaceEnabled ? '✓' : '×'}
                </span>
                <span>
                  {marketplaceEnabled
                    ? 'ESCAPARATE VISIBLE'
                    : 'ESCAPARATE OCULTO POR ADMIN'}
                </span>
              </button>

              {marketplaceEnabled && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="UBICACIÓN">
                    <input
                      type="text"
                      value={marketplaceLocation}
                      onChange={(e) => setMarketplaceLocation(e.target.value)}
                      placeholder="Roma Norte, CDMX"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="MONEDA">
                    <input
                      type="text"
                      value={marketplaceCurrency}
                      onChange={(e) => setMarketplaceCurrency(e.target.value.toUpperCase())}
                      placeholder="MXN"
                      maxLength={4}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="DESCRIPCIÓN" className="md:col-span-3">
                    <textarea
                      value={marketplaceDescription}
                      onChange={(e) => setMarketplaceDescription(e.target.value)}
                      placeholder="Sello + colectivo de música electrónica con base en CDMX..."
                      rows={2}
                      className={`${INPUT_CLS} leading-relaxed`}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
        </PliegoSection>

        {error && (
          <p className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
            ⚠ {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary own-action — the one acid fill-block of the composer. */}
            <button
              type="submit"
              disabled={submitting || imageUploading || !imageUrl || deleting}
              className={`inline-flex min-h-11 items-center gap-3 border border-ink bg-acid px-4 font-mono text-d13 font-bold uppercase tracking-widest text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`}
            >
              {submitting
                ? mode.kind === 'create' ? 'CREANDO…' : 'GUARDANDO…'
                : mode.kind === 'create' ? 'CREAR FRANJA' : 'GUARDAR CAMBIOS'}
              <span aria-hidden>→</span>
            </button>
            {mode.kind === 'create' ? (
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className={`inline-flex min-h-11 items-center border border-ink px-4 font-mono text-d13 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                LIMPIAR
              </button>
            ) : (
              <button
                type="button"
                onClick={enterCreateMode}
                disabled={submitting || deleting}
                className={`inline-flex min-h-11 items-center border border-ink px-4 font-mono text-d13 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                CANCELAR EDICIÓN
              </button>
            )}
          </div>

          {mode.kind === 'edit' && (
            <button
              type="button"
              onClick={onDelete}
              disabled={submitting || deleting}
              className={`inline-flex min-h-11 items-center gap-2 border border-sys-red-paper px-4 font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              <Trash2 size={12} strokeWidth={1.5} aria-hidden />
              {deleting ? 'BORRANDO…' : 'BORRAR FRANJA'}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

function Field({
  label,
  hint,
  required,
  className = '',
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-soft">
        {label}
        {required && <span className="text-sys-red-paper"> *</span>}
        {hint && (
          <span className="ml-2 normal-case tracking-normal text-ink-faint">— {hint}</span>
        )}
      </span>
      {children}
    </label>
  )
}
