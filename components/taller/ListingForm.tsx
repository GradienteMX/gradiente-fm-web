'use client'

/**
 * The listing editor (MERCADO › CATÁLOGO). Exactly the fields a listing
 * has — no stock, no view counts, nothing the schema does not carry. Only
 * the title is a hard gate; the rest is what makes an announcement
 * complete, and the form says so instead of pretending to be stricter.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useMemo, useState } from 'react'
import {
  SUBCATEGORIES_BY_CATEGORY,
  type MarketplaceListing,
  type MarketplaceListingCategory,
  type MarketplaceListingCondition,
  type MarketplaceListingStatus,
  type MarketplaceShippingMode,
} from '@/lib/types'
import { newId } from '@/lib/store/world'
import { Button } from '@/components/kit/Button'
import { Select, TextArea, TextField } from '@/components/kit/Field'
import { Mark } from '@/components/kit/Glyph'
import { Latch } from './kit'
import { isHttpUrl, isImageRef } from './logic'
import styles from './Mercado.module.css'

export const CATEGORY_LABEL: Record<MarketplaceListingCategory, string> = {
  vinyl: 'Vinilo',
  cassette: 'Cassette',
  cd: 'CD',
  synth: 'Sintetizador',
  'drum-machine': 'Caja de ritmos',
  turntable: 'Tornamesa',
  mixer: 'Mezcladora',
  outboard: 'Outboard',
  merch: 'Merch',
  other: 'Otro',
}

export const CONDITION_LABEL: Record<MarketplaceListingCondition, string> = {
  NEW: 'Nuevo · sellado',
  NM: 'Casi nuevo (NM)',
  'VG+': 'Muy bueno+ (VG+)',
  VG: 'Muy bueno (VG)',
  'G+': 'Bueno+ (G+)',
  G: 'Bueno (G)',
  F: 'Aceptable (F)',
}

export const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  sold: 'Vendida',
}

export const SHIPPING_LABEL: Record<MarketplaceShippingMode, string> = {
  shipping: 'Envío',
  local: 'Entrega local',
  both: 'Envío o entrega',
}

export const STATUSES: MarketplaceListingStatus[] = ['available', 'reserved', 'sold']
const CONDITIONS: MarketplaceListingCondition[] = ['NEW', 'NM', 'VG+', 'VG', 'G+', 'G', 'F']
const CATEGORIES = Object.keys(CATEGORY_LABEL) as MarketplaceListingCategory[]
const MAX_IMAGES = 8

/** «$450 MXN» — the franja's currency label, never a conversion. 0 = to be agreed. */
export function formatPrice(price: number, currency: string): string {
  if (!price) return 'Precio a convenir'
  return `$${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(price)} ${currency}`
}

interface Draft {
  title: string
  price: string
  category: MarketplaceListingCategory
  subcategory: string
  condition: MarketplaceListingCondition
  status: MarketplaceListingStatus
  shipping: MarketplaceShippingMode | ''
  images: string[]
  description: string
  tags: string
  whatsapp: string
  email: string
  saleUrl: string
}

function fromListing(l: MarketplaceListing | null): Draft {
  return {
    title: l?.title ?? '',
    price: l && l.price ? String(l.price) : '',
    category: l?.category ?? 'vinyl',
    subcategory: l?.subcategory ?? '',
    condition: l?.condition ?? 'VG+',
    status: l?.status ?? 'available',
    shipping: l?.shippingMode ?? '',
    images: l ? [...l.images] : [],
    description: l?.description ?? '',
    tags: (l?.tags ?? []).join(', '),
    whatsapp: l?.whatsapp ?? '',
    email: l?.email ?? '',
    saleUrl: l?.saleUrl ?? '',
  }
}

export function ListingForm({
  listing,
  currency,
  flyers,
  onCancel,
  onSubmit,
}: {
  listing: MarketplaceListing | null
  currency: string
  flyers: string[]
  onCancel: () => void
  onSubmit: (l: MarketplaceListing) => void
}) {
  const [d, setD] = useState<Draft>(() => fromListing(listing))
  const [picker, setPicker] = useState(false)
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }))
  const subs = SUBCATEGORIES_BY_CATEGORY[d.category]

  const priceNum = d.price.trim() ? Number.parseFloat(d.price.replace(',', '.')) : 0
  const errors = {
    title: !d.title.trim() ? 'La pieza necesita un título.' : null,
    price: d.price.trim() && (!Number.isFinite(priceNum) || priceNum < 0) ? 'Escribe un número (0 o más).' : null,
    email: d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim()) ? 'Revisa el correo.' : null,
    saleUrl: d.saleUrl.trim() && !isHttpUrl(d.saleUrl) ? 'Usa un enlace completo: https://…' : null,
    whatsapp: d.whatsapp.trim() && !/^[+\d\s()-]{8,}$|^https?:\/\/wa\.me\//.test(d.whatsapp.trim()) ? 'Un número con lada, o un enlace wa.me.' : null,
    images: d.images.some((u) => u.trim() && !isImageRef(u)) ? 'Hay un enlace de imagen que no parece válido.' : null,
  }
  const blocking = Boolean(errors.title || errors.price || errors.email || errors.saleUrl || errors.whatsapp || errors.images)

  // What completes an announcement (not what the system demands).
  const checklist = useMemo(
    () => [
      { k: 'Título', done: Boolean(d.title.trim()) },
      { k: 'Portada', done: d.images.some((u) => u.trim()) },
      { k: 'Precio', done: priceNum > 0 },
      { k: 'Descripción', done: Boolean(d.description.trim()) },
      { k: 'Vía de contacto', done: Boolean(d.whatsapp.trim() || d.email.trim() || d.saleUrl.trim()) },
    ],
    [d, priceNum],
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (blocking) return
    const tags = [...new Set(d.tags.split(',').map((t) => t.trim()).filter(Boolean))]
    onSubmit({
      id: listing?.id ?? newId('mkl'),
      title: d.title.trim(),
      category: d.category,
      subcategory: d.subcategory && subs.includes(d.subcategory) ? d.subcategory : undefined,
      price: Number.isFinite(priceNum) ? Math.max(0, priceNum) : 0,
      condition: d.condition,
      images: d.images.map((u) => u.trim()).filter(Boolean),
      status: d.status,
      description: d.description.trim() || undefined,
      tags: tags.length ? tags : undefined,
      shippingMode: d.shipping || undefined,
      embeds: listing?.embeds,
      relatedLinks: listing?.relatedLinks,
      saleUrl: d.saleUrl.trim() || undefined,
      whatsapp: d.whatsapp.trim() || undefined,
      email: d.email.trim() || undefined,
      publishedAt: listing?.publishedAt ?? new Date().toISOString(),
    })
  }

  const setImage = (i: number, v: string) => patch({ images: d.images.map((u, j) => (j === i ? v : u)) })
  const addImage = (u = '') => d.images.length < MAX_IMAGES && patch({ images: [...d.images, u] })
  const removeImage = (i: number) => patch({ images: d.images.filter((_, j) => j !== i) })
  const toCover = (i: number) => patch({ images: [d.images[i], ...d.images.filter((_, j) => j !== i)] })

  return (
    <form className={styles.form} onSubmit={submit}>
      <header className={styles.formHead}>
        <div>
          <p className="label" style={{ color: 'var(--ink-3)' }}>
            Mercado
          </p>
          <h2 className={styles.formTitle}>{listing ? 'Editar pieza' : 'Nueva pieza'}</h2>
        </div>
        <button type="button" className={styles.close} onClick={onCancel} aria-label="Cerrar sin guardar">
          <Mark name="close" size={16} />
        </button>
      </header>

      <div className={styles.formBody}>
        <ul className={styles.checklist} aria-label="Qué completa el anuncio">
          {checklist.map((c) => (
            <li key={c.k} data-done={c.done || undefined}>
              <Mark name={c.done ? 'check' : 'dot'} size={12} />
              {c.k}
            </li>
          ))}
        </ul>

        <TextField label="Título" required value={d.title} onChange={(e) => patch({ title: e.target.value })} maxLength={120} counter={{ value: d.title.length, max: 120 }} error={d.title ? errors.title : null} data-autofocus="" placeholder="Artista — Título (formato)" />

        <div className={styles.row2}>
          <TextField
            label={`Precio (${currency})`}
            value={d.price}
            onChange={(e) => patch({ price: e.target.value })}
            inputMode="decimal"
            placeholder="450"
            error={errors.price}
            hint="Vacío o 0: se acuerda en la conversación."
          />
          <Select label="Condición" value={d.condition} onChange={(e) => patch({ condition: e.target.value as MarketplaceListingCondition })} options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))} />
        </div>

        <div className={styles.row2}>
          <Select
            label="Categoría"
            value={d.category}
            onChange={(e) => patch({ category: e.target.value as MarketplaceListingCategory, subcategory: '' })}
            options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          />
          {subs.length ? (
            <Select label="Subcategoría" value={d.subcategory} onChange={(e) => patch({ subcategory: e.target.value })} options={[{ value: '', label: 'Sin especificar' }, ...subs.map((s) => ({ value: s, label: s }))]} />
          ) : (
            <div />
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Estado</span>
          <Latch<MarketplaceListingStatus> label="Estado" value={d.status} onChange={(v) => patch({ status: v })} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Entrega</span>
          <Latch<string>
            label="Entrega"
            value={d.shipping || 'none'}
            onChange={(v) => patch({ shipping: v === 'none' ? '' : (v as MarketplaceShippingMode) })}
            options={[
              { value: 'none', label: 'Sin especificar' },
              { value: 'shipping', label: SHIPPING_LABEL.shipping },
              { value: 'local', label: SHIPPING_LABEL.local },
              { value: 'both', label: SHIPPING_LABEL.both },
            ]}
          />
        </div>

        <fieldset className={styles.images}>
          <legend className={styles.fieldLabel}>
            Imágenes <span className={styles.faint}>· la primera es la portada</span>
          </legend>
          {d.images.length ? (
            <ol className={styles.imageList}>
              {d.images.map((u, i) => (
                <li key={i} className={styles.imageRow}>
                  <span className={styles.imageThumb}>{u.trim() && isImageRef(u) ? <Image src={u.trim()} alt="" fill sizes="48px" className={styles.cover} unoptimized={!u.startsWith('/')} /> : null}</span>
                  <input className={styles.imageInput} value={u} onChange={(e) => setImage(i, e.target.value)} placeholder="https://… o /flyers/…" aria-label={`Imagen ${i + 1}`} />
                  {i === 0 ? (
                    <span className={styles.coverTag}>Portada</span>
                  ) : (
                    <button type="button" className={styles.iconBtn} onClick={() => toCover(i)} aria-label={`Usar la imagen ${i + 1} como portada`}>
                      <Mark name="pin" size={14} />
                    </button>
                  )}
                  <button type="button" className={styles.iconBtn} onClick={() => removeImage(i)} aria-label={`Quitar la imagen ${i + 1}`}>
                    <Mark name="close" size={13} />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          {errors.images ? <p className={styles.error}>{errors.images}</p> : null}
          <div className={styles.imageActions}>
            <Button variant="ghost" size="sm" icon={<Mark name="plus" size={13} />} onClick={() => addImage()} disabled={d.images.length >= MAX_IMAGES}>
              Añadir enlace
            </Button>
            {flyers.length ? (
              <Button variant="quiet" size="sm" onClick={() => setPicker((p) => !p)} aria-expanded={picker}>
                {picker ? 'Cerrar archivo' : 'Elegir del archivo de flyers'}
              </Button>
            ) : null}
          </div>
          {picker ? (
            <ul className={styles.picker} aria-label="Flyers del archivo">
              {flyers.map((f) => {
                const taken = d.images.includes(f)
                return (
                  <li key={f}>
                    <button
                      type="button"
                      className={styles.pick}
                      data-taken={taken || undefined}
                      disabled={taken || d.images.length >= MAX_IMAGES}
                      onClick={() => addImage(f)}
                      aria-label={taken ? `${f} ya está en la pieza` : `Añadir ${f}`}
                    >
                      <Image src={f} alt="" fill sizes="72px" className={styles.cover} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </fieldset>

        <TextArea label="Descripción" value={d.description} onChange={(e) => patch({ description: e.target.value })} maxLength={1500} counter={{ value: d.description.length, max: 1500 }} rows={4} placeholder="Prensaje, estado real, qué incluye." />
        <TextField label="Etiquetas" value={d.tags} onChange={(e) => patch({ tags: e.target.value })} placeholder="edición limitada, white label" hint="Separadas por comas." />

        <fieldset className={styles.contact}>
          <legend className={styles.fieldLabel}>Contacto</legend>
          <div className={styles.row3}>
            <TextField label="WhatsApp" value={d.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} inputMode="tel" placeholder="+52 55 …" error={errors.whatsapp} />
            <TextField label="Correo" value={d.email} onChange={(e) => patch({ email: e.target.value })} inputMode="email" placeholder="ventas@…" error={errors.email} />
            <TextField label="Enlace de venta" value={d.saleUrl} onChange={(e) => patch({ saleUrl: e.target.value })} inputMode="url" placeholder="https://…" error={errors.saleUrl} />
          </div>
        </fieldset>
      </div>

      <footer className={styles.formFoot}>
        <p className={styles.footNote}>La venta se acuerda directo entre personas; Gradiente no cobra ni procesa pagos.</p>
        <div className={styles.footActions}>
          <Button variant="quiet" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="ink" type="submit" disabled={blocking}>
            {listing ? 'Guardar cambios' : 'Poner en el catálogo'}
          </Button>
        </div>
      </footer>
    </form>
  )
}
