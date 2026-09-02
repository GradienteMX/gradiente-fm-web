'use client'

// ── MERCADO · el anuncio — vocabulary, draft shape, completitud y editor ────
//
// The listing editor of the MERCADO space, split out of MercadoSpace.tsx
// because it carries three separable things: the marketplace vocabulary
// (labels the whole space prints), the draft ↔ row mapping, and the form
// itself. The space owns the network; this file owns the paper.
//
// TRUE-DATA CONTRACT — the fields below are EXACTLY the ones the API
// whitelist accepts (app/api/franjas/[id]/listings[/[lid]]/route.ts) and the
// ones marketplace_listings actually has (migrations 0010 + 0032):
//   · there is NO inventory / stock / quantity column anywhere in the
//     schema — this editor renders none, and neither does the catalogue.
//   · status is exactly available | reserved | sold → DISPONIBLE ·
//     RESERVADO · VENDIDO. There is no BORRADOR and no AGOTADO listing.
//   · `views` exists on the row and is NEVER surfaced (no counts, no
//     popularity chrome) — it is not even mapped into the draft.
//   · embeds / related_links are in the whitelist but have no editor here,
//     so the space never sends them: a PATCH that omits a field leaves it
//     untouched, which is how an unbuilt field stays honest.
//
// COMPLETITUD: only TÍTULO is a real gate (the API 400s without it). PRECIO,
// PORTADA, DESCRIPCIÓN and VÍA DE CONTACTO are what completes an
// announcement, not what the server demands — the rail says so out loud
// instead of pretending the server is stricter than it is.
//
// Registers are the espacios kit's; the field primitives are the compose
// pliego's light fields (imported, not re-invented).

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { SmartImage } from '@/components/SmartImage'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { FOCUS_RING, InkButton } from '@/components/dashboard/espacios/kit'
import {
  FieldLabelL,
  SelectL,
  TextAreaL,
  TextFieldL,
} from '@/components/dashboard/compose/kit/fields'
import {
  SUBCATEGORIES_BY_CATEGORY,
  type MarketplaceListing,
  type MarketplaceListingCategory,
  type MarketplaceListingCondition,
  type MarketplaceListingStatus,
  type MarketplaceShippingMode,
} from '@/lib/types'

// ── Vocabulary (mirrors MercadoWidget so both surfaces print one word) ─────

export const CATEGORY_LABEL: Record<MarketplaceListingCategory, string> = {
  vinyl: 'VINILO',
  cassette: 'CASSETTE',
  cd: 'CD',
  synth: 'SYNTH',
  'drum-machine': 'DRUM MACHINE',
  turntable: 'TORNAMESA',
  mixer: 'MEZCLADORA',
  outboard: 'OUTBOARD',
  merch: 'MERCH',
  other: 'OTRO',
}

// The complete status set — three values, no more. Anything the mockup
// showed beyond these (BORRADOR, AGOTADO) does not exist in the schema.
export const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

export const STATUSES: readonly MarketplaceListingStatus[] = [
  'available',
  'reserved',
  'sold',
]

export const CONDITIONS: readonly MarketplaceListingCondition[] = [
  'NEW',
  'NM',
  'VG+',
  'VG',
  'G+',
  'G',
  'F',
]

export const SHIPPING_LABEL: Record<MarketplaceShippingMode, string> = {
  shipping: 'ENVÍO',
  local: 'ENTREGA LOCAL',
  both: 'ENVÍO O ENTREGA',
}

/** `$1,200 MXN` — the franja's currency label, never a conversion. */
export function formatPrice(price: number, currency: string | null): string {
  const amount = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
  return `$${amount} ${currency ?? 'MXN'}`
}

// Hand-rolled ids, the MiFranjaSection convention the POST route already
// receives (`mkl-<slug>-<rand>`). A collision comes back 409 and the space
// surfaces it — retrying draws a new random tail.
export function newListingId(franjaId: string): string {
  const slug = franjaId.replace(/^pa-/, '').slice(0, 12)
  const rand = Math.random().toString(36).slice(2, 8)
  return `mkl-${slug}-${rand}`
}

// ── Draft ───────────────────────────────────────────────────────────────────

export interface ListingDraft {
  title: string
  category: MarketplaceListingCategory
  subcategory: string
  condition: MarketplaceListingCondition
  status: MarketplaceListingStatus
  /** Text while editing — parsed once, at submit (parsePrice). */
  price: string
  shippingMode: MarketplaceShippingMode | ''
  description: string
  /** Comma-separated while editing; parseTags splits it for the API. */
  tags: string
  images: string[]
  saleUrl: string
  whatsapp: string
  contactEmail: string
}

export function emptyListingDraft(): ListingDraft {
  return {
    title: '',
    category: 'vinyl',
    subcategory: '',
    condition: 'VG+',
    status: 'available',
    price: '',
    shippingMode: '',
    description: '',
    tags: '',
    images: [],
    saleUrl: '',
    whatsapp: '',
    contactEmail: '',
  }
}

export function draftFromListing(listing: MarketplaceListing): ListingDraft {
  return {
    title: listing.title,
    category: listing.category,
    subcategory: listing.subcategory ?? '',
    condition: listing.condition,
    status: listing.status,
    price: listing.price ? String(listing.price) : '',
    shippingMode: listing.shippingMode ?? '',
    description: listing.description ?? '',
    tags: (listing.tags ?? []).join(', '),
    images: [...listing.images],
    saleUrl: listing.saleUrl ?? '',
    whatsapp: listing.whatsapp ?? '',
    contactEmail: listing.email ?? '',
  }
}

/** Non-negative number or 0 — the API rejects anything else. */
export function parsePrice(raw: string): number {
  const parsed = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/** `dub, white-label,  dub ` → `['dub', 'white-label']`. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>()
  for (const piece of raw.split(',')) {
    const tag = piece.trim()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

// ── Completitud del anuncio ────────────────────────────────────────────────

export const LISTING_ANCHOR_IDS = {
  title: 'mercado-field-title',
  images: 'mercado-field-images',
  price: 'mercado-field-price',
  description: 'mercado-field-description',
  contact: 'mercado-field-contact',
} as const

export type ListingCheckKey = keyof typeof LISTING_ANCHOR_IDS

export interface ListingCheck {
  key: ListingCheckKey
  label: string
  done: boolean
  /** true = the API refuses the write without it (today: TÍTULO alone). */
  required: boolean
  anchorId: string
}

export function listingChecklist(draft: ListingDraft): ListingCheck[] {
  const contact = Boolean(
    draft.whatsapp.trim() || draft.contactEmail.trim() || draft.saleUrl.trim(),
  )
  return [
    {
      key: 'title',
      label: 'TÍTULO',
      done: Boolean(draft.title.trim()),
      required: true,
      anchorId: LISTING_ANCHOR_IDS.title,
    },
    {
      key: 'images',
      label: 'PORTADA',
      done: draft.images.length > 0,
      required: false,
      anchorId: LISTING_ANCHOR_IDS.images,
    },
    {
      key: 'price',
      label: 'PRECIO',
      done: parsePrice(draft.price) > 0,
      required: false,
      anchorId: LISTING_ANCHOR_IDS.price,
    },
    {
      key: 'description',
      label: 'DESCRIPCIÓN',
      done: Boolean(draft.description.trim()),
      required: false,
      anchorId: LISTING_ANCHOR_IDS.description,
    },
    {
      key: 'contact',
      label: 'VÍA DE CONTACTO',
      done: contact,
      required: false,
      anchorId: LISTING_ANCHOR_IDS.contact,
    },
  ]
}

export function listingCompleteness(rows: ListingCheck[]): {
  done: number
  total: number
} {
  return { done: rows.filter((r) => r.done).length, total: rows.length }
}

/** Labels of the still-missing REQUIRED fields — the submit gate. */
export function listingMissingRequired(rows: ListingCheck[]): string[] {
  return rows.filter((r) => r.required && !r.done).map((r) => r.label)
}

// ── Form chrome ─────────────────────────────────────────────────────────────

function FormSection({
  number,
  label,
  id,
  children,
}: {
  number: string
  label: string
  id?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-ink pt-4 first:border-t-0 first:pt-0">
      <h4 className="mb-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        {number} · {label}
      </h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
      {children}
    </p>
  )
}

// ── Imágenes — multi-image, index 0 is the portada ─────────────────────────
//
// marketplace_listings.images is text[], so the editor is a list, not a
// single slot. Upload goes through compressAndUploadImage (the one upload
// path); PORTADA promotes an image to index 0, which is what every card and
// the overlay hero read.

function ImagesField({
  value,
  onChange,
  uid,
}: {
  value: string[]
  onChange: (next: string[]) => void
  uid: string | null
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = async (files: FileList) => {
    if (!uid) {
      setError('NECESITAS SESIÓN PARA SUBIR IMÁGENES.')
      return
    }
    setUploading(true)
    setError(null)
    const added: string[] = []
    for (const file of Array.from(files)) {
      const result = await compressAndUploadImage(file, uid)
      if (result.ok) added.push(result.url)
      else setError(result.error.toUpperCase())
    }
    setUploading(false)
    if (added.length > 0) onChange([...value, ...added])
  }

  return (
    <div id={LISTING_ANCHOR_IDS.images} className="flex scroll-mt-24 flex-col gap-2 sm:col-span-2">
      <FieldLabelL label="IMÁGENES" />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {value.map((src, index) => (
            <li key={`${src}-${index}`} className="flex w-20 flex-col gap-1">
              <span className="relative block h-20 w-20 overflow-hidden border border-ink bg-paper">
                <SmartImage src={src} alt="" className="object-cover" sizes="80px" />
              </span>
              {index === 0 ? (
                <span className="text-center font-mono text-d11 font-bold uppercase tracking-widest text-ink">
                  PORTADA
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange([src, ...value.filter((_, i) => i !== index)])}
                  data-cue="tick"
                  className={`font-mono text-d11 uppercase tracking-widest text-ink-soft underline-offset-4 hover:underline ${FOCUS_RING}`}
                >
                  HACER PORTADA
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                data-cue="tick"
                className={`font-mono text-d11 uppercase tracking-widest text-sys-red-paper underline-offset-4 hover:underline ${FOCUS_RING}`}
              >
                QUITAR
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <InkButton onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'SUBIENDO…' : value.length === 0 ? 'SUBIR PORTADA' : 'AÑADIR IMAGEN'}
        </InkButton>
        <Hint>
          {value.length === 0
            ? 'SIN IMAGEN LA PIEZA SALE CON EL MARCADOR DE CATEGORÍA'
            : 'LA PRIMERA IMAGEN ES LA PORTADA'}
        </Hint>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) void addFiles(files)
          e.target.value = ''
        }}
      />
      {error && (
        <p role="status" className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
          ⚠ {error}
        </p>
      )}
    </div>
  )
}

// ── The editor ──────────────────────────────────────────────────────────────

export interface ListingFormProps {
  mode: 'create' | 'edit'
  draft: ListingDraft
  onChange: (patch: Partial<ListingDraft>) => void
  /** The franja's currency label — printed beside PRECIO, never converted. */
  currency: string | null
  uid: string | null
  busy: boolean
  error: string | null
  /** listingMissingRequired(...).length === 0 */
  canSubmit: boolean
  missing: string[]
  onSubmit: () => void
  onCancel: () => void
}

export function ListingForm({
  mode,
  draft,
  onChange,
  currency,
  uid,
  busy,
  error,
  canSubmit,
  missing,
  onSubmit,
  onCancel,
}: ListingFormProps) {
  const subcategories = SUBCATEGORIES_BY_CATEGORY[draft.category] ?? []

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    onSubmit()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormSection number="01" label="PIEZA">
        <ImagesField
          value={draft.images}
          onChange={(images) => onChange({ images })}
          uid={uid}
        />
        <div className="sm:col-span-2">
          <TextFieldL
            id={LISTING_ANCHOR_IDS.title}
            label="TÍTULO"
            required
            value={draft.title}
            onChange={(title) => onChange({ title })}
            placeholder="Lo que estás vendiendo"
          />
        </div>
        <SelectL
          label="CATEGORÍA"
          mono
          value={draft.category}
          onChange={(v) =>
            onChange({ category: v as MarketplaceListingCategory, subcategory: '' })
          }
          options={(Object.keys(CATEGORY_LABEL) as MarketplaceListingCategory[]).map(
            (c) => ({ value: c, label: CATEGORY_LABEL[c] }),
          )}
        />
        {subcategories.length > 0 && (
          <SelectL
            label="SUBCATEGORÍA"
            mono
            value={draft.subcategory}
            onChange={(subcategory) => onChange({ subcategory })}
            options={[
              { value: '', label: 'SIN ESPECIFICAR' },
              ...subcategories.map((s) => ({ value: s, label: s.toUpperCase() })),
            ]}
          />
        )}
        <SelectL
          label="CONDICIÓN"
          mono
          value={draft.condition}
          onChange={(v) => onChange({ condition: v as MarketplaceListingCondition })}
          options={CONDITIONS.map((c) => ({ value: c, label: c }))}
        />
        <SelectL
          label="ESTADO"
          mono
          value={draft.status}
          onChange={(v) => onChange({ status: v as MarketplaceListingStatus })}
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <div className="flex flex-col gap-1">
          <TextFieldL
            id={LISTING_ANCHOR_IDS.price}
            label={`PRECIO (${currency ?? 'MXN'})`}
            mono
            value={draft.price}
            onChange={(price) => onChange({ price })}
            placeholder="0"
          />
          <Hint>SIN PRECIO SE PUBLICA EN $0 · GRADIENTE NO COBRA</Hint>
        </div>
        <SelectL
          label="ENTREGA"
          mono
          value={draft.shippingMode}
          onChange={(v) => onChange({ shippingMode: v as MarketplaceShippingMode | '' })}
          options={[
            { value: '', label: 'SIN ESPECIFICAR' },
            { value: 'shipping', label: SHIPPING_LABEL.shipping },
            { value: 'local', label: SHIPPING_LABEL.local },
            { value: 'both', label: SHIPPING_LABEL.both },
          ]}
        />
      </FormSection>

      <FormSection number="02" label="TEXTO">
        <div className="sm:col-span-2">
          <TextAreaL
            id={LISTING_ANCHOR_IDS.description}
            label="DESCRIPCIÓN"
            rows={4}
            value={draft.description}
            onChange={(description) => onChange({ description })}
            placeholder="Estado real, procedencia, lo que el comprador debería saber."
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <TextFieldL
            label="ETIQUETAS"
            mono
            value={draft.tags}
            onChange={(tags) => onChange({ tags })}
            placeholder="dub, white-label, 1996"
          />
          <Hint>SEPARADAS POR COMAS</Hint>
        </div>
      </FormSection>

      <FormSection number="03" label="CONTACTO DE VENTA" id={LISTING_ANCHOR_IDS.contact}>
        <div className="sm:col-span-2">
          <Hint>
            {'GRADIENTE NO PROCESA PAGOS: EL TRATO SE CIERRA POR ESTAS VÍAS O EN EL HILO DE LA PIEZA.'}
          </Hint>
        </div>
        <TextFieldL
          label="WHATSAPP"
          mono
          value={draft.whatsapp}
          onChange={(whatsapp) => onChange({ whatsapp })}
          placeholder="+52 55 … o wa.me/…"
        />
        <TextFieldL
          label="E-MAIL"
          mono
          value={draft.contactEmail}
          onChange={(contactEmail) => onChange({ contactEmail })}
          placeholder="ventas@…"
        />
        <div className="sm:col-span-2">
          <TextFieldL
            label="ENLACE EXTERNO"
            mono
            type="url"
            value={draft.saleUrl}
            onChange={(saleUrl) => onChange({ saleUrl })}
            placeholder="https://… (Discogs, Bandcamp, tienda…)"
          />
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink pt-4">
        <InkButton type="submit" tone="filled" cue="stamp" disabled={busy || !canSubmit}>
          {busy
            ? mode === 'create'
              ? 'PUBLICANDO…'
              : 'GUARDANDO…'
            : mode === 'create'
              ? 'PUBLICAR PIEZA'
              : 'GUARDAR CAMBIOS'}
        </InkButton>
        <InkButton onClick={onCancel} disabled={busy}>
          CANCELAR
        </InkButton>
        {!canSubmit && (
          <span className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
            ⚠ FALTA {missing.join(' · ')}
          </span>
        )}
        {error && (
          <span
            role="status"
            className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper"
          >
            ⚠ {error}
          </span>
        )}
      </div>
    </form>
  )
}
