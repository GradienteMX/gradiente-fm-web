import Link from 'next/link'

// ── FooterColophon — the pliego footer strip ────────────────────────────────
//
// Replaces the layout's inline footer (the orchestrator mounts it in
// app/layout.tsx). One ink row in the print register: imprint line, the
// three real destinations, and the CDMX coordinates as the colophon mark.
// Server component — nothing here needs client state.

const FOOTER_LINKS = [
  { href: '/about', label: 'ABOUT' },
  { href: '/manifesto', label: 'MANIFIESTO' },
  { href: '/equipo', label: 'EQUIPO' },
] as const

const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

export function FooterColophon() {
  return (
    <footer className="border-t border-ink bg-panel text-panel-text">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-4">
        <span className="font-mono text-d11 uppercase tracking-widest">
          GRADIENTE · ENSAMBLA CULTURA
        </span>

        <nav
          aria-label="Colofón"
          className="flex items-center font-mono text-d11 uppercase tracking-widest"
        >
          {FOOTER_LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center">
              {i > 0 && (
                <span aria-hidden className="px-2 text-panel-text/60">
                  ·
                </span>
              )}
              <Link
                href={link.href}
                className={`flex min-h-11 items-center hover:underline hover:underline-offset-4 ${FOCUS_ON_PANEL}`}
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>

        <span className="font-mono text-d11 uppercase tracking-widest text-panel-text/60">
          LAT 19.4326 · LON −99.1332
        </span>
      </div>
    </footer>
  )
}
