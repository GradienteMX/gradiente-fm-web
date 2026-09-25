'use client'

import Link from 'next/link'
import { forwardRef, type ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'ink' | 'ghost' | 'quiet' | 'danger' | 'energy' | 'create'
type Size = 'sm' | 'md' | 'lg'

interface Common {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
  className?: string
  full?: boolean
}

type AsButton = Common & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type AsLink = Common & { href: string; target?: string; rel?: string; onClick?: React.MouseEventHandler<HTMLAnchorElement>; 'aria-label'?: string }

/**
 * The one button — a boxed mono label. `ink` is the primary action (ink
 * ground, paper type), `ghost` the 1px ink box, `quiet` the same box in a
 * lower voice, `danger` is irreversible (red), `create` is the act of
 * making something (acid ground, ink type), `energy` takes the current
 * field's swatch as its ground (use sparingly).
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, AsButton | AsLink>(function Button(props, ref) {
  const { variant = 'ghost', size = 'md', icon, iconRight, children, className, full, ...rest } = props
  const cls = [styles.btn, styles[variant], styles[size], full ? styles.full : '', className ?? ''].join(' ')
  const inner = (
    <>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {children ? <span className={styles.text}>{children}</span> : null}
      {iconRight ? <span className={styles.iconRight}>{iconRight}</span> : null}
    </>
  )
  if ('href' in rest && rest.href) {
    const { href, ...a } = rest as AsLink
    const external = /^https?:/.test(href)
    if (external)
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={cls} target="_blank" rel="noopener noreferrer" {...a}>
          {inner}
        </a>
      )
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={cls} {...a}>
        {inner}
      </Link>
    )
  }
  const b = rest as React.ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={b.type ?? 'button'} className={cls} {...b}>
      {inner}
    </button>
  )
})
