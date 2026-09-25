'use client'

/**
 * FUNDA — a listing as a record sleeve standing in a crate.
 *
 * At rest the sleeve sits low, its foot hidden behind the crate's lip; hover
 * or focus pulls it up, and letting go drops it back with a small detent.
 * The cover is the card. With no photo the sleeve is a white label — the
 * title stamped on in the palette's two tones, a die-cut hole for records —
 * because hue belongs to energy and a listing has none.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import type { OriginRect } from '@/lib/store/ui'
import { CATEGORY_LABEL, CONDITION, formatPrice, STATUS_LABEL, subLabel } from './datos'
import { Estado } from './Estado'
import styles from './Funda.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP)

export function Funda({
  listing,
  franja,
  onOpen,
  showStore = true,
  sizes = '(max-width: 700px) 50vw, 240px',
  priority,
}: {
  listing: MarketplaceListing
  franja: ContentItem
  onOpen: (listing: MarketplaceListing, origin: OriginRect | null) => void
  showStore?: boolean
  sizes?: string
  priority?: boolean
}) {
  const btn = useRef<HTMLButtonElement>(null)
  const sleeve = useRef<HTMLSpanElement>(null)
  const { contextSafe } = useGSAP({ scope: btn })
  const price = formatPrice(listing.price, franja.marketplaceCurrency)
  const sub = subLabel(listing.subcategory)
  const cover = listing.images[0]

  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pull = contextSafe(() => {
    if (reduced() || !sleeve.current) return
    gsap.to(sleeve.current, { yPercent: -10, duration: 0.45, ease: 'expo.out', overwrite: 'auto' })
  })
  const drop = contextSafe(() => {
    if (!sleeve.current) return
    gsap.to(sleeve.current, { yPercent: 0, duration: 0.5, ease: 'back.out(1.6)', overwrite: 'auto' })
  })

  const open = () => {
    const r = sleeve.current?.getBoundingClientRect()
    onOpen(listing, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
  }

  return (
    <button
      ref={btn}
      type="button"
      className={styles.funda}
      data-status={listing.status}
      onClick={open}
      onPointerEnter={(e) => e.pointerType !== 'touch' && pull()}
      onPointerLeave={drop}
      onFocus={pull}
      onBlur={drop}
      aria-label={`${listing.title} — ${price.amount} ${price.code}, ${STATUS_LABEL[listing.status].toLowerCase()}${showStore ? `, en la tienda de ${franja.title}` : ''}`}
    >
      <span className={styles.well}>
        <span ref={sleeve} className={styles.sleeve} data-blank={cover ? undefined : ''}>
          {cover ? (
            <Image src={cover} alt="" fill sizes={sizes} priority={priority} className={styles.cover} draggable={false} />
          ) : (
            <WhiteLabel listing={listing} />
          )}
          <span className={styles.grade} title={`${CONDITION[listing.condition].label} — ${CONDITION[listing.condition].meaning}`}>
            {listing.condition}
          </span>
          {listing.status !== 'available' ? <span className={styles.stamp}>{STATUS_LABEL[listing.status]}</span> : null}
        </span>
      </span>
      <span className={styles.lip}>
        <span className={styles.kicker}>
          {showStore ? <span className={styles.store}>{franja.title}</span> : null}
          <span className={styles.cat}>
            {CATEGORY_LABEL[listing.category]}
            {sub ? ` · ${sub}` : ''}
          </span>
        </span>
        <span className={styles.title}>{listing.title || 'Sin título'}</span>
        <span className={styles.foot}>
          <span className={styles.price}>
            {price.amount}
            <small>{price.code}</small>
          </span>
          <Estado status={listing.status} />
        </span>
      </span>
    </button>
  )
}

/** The blank sleeve: two tones, the title stamped on, a die-cut hole for records. */
export function WhiteLabel({ listing, size = 'md' }: { listing: MarketplaceListing; size?: 'md' | 'lg' }) {
  const kind = listing.category
  return (
    <span className={styles.blank} data-kind={kind} data-size={size}>
      <span className={styles.blankStamp}>{listing.title || 'Sin título'}</span>
      {kind === 'vinyl' || kind === 'cd' ? (
        <span className={styles.hole} data-cd={kind === 'cd' || undefined} aria-hidden="true">
          <span className={styles.disc}>
            <span className={styles.label} />
          </span>
        </span>
      ) : kind === 'cassette' ? (
        <span className={styles.tape} aria-hidden="true">
          <span className={styles.reel} />
          <span className={styles.reel} />
        </span>
      ) : (
        <span className={styles.glyph} aria-hidden="true">
          <GearGlyph kind={kind} />
        </span>
      )}
      <span className={styles.blankFoot}>
        {CATEGORY_LABEL[kind]}
        {listing.subcategory ? ` · ${subLabel(listing.subcategory)}` : ''}
      </span>
    </span>
  )
}

function GearGlyph({ kind }: { kind: MarketplaceListing['category'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'turntable':
      return (
        <svg viewBox="0 0 40 40" {...common}>
          <rect x="3" y="7" width="34" height="26" rx="2" />
          <circle cx="17" cy="20" r="9" />
          <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
          <path d="M31 11v12l-6 5" />
        </svg>
      )
    case 'mixer':
      return (
        <svg viewBox="0 0 40 40" {...common}>
          <rect x="7" y="4" width="26" height="32" rx="2" />
          <path d="M14 10v20M20 10v20M26 10v20" />
          <path d="M12 16h4M18 22h4M24 13h4" strokeWidth={2.4} />
        </svg>
      )
    case 'synth':
    case 'drum-machine':
      return (
        <svg viewBox="0 0 40 40" {...common}>
          <rect x="3" y="10" width="34" height="20" rx="2" />
          {kind === 'synth' ? <path d="M9 22v8M15 22v8M21 22v8M27 22v8M33 22v8" /> : <path d="M8 22h5v5H8zM17 22h5v5h-5zM26 22h5v5h-5z" />}
          <circle cx="10" cy="15" r="1.5" />
          <circle cx="16" cy="15" r="1.5" />
          <circle cx="22" cy="15" r="1.5" />
        </svg>
      )
    case 'outboard':
      return (
        <svg viewBox="0 0 40 40" {...common}>
          <rect x="3" y="13" width="34" height="14" rx="1.5" />
          <circle cx="11" cy="20" r="3" />
          <circle cx="20" cy="20" r="3" />
          <circle cx="29" cy="20" r="3" />
        </svg>
      )
    case 'merch':
      return (
        <svg viewBox="0 0 40 40" {...common}>
          <path d="M14 6l-9 5 3 7 4-2v18h16V16l4 2 3-7-9-5c-1 3-3.5 4.5-6 4.5S15 9 14 6z" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 40 40" {...common}>
          <rect x="9" y="9" width="22" height="22" rx="1.5" />
          <path d="M9 17h22" />
        </svg>
      )
  }
}
