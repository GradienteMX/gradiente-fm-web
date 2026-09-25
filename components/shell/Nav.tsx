'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Wordmark } from './Wordmark'
import { Mark, RankSigil } from '@/components/kit/Glyph'
import { useMe, useRank } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { signOut } from '@/lib/auth/client'
import { libreaDe } from '@/lib/librea'
import { Descifrar } from '@/components/librea/Descifrar'
import styles from './Nav.module.css'

const LINKS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: '/', label: 'Campo', match: (p) => p === '/' },
  { href: '/agenda', label: 'Agenda', match: (p) => p.startsWith('/agenda') },
  { href: '/mixes', label: 'Mixes', match: (p) => p.startsWith('/mixes') },
  {
    href: '/lecturas',
    label: 'Lecturas',
    match: (p) => ['/lecturas', '/editorial', '/reviews', '/opinion', '/articulos', '/noticias', '/listas'].some((r) => p.startsWith(r)),
  },
  { href: '/foro', label: 'Foro', match: (p) => p.startsWith('/foro') },
  { href: '/mapa', label: 'Mapa', match: (p) => p.startsWith('/mapa') },
  { href: '/mercado', label: 'Mercado', match: (p) => p.startsWith('/mercado') || p.startsWith('/f/') },
]

export function Nav() {
  const pathname = usePathname() ?? '/'
  const me = useMe()
  const rank = useRank(me?.id)
  const openAccess = useUI((s) => s.openAccess)
  const setSearch = useUI((s) => s.setSearch)
  const [leaving, setLeaving] = useState(false)
  // Out through production's route, then a full document load of La Puerta
  // (not a client navigation): nothing of this person's world stays in the
  // page's memory, and Back doesn't return to a signed-in page.
  const logout = async () => {
    if (leaving) return
    setLeaving(true)
    await signOut()
    window.location.replace('/welcome')
  }
  // Menus belong to the page they were opened on: navigating closes them
  // without an effect (the key no longer matches the pathname).
  const [menuOn, setMenuOn] = useState<string | null>(null)
  const [mobileOn, setMobileOn] = useState<string | null>(null)
  const menu = menuOn === pathname
  const mobile = mobileOn === pathname
  const setMenu = (v: boolean | ((m: boolean) => boolean)) => setMenuOn((cur) => ((typeof v === 'function' ? v(cur === pathname) : v) ? pathname : null))
  const setMobile = (v: boolean | ((m: boolean) => boolean)) => setMobileOn((cur) => ((typeof v === 'function' ? v(cur === pathname) : v) ? pathname : null))
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOn(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOn(null)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  // The channel you're on: its livery tints the chip and the active rule.
  const librea = libreaDe(pathname)
  const accent = librea.color.toLowerCase() === '#edebe3' ? '#111111' : librea.color

  return (
    <header
      className={styles.nav}
      data-scrolled={scrolled || undefined}
      style={{ '--lc': librea.color, '--lo': librea.on, '--accent': accent } as React.CSSProperties}
    >
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Gradiente — inicio">
          <svg className={styles.reg} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <circle cx="10" cy="10" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 1v18M1 10h18" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="10" cy="10" r="1.9" fill="currentColor" />
          </svg>
          <Wordmark size="md" />
        </Link>

        <span className={styles.canal} title={`Canal ${librea.canal} — ${librea.nombre}`}>
          <span className={styles.canalNum}>{librea.canal}</span>
          <Descifrar text={librea.code} />
        </span>

        <nav className={styles.links} aria-label="Secciones">
          {LINKS.map((l) => {
            const active = l.match(pathname)
            return (
              <Link key={l.href} href={l.href} className={styles.link} data-active={active || undefined} aria-current={active ? 'page' : undefined}>
                <span className={styles.linkCanal} aria-hidden="true">
                  {libreaDe(l.href).canal}
                </span>
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className={styles.right}>
          <button type="button" className={styles.search} onClick={() => setSearch(true)} aria-label="Buscar (tecla /)">
            <Mark name="search" size={15} />
            <span className={styles.searchLabel}>Buscar</span>
            <kbd className={styles.kbd}>/</kbd>
          </button>

          {me ? (
            <div className={styles.me} ref={menuRef}>
              <button
                type="button"
                className={styles.avatar}
                onClick={() => setMenu((m) => !m)}
                aria-haspopup="menu"
                aria-expanded={menu}
                aria-label={`Tu cuenta: @${me.username}`}
              >
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatarUrl} alt="" />
                ) : (
                  <span className={styles.initial}>{(me.displayName || me.username).slice(0, 1).toUpperCase()}</span>
                )}
                {me.role === 'user' && rank !== 'normie' ? (
                  <span className={styles.sigil}>
                    <RankSigil rank={rank} size={11} />
                  </span>
                ) : null}
              </button>
              {menu ? (
                <div className={styles.menu} role="menu">
                  <div className={styles.menuHead}>
                    <span className={styles.menuName}>{me.displayName}</span>
                    <span className="meta">@{me.username}</span>
                  </div>
                  <Link role="menuitem" href="/taller" className={styles.menuItem}>
                    Taller
                  </Link>
                  <Link role="menuitem" href={`/u/${me.username}`} className={styles.menuItem}>
                    Credencial pública
                  </Link>
                  {me.role === 'admin' ? (
                    <Link role="menuitem" href="/central" className={styles.menuItem}>
                      Central
                    </Link>
                  ) : null}
                  <button role="menuitem" type="button" className={styles.menuItem} onClick={() => void logout()} disabled={leaving} aria-busy={leaving || undefined}>
                    {leaving ? 'Saliendo…' : 'Salir'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button type="button" className={styles.enter} onClick={() => openAccess()}>
              Entrar
            </button>
          )}

          <button type="button" className={styles.burger} onClick={() => setMobile((m) => !m)} aria-expanded={mobile} aria-label="Menú">
            <Mark name={mobile ? 'close' : 'menu'} size={18} />
          </button>
        </div>
      </div>

      {mobile ? (
        <nav className={styles.sheet} aria-label="Secciones">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.sheetLink} data-active={l.match(pathname) || undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
