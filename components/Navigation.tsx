'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { href: '/',           label: 'HOME',       code: '00' },
  { href: '/agenda',     label: 'AGENDA',     code: '01' },
  { href: '/noticias',   label: 'NOTICIAS',   code: '02' },
  { href: '/reviews',    label: 'REVIEWS',    code: '03' },
  { href: '/mixes',      label: 'MIXES',      code: '04' },
  { href: '/editorial',  label: 'EDITORIAL',  code: '05' },
]

const DATA_STRIP = [
  'CDMX·UNDERGROUND', '//', 'MUSICA·ELECTRONICA', '//', 'FREQ·ACTIVA·128BPM', '//',
  'UNIT·GRADIENTE·ONLINE', '//', 'PATTERN:CONFIRMED', '//', 'SINCRONIZACION·ACTIVA', '//',
  'MAGI·SYSTEM·NOMINAL', '//', 'GRADIENTE·FM·SUBSISTEMA·CULTURAL·MX', '//',
  'A·T·FIELD·STABLE', '//', 'INSTRUMENTACION·NEURAL·ACTIVA', '//', 'BIOPATTERN·LOCKED', '//',
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [time, setTime] = useState('--:--:--')
  const [frames, setFrames] = useState('00000')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toTimeString().slice(0, 8))
      setFrames(String(Math.floor(Date.now() / 33) % 100000).padStart(5, '0'))
    }
    update()
    const id = setInterval(update, 100)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="eva-scanlines sticky top-0 z-50 bg-black">

      {/* ── Top gradient bar ── */}
      <div className="h-[2px] w-full" style={{ background: 'linear-gradient(to right, #FF2200, #FF8800, #FFB800, #FF8800, #FF2200)' }} />

      {/* ── Main bar ── */}
      <div className="h-[54px]" style={{ borderBottom: '1px solid #1C1000' }}>
      <div className="mx-auto flex h-full max-w-screen-2xl items-stretch px-4 md:px-8">

        {/* ── Logo — EVA unit designation box ── */}
        <Link
          href="/"
          className="group flex items-center gap-3 pl-3 pr-4 transition-colors hover:bg-[#0A0400]"
          style={{ borderRight: '2px solid #FF6600', borderImage: 'linear-gradient(to bottom, #FF9900, #FF4400) 1' }}
        >
          <div className="flex flex-col gap-[2px]">
            <span className="font-mono text-[6px] tracking-[0.25em]" style={{ color: '#FF6600', opacity: 0.55 }}>
              UNIT·ID / SUBSISTEMA·MX
            </span>

            {/* The box */}
            <div className="eva-box flex items-center gap-2 px-2 py-[3px]">
              <div className="flex flex-col gap-[2px]">
                <div className="h-[2px] w-4" style={{ background: '#FF6600', boxShadow: '0 0 4px #FF6600' }} />
                <div className="h-[2px] w-4 opacity-30" style={{ background: '#FF6600' }} />
                <div className="h-[2px] w-2 opacity-10" style={{ background: '#FF6600' }} />
              </div>
              <span
                className="eva-glow font-syne text-[17px] font-black tracking-tighter leading-none"
              >
                GRADIENTE<span style={{ color: '#FFB800', textShadow: '0 0 8px #FFB800' }}>·</span>FM
              </span>
            </div>

            <span className="font-mono text-[6px] tracking-[0.12em]" style={{ color: '#2A1800' }}>
              CULTURAL·SUBSYSTEM·ACTIVE
            </span>
          </div>
        </Link>

        {/* ── Desktop nav links ── */}
        <nav className="hidden flex-1 items-stretch md:flex">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group relative flex flex-col items-center justify-center px-4 transition-colors"
                style={{
                  borderRight: '1px solid #140B00',
                  backgroundColor: active ? '#0C0500' : 'transparent',
                }}
              >
                {/* Code */}
                <span
                  className="font-mono text-[8px] tabular-nums leading-none"
                  style={{
                    color: active ? '#FF8800' : '#2A1C00',
                    textShadow: active ? '0 0 8px #FF6600' : 'none',
                  }}
                >
                  {link.code}
                </span>
                {/* Label */}
                <span
                  className="mt-[3px] font-syne text-[11px] font-bold tracking-widest leading-none"
                  style={{
                    color: active ? '#FFAA00' : '#3A2A00',
                    textShadow: active ? '0 0 6px #FF660055, 0 0 14px #FF440033' : 'none',
                  }}
                >
                  {link.label}
                </span>
                {/* Active bottom bar */}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: 'linear-gradient(to right, transparent, #FF6600, transparent)', boxShadow: '0 0 6px #FF6600' }}
                  />
                )}
                {/* Hover crosshair */}
                <span
                  className="absolute right-1 top-1 font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-20"
                  style={{ color: '#FF8800' }}
                >+</span>
              </Link>
            )
          })}
        </nav>

        {/* ── Status / MAGI / Timer ── */}
        <div className="hidden items-stretch md:flex" style={{ borderLeft: '1px solid #140B00' }}>

          {/* MAGI indicators */}
          {[{ id: '01', name: 'CASPAR' }, { id: '02', name: 'BALTHASAR' }, { id: '03', name: 'MELCHIOR' }].map(({ id, name }) => (
            <div
              key={id}
              className="flex flex-col items-center justify-center gap-[3px] px-3"
              style={{ borderRight: '1px solid #140B00' }}
            >
              <span className="font-mono text-[6px] tracking-wider" style={{ color: '#2A1800' }}>{name}</span>
              <div
                className="eva-box flex items-center gap-1 px-1.5 py-[2px]"
                style={{ borderColor: '#00FF4433' }}
              >
                <span
                  className="h-[5px] w-[5px] rounded-full animate-pulse"
                  style={{ backgroundColor: '#00FF44', boxShadow: '0 0 5px #00FF44, 0 0 10px #00FF4455' }}
                />
                <span
                  className="font-mono text-[8px] font-bold"
                  style={{ color: '#00FF44', textShadow: '0 0 6px #00FF44, 0 0 12px #00FF4455' }}
                >
                  OK
                </span>
              </div>
              <span className="font-mono text-[6px]" style={{ color: '#1A1000' }}>MAGI·{id}</span>
            </div>
          ))}

          {/* Timer — EVA countdown style */}
          <div className="flex flex-col items-center justify-center px-4">
            <span className="font-mono text-[6px] tracking-[0.2em]" style={{ color: '#2A1800' }}>T+</span>
            <span
              className="font-mono text-[15px] tabular-nums font-bold leading-none"
              style={{
                color: '#FF9900',
                textShadow: '0 0 4px #FF6600, 0 0 10px #FF660066, 0 0 20px #FF440033',
                letterSpacing: '0.05em',
              }}
            >
              {time}
            </span>
            <span
              className="font-mono text-[8px] tabular-nums"
              style={{ color: '#332000', letterSpacing: '0.05em' }}
            >
              :{frames}
            </span>
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          className="ml-auto flex items-center px-4 md:hidden"
          style={{ color: '#FF6600' }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menú"
        >
          <span className="font-syne text-xl font-black" style={{ textShadow: '0 0 8px #FF6600' }}>
            {mobileOpen ? '×' : '≡'}
          </span>
        </button>
      </div>
      </div>

      {/* ── Data strip ── */}
      <div style={{ borderBottom: '2px solid #1C1000', backgroundColor: '#030100' }}>
      <div className="mx-auto flex h-[20px] max-w-screen-2xl items-center overflow-hidden px-4 md:px-8">
        {/* Left accent bar */}
        <div
          className="h-full w-[3px] flex-shrink-0"
          style={{ background: 'linear-gradient(to bottom, #FF9900, #FF3300)' }}
        />

        {/* Tick ruler */}
        <div className="flex h-full flex-shrink-0 items-end pb-[3px] pl-2 gap-[3px]">
          {[6, 4, 4, 4, 8, 4, 4, 4, 6].map((h, i) => (
            <div key={i} className="w-px flex-shrink-0" style={{ height: `${h}px`, backgroundColor: '#2A1800' }} />
          ))}
        </div>

        {/* Scrolling text */}
        <div className="relative flex-1 overflow-hidden">
          <div className="flex animate-[nge-ticker_55s_linear_infinite] gap-6 whitespace-nowrap pl-3">
            {[...DATA_STRIP, ...DATA_STRIP].map((token, i) => (
              <span
                key={i}
                className="font-mono text-[8px]"
                style={{
                  color: token === '//' ? '#FF550033' : '#261600',
                  textShadow: token === '//' ? '0 0 4px #FF440022' : 'none',
                }}
              >
                {token}
              </span>
            ))}
          </div>
        </div>

        {/* Right axis numbers — EVA waveform style */}
        <div className="flex flex-shrink-0 items-center gap-[6px] px-3" style={{ borderLeft: '1px solid #1C1000' }}>
          {['-2', '-1', '0', '+1', '+2'].map((n) => (
            <span
              key={n}
              className="font-mono text-[8px] tabular-nums"
              style={{
                color: n === '0' ? '#FF660044' : '#1A1000',
                textShadow: n === '0' ? '0 0 6px #FF440033' : 'none',
              }}
            >
              {n}
            </span>
          ))}
        </div>

        {/* SYS status */}
        <div className="flex flex-shrink-0 items-center gap-1.5 px-3" style={{ borderLeft: '1px solid #1C1000' }}>
          <span className="h-[4px] w-[4px] rounded-full" style={{ backgroundColor: '#FF6600', boxShadow: '0 0 4px #FF6600' }} />
          <span className="font-mono text-[7px]" style={{ color: '#FF660066' }}>LIVE</span>
        </div>
      </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <nav className="border-t bg-black" style={{ borderColor: '#1C1000' }}>
          {NAV_LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 border-b px-4 py-3"
                style={{
                  borderColor: '#1C1000',
                  backgroundColor: active ? '#0C0500' : 'transparent',
                }}
              >
                <span className="font-mono text-[10px]" style={{ color: '#FF6600', textShadow: active ? '0 0 6px #FF6600' : 'none' }}>
                  {active ? '▶' : '·'}
                </span>
                <span className="font-mono text-[9px]" style={{ color: '#2A1800' }}>{link.code}</span>
                <span
                  className="font-syne text-xs font-bold tracking-widest"
                  style={{ color: active ? '#FF9900' : '#444' }}
                >
                  {link.label}
                </span>
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
