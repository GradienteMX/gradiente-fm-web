'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { usePrompt } from '@/components/prompt/usePrompt'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { slugify, VibeField } from '@/components/dashboard/forms/shared/Fields'
import type { Database } from '@/lib/supabase/database.types'

type PartnerKind = Database['public']['Enums']['partner_kind']

const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  promo: 'PROMO · promoción general',
  label: 'LABEL · sello discográfico',
  promoter: 'PROMOTER · evento / colectivo',
  venue: 'VENUE · espacio físico',
  sponsored: 'SPONSORED · patrocinador pagado',
  dealer: 'DEALER · vinilos / equipo / merch',
}

const PARTNER_KIND_COLOR: Record<PartnerKind, string> = {
  promo: '#22D3EE',
  label: '#A78BFA',
  promoter: '#F97316',
  venue: '#FB923C',
  sponsored: '#EAB308',
  dealer: '#10B981',
}

interface ExistingPartner {
  id: string
  title: string
  // string | null because the upstream PartnerOption uses the wider type
  // (it's pulled from a SELECT that doesn't narrow to the enum). Render
  // logic guards against unknown kinds via the lookup map.
  partner_kind: string | null
}

// Detail shape returned by GET /api/admin/partners/[id] — drives the edit
// form prefill. Wider than ExistingPartner (which only carries enough for
// the catalog overview).
interface PartnerDetail {
  id: string
  slug: string
  title: string
  partner_kind: PartnerKind
  partner_url: string | null
  image_url: string
  vibe_min: number
  vibe_max: number
  marketplace_enabled: boolean
  marketplace_description: string | null
  marketplace_location: string | null
  marketplace_currency: string | null
}

function isPartnerKind(v: string | null): v is PartnerKind {
  return v != null && v in PARTNER_KIND_COLOR
}

type Mode = { kind: 'create' } | { kind: 'edit'; partnerId: string }

// AdminPartnersComposer — admin-only form for onboarding a new partner OR
// editing / deleting an existing one. Tabbed by mode:
//   - create: blank form, CREAR PARTNER button
//   - edit:   prefilled from GET /api/admin/partners/[id], GUARDAR + BORRAR
//             buttons. Borrar opens a typeToConfirm overlay requiring the
//             admin to type "BORRAR <partner name>" verbatim.
//
// Cascades on hard delete (per migration 0001 schema):
//   comments / user_saves / polls / hp_events on this partner item are
//   CASCADE deleted; users.partner_id + invite_codes.intended_partner_id
//   pointing here go to NULL (team members + pending invites lose the
//   link but their accounts / codes survive).
export function AdminPartnersComposer({
  existing,
}: {
  existing: ExistingPartner[]
}) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { typeToConfirm } = usePrompt()

  const [mode, setMode] = useState<Mode>({ kind: 'create' })
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [partnerKind, setPartnerKind] = useState<PartnerKind>('promo')
  const [partnerUrl, setPartnerUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  // Partners are typically wide-band (a label spans multiple vibes); admin
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
    setPartnerKind('promo')
    setPartnerUrl('')
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

  const enterEditMode = async (partnerId: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/partners/${encodeURIComponent(partnerId)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'FAILED' }))
        setError((body.error ?? 'FAILED').toString().toUpperCase())
        return
      }
      const json = await res.json()
      const p = json.partner as PartnerDetail
      // Hydrate form state from the detail.
      setTitle(p.title)
      setSlug(p.slug)
      // Slug is read-only in edit mode (changing it would break links).
      // Set the manual-edit gate so the create-mode auto-derive doesn't fire.
      setSlugManuallyEdited(true)
      setPartnerKind(p.partner_kind)
      setPartnerUrl(p.partner_url ?? '')
      setImageUrl(p.image_url)
      setVibeMin(p.vibe_min)
      setVibeMax(p.vibe_max)
      setMarketplaceEnabled(p.marketplace_enabled)
      setMarketplaceLocation(p.marketplace_location ?? '')
      setMarketplaceCurrency(p.marketplace_currency ?? 'MXN')
      setMarketplaceDescription(p.marketplace_description ?? '')
      setMode({ kind: 'edit', partnerId: p.id })
      setFlash(null)
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
        const res = await fetch('/api/admin/partners', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            partner_kind: partnerKind,
            partner_url: partnerUrl.trim() || undefined,
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
        setFlash({ kind: 'created', title: json.partner.title })
        resetForm()
        router.refresh()
      } else {
        const res = await fetch(
          `/api/admin/partners/${encodeURIComponent(mode.partnerId)}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              partner_kind: partnerKind,
              partner_url: partnerUrl.trim(),
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
        setFlash({ kind: 'updated', title: json.partner.title })
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (mode.kind !== 'edit') return
    const partnerTitle = title.trim()
    const required = `BORRAR ${partnerTitle}`
    const confirmed = await typeToConfirm({
      title: `Borrar ${partnerTitle}`,
      body:
        `Esta acción es permanente. Se eliminará el registro del partner y por cascada de FK también sus comentarios, guardados, polls y eventos HP. ` +
        `Los miembros del equipo (users.partner_id) y códigos de invitación pendientes asociados quedarán desvinculados pero conservados.`,
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
        `/api/admin/partners/${encodeURIComponent(mode.partnerId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'FAILED' }))
        setError((body.error ?? 'FAILED').toString().toUpperCase())
        return
      }
      setFlash({ kind: 'deleted', title: partnerTitle })
      enterCreateMode()
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Existing partners — clickable cards. Click loads the partner into
          edit mode below. */}
      <div className="flex flex-col gap-3 border border-border p-4">
        <header className="flex items-center justify-between gap-3">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: '#FB923C' }}
          >
            //PARTNERS EXISTENTES · {existing.length}
          </span>
          {mode.kind === 'edit' && (
            <button
              type="button"
              onClick={enterCreateMode}
              className="flex items-center gap-1 border border-border px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
            >
              <Plus size={11} strokeWidth={1.5} />
              NUEVO
            </button>
          )}
        </header>
        {existing.length === 0 ? (
          <p className="font-mono text-[11px] text-muted">
            // ningún partner aún — el primero abajo
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {existing.map((p) => {
              const kind = isPartnerKind(p.partner_kind) ? p.partner_kind : null
              const color = kind ? PARTNER_KIND_COLOR[kind] : '#888888'
              const isSelected = mode.kind === 'edit' && mode.partnerId === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => enterEditMode(p.id)}
                    disabled={loadingDetail || isSelected}
                    aria-pressed={isSelected}
                    className="flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] transition-colors hover:bg-white/[0.03] disabled:cursor-default"
                    style={{
                      borderColor: color,
                      backgroundColor: isSelected ? `${color}1a` : 'transparent',
                    }}
                  >
                    <Pencil size={9} strokeWidth={1.5} className="opacity-50" />
                    <span className="text-primary">{p.title}</span>
                    {kind && (
                      <span style={{ color }} className="tracking-widest">
                        · {kind.toUpperCase()}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {loadingDetail && (
          <p className="font-mono text-[10px] text-muted">// cargando detalles…</p>
        )}
      </div>

      {/* Composer — same form for create + edit. The mode flag swaps the
          header copy + the action buttons. */}
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 border border-border p-4"
      >
        <header className="flex flex-col gap-1">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: '#FB923C' }}
          >
            //{mode.kind === 'create' ? 'NUEVO PARTNER' : `EDITANDO · ${title || '(sin título)'}`}
          </span>
          <h2 className="font-syne text-xl font-bold leading-tight text-primary">
            {mode.kind === 'create' ? 'Onboarding' : 'Editar partner'}
          </h2>
          <p className="font-mono text-[10px] leading-relaxed text-muted">
            {mode.kind === 'create' ? (
              <>
                Crea la entrada base. Después podés enlazar usuarios a este
                partner desde //USUARIOS y publicar listados de marketplace
                desde el dashboard del propio partner-admin.
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
            className="border px-3 py-2 font-mono text-[10px]"
            style={{
              borderColor: flash.kind === 'deleted' ? '#E63329' : '#22c55e',
              color: flash.kind === 'deleted' ? '#E63329' : '#22c55e',
              backgroundColor:
                flash.kind === 'deleted' ? 'rgba(230,51,41,0.08)' : 'rgba(34,197,94,0.08)',
            }}
          >
            {flash.kind === 'created' && (
              <>✓ CREADO — <span className="text-primary">{flash.title}</span></>
            )}
            {flash.kind === 'updated' && (
              <>✓ ACTUALIZADO — <span className="text-primary">{flash.title}</span></>
            )}
            {flash.kind === 'deleted' && (
              <>⌫ BORRADO — <span className="text-primary">{flash.title}</span></>
            )}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="TITLE" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="N.A.A.F.I."
              required
              className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
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
              className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none read-only:opacity-60"
            />
          </Field>

          <Field label="PARTNER KIND" required>
            <select
              value={partnerKind}
              onChange={(e) => setPartnerKind(e.target.value as PartnerKind)}
              className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
            >
              {(Object.keys(PARTNER_KIND_LABEL) as PartnerKind[]).map((k) => (
                <option key={k} value={k}>
                  {PARTNER_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="PARTNER URL" hint="opcional — sitio externo">
            <input
              type="url"
              value={partnerUrl}
              onChange={(e) => setPartnerUrl(e.target.value)}
              placeholder="https://naafi.bandcamp.com"
              className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
            />
          </Field>

          <Field label="" hint="0 glacial → 10 volcán · partners suelen ocupar un rango ancho">
            <VibeField
              valueMin={vibeMin}
              valueMax={vibeMax}
              onChange={(min, max) => {
                setVibeMin(min)
                setVibeMax(max)
              }}
            />
          </Field>

          <Field label="IMAGEN" required hint="logo / portada (≤1MB tras compresión)">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                disabled={imageUploading}
                className="font-mono text-[10px] text-secondary"
              />
              {imageUploading && (
                <span className="font-mono text-[9px] tracking-widest text-sys-green">
                  SUBIENDO...
                </span>
              )}
            </div>
            {imageUrl && !imageUploading && (
              <div className="mt-1 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="h-12 w-12 border border-border bg-elevated object-cover"
                />
                <span className="truncate font-mono text-[9px] text-muted" title={imageUrl}>
                  {imageUrl.split('/').pop()}
                </span>
              </div>
            )}
            {imageError && (
              <p className="mt-1 font-mono text-[9px] text-sys-red">// {imageError.toUpperCase()}</p>
            )}
          </Field>
        </div>

        {/* Marketplace toggle + conditional fields */}
        <div className="flex flex-col gap-3 border-t border-border/50 pt-3">
          <label className="flex items-center gap-2 font-mono text-[11px] text-secondary">
            <input
              type="checkbox"
              checked={marketplaceEnabled}
              onChange={(e) => setMarketplaceEnabled(e.target.checked)}
              className="accent-cyan-400"
            />
            Habilitar MARKETPLACE para este partner
          </label>

          {marketplaceEnabled && (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="UBICACIÓN">
                <input
                  type="text"
                  value={marketplaceLocation}
                  onChange={(e) => setMarketplaceLocation(e.target.value)}
                  placeholder="Roma Norte, CDMX"
                  className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
                />
              </Field>
              <Field label="MONEDA">
                <input
                  type="text"
                  value={marketplaceCurrency}
                  onChange={(e) => setMarketplaceCurrency(e.target.value.toUpperCase())}
                  placeholder="MXN"
                  maxLength={4}
                  className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
                />
              </Field>
              <Field label="DESCRIPCIÓN" className="md:col-span-3">
                <textarea
                  value={marketplaceDescription}
                  onChange={(e) => setMarketplaceDescription(e.target.value)}
                  placeholder="Sello + colectivo de música electrónica con base en CDMX..."
                  rows={2}
                  className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
                />
              </Field>
            </div>
          )}
        </div>

        {error && (
          <p className="font-mono text-[10px] text-sys-red">// {error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || imageUploading || !imageUrl || deleting}
              className="border border-sys-green px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-green transition-colors hover:bg-sys-green/10 disabled:opacity-40"
            >
              {submitting
                ? mode.kind === 'create' ? 'CREANDO...' : 'GUARDANDO...'
                : mode.kind === 'create' ? 'CREAR PARTNER' : 'GUARDAR CAMBIOS'}
            </button>
            {mode.kind === 'create' ? (
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary disabled:opacity-40"
              >
                LIMPIAR
              </button>
            ) : (
              <button
                type="button"
                onClick={enterCreateMode}
                disabled={submitting || deleting}
                className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary disabled:opacity-40"
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
              className="flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:opacity-40"
              style={{
                borderColor: '#E63329',
                color: '#E63329',
                backgroundColor: 'rgba(230,51,41,0.06)',
              }}
            >
              <Trash2 size={11} strokeWidth={1.5} />
              {deleting ? 'BORRANDO...' : 'BORRAR PARTNER'}
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
    <label className={`flex flex-col gap-1 font-mono text-[10px] tracking-widest text-muted ${className}`}>
      <span>
        {label}
        {required && <span className="text-sys-red"> *</span>}
        {hint && <span className="ml-2 text-muted/60 normal-case tracking-normal">— {hint}</span>}
      </span>
      {children}
    </label>
  )
}
