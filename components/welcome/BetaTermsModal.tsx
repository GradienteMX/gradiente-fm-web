'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Closed-beta Terms & Conditions, shown as a confirm-gated popup at the last
// step of invite registration (see RegistroCard). The user must explicitly
// accept before the account is created. This is boilerplate starting copy —
// review/adapt the contact address, privacy-policy link, and governing law
// before relying on it. Spanish UI to match the rest of the surface.
export const BETA_TERMS = {
  lastUpdated: '23 de junio de 2026',
  intro:
    'Gradiente es una plataforma en beta cerrada, de acceso por invitación. Al crear tu identidad aceptas estos términos. Léelos: son breves y reales.',
  sections: [
    {
      h: '01 · Acceso por invitación',
      p: 'Tu acceso es personal e intransferible. No compartas tu código de invitación ni tus credenciales. Podemos suspender o revocar tu acceso en cualquier momento y a nuestra discreción durante la beta.',
    },
    {
      h: '02 · Naturaleza de la beta',
      p: 'El servicio está en desarrollo activo. Puede contener errores, cambiar sin previo aviso, interrumpirse o reiniciarse, y el contenido o los datos podrían perderse. Se ofrece "tal cual" y "según disponibilidad", sin garantías de ningún tipo.',
    },
    {
      h: '03 · Confidencialidad',
      p: 'Esto es una beta cerrada. No compartas públicamente capturas, contenido no público ni detalles del funcionamiento interno sin nuestro permiso. Lo que ves aquí todavía no es para el mundo.',
    },
    {
      h: '04 · Conducta',
      p: 'Te comprometes a un uso lícito y respetuoso. Queda prohibido el contenido ilegal o que infrinja derechos de terceros, el acoso, el spam, el scraping automatizado y cualquier intento de vulnerar la seguridad o integridad del sistema.',
    },
    {
      h: '05 · Tu contenido',
      p: 'Conservas los derechos de lo que publiques. Nos concedes una licencia no exclusiva, mundial y libre de regalías para alojarlo y mostrarlo dentro de Gradiente con el fin de operar el servicio. Eres responsable de contar con los derechos sobre lo que subes.',
    },
    {
      h: '06 · Datos personales',
      p: 'Recopilamos datos mínimos (correo, nombre de usuario y actividad en la plataforma) para operar la beta y comunicarnos contigo. Tratamos tus datos conforme a la legislación aplicable en México (LFPDPPP). Consulta nuestro Aviso de Privacidad para más detalle.',
    },
    {
      h: '07 · Disponibilidad y responsabilidad',
      p: 'No garantizamos disponibilidad continua ni ausencia de errores. En la medida que permita la ley, no seremos responsables por daños o pérdidas derivados del uso o la imposibilidad de uso del servicio durante la beta.',
    },
    {
      h: '08 · Cambios',
      p: 'Podemos actualizar estos términos. Si los cambios son relevantes, te lo haremos saber. El uso continuado del servicio tras una actualización implica su aceptación.',
    },
  ],
  closing:
    'Al pulsar "Acepto y continúo" confirmas que leíste y aceptas estos términos y que eres mayor de edad.',
}

interface BetaTermsModalProps {
  open: boolean
  onAccept: () => void
  onClose: () => void
}

export function BetaTermsModal({ open, onAccept, onClose }: BetaTermsModalProps) {
  const acceptRef = useRef<HTMLButtonElement>(null)

  // ESC closes; lock body scroll; focus the accept button on open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    acceptRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-terms-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="eva-box relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col bg-base"
        style={{ borderColor: '#242424' }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5"
          style={{ borderColor: '#242424' }}
        >
          <span className="font-mono text-[10px] tracking-widest" style={{ color: '#F97316' }}>
            //TÉRMINOS · BETA CERRADA
          </span>
          <span className="sys-label uppercase text-muted">
            actualizado · {BETA_TERMS.lastUpdated}
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h2
            id="beta-terms-title"
            className="font-syne text-xl font-black leading-tight text-primary"
          >
            TÉRMINOS Y CONDICIONES
          </h2>
          <p className="mt-2 font-grotesk text-[13px] leading-relaxed text-secondary">
            {BETA_TERMS.intro}
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {BETA_TERMS.sections.map((s) => (
              <section key={s.h} className="flex flex-col gap-1">
                <h3 className="font-mono text-[11px] tracking-widest text-sys-orange">{s.h}</h3>
                <p className="font-grotesk text-[12.5px] leading-relaxed text-secondary">{s.p}</p>
              </section>
            ))}
          </div>

          <p className="mt-5 border-t pt-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted" style={{ borderColor: '#242424' }}>
            {BETA_TERMS.closing}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: '#242424' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="border px-4 py-2.5 font-mono text-[11px] tracking-widest text-muted transition-colors hover:text-secondary"
            style={{ borderColor: '#242424' }}
          >
            CANCELAR
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={onAccept}
            className="border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors"
            style={{ borderColor: '#4ADE80', color: '#4ADE80', backgroundColor: '#4ADE8012' }}
          >
            ▶ ACEPTO Y CONTINÚO
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
