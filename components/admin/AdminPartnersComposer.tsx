'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
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

function isPartnerKind(v: string | null): v is PartnerKind {
  return v != null && v in PARTNER_KIND_COLOR
}

// AdminPartnersComposer — admin-only form for onboarding a new partner.
// Mints an `items` row with type='partner' via POST /api/admin/partners.
// Existing partners list above the form serves as a duplicate-check
// reference; v1 is create-only (no inline edit).
export function AdminPartnersComposer({
  existing,
}: {
  existing: ExistingPartner[]
}) {
  const router = useRouter()
  const { currentUser } = useAuth()

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
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-derive slug from title until the admin manually edits it.
  useEffect(() => {
    if (slugManuallyEdited) return
    setSlug(slugify(title))
  }, [title, slugManuallyEdited])

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

  const reset = () => {
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreated(null)
    setSubmitting(true)
    try {
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
      setCreated({ id: json.partner.id, title: json.partner.title })
      reset()
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Existing partners — duplicate-check reference */}
      <div className="flex flex-col gap-3 border border-border p-4">
        <header>
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: '#FB923C' }}
          >
            //PARTNERS EXISTENTES · {existing.length}
          </span>
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
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px]"
                  style={{ borderColor: color }}
                >
                  <span className="text-primary">{p.title}</span>
                  {kind && (
                    <span style={{ color }} className="tracking-widest">
                      · {kind.toUpperCase()}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 border border-border p-4"
      >
        <header className="flex flex-col gap-1">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: '#FB923C' }}
          >
            //NUEVO PARTNER
          </span>
          <h2 className="font-syne text-xl font-bold leading-tight text-primary">
            Onboarding
          </h2>
          <p className="font-mono text-[10px] leading-relaxed text-muted">
            Crea la entrada base. Después podés enlazar usuarios a este
            partner desde //USUARIOS y publicar listados de marketplace
            desde el dashboard del propio partner-admin.
          </p>
        </header>

        {created && (
          <p className="border border-sys-green bg-sys-green/10 px-3 py-2 font-mono text-[10px] text-sys-green">
            ✓ CREADO — <span className="text-primary">{created.title}</span>{' '}
            · id <span className="text-primary">{created.id}</span>
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

          <Field label="SLUG" required hint="auto desde el title — editable">
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugManuallyEdited(true)
                setSlug(slugify(e.target.value))
              }}
              placeholder="naafi"
              required
              className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
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

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting || imageUploading || !imageUrl}
            className="border border-sys-green px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-green transition-colors hover:bg-sys-green/10 disabled:opacity-40"
          >
            {submitting ? 'CREANDO...' : 'CREAR PARTNER'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={submitting}
            className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary disabled:opacity-40"
          >
            LIMPIAR
          </button>
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
