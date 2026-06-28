'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Closed-beta Terms & Conditions ("el acuerdo"), shown as a confirm-gated popup
// at the last step of invite registration (see RegistroCard). The user must
// explicitly accept before the account is created. Spanish UI; each clause
// carries a plain-language "En claro" line so it reads human, not adversarial.
//
// Open items before this is fully production-final:
//   - Aviso de Privacidad: clause 7 references it; link a real doc when ready.
//   - Firma electrónica (closing): persist consent (timestamp + this version +
//     user) to back the electronic-signature claim — NOT yet wired.
//   - Right-to-delete (clause 4): keep backed by real content-deletion UI.
//   - Legal review of the secreto-industrial / firma / liability assertions.
export const BETA_TERMS = {
  version: '2026-06-23',
  lastUpdated: '23 de junio de 2026',
  subtitle: 'Acuerdo de confidencialidad y términos de uso · Beta cerrada',
  preamble:
    'Gradiente ("la Plataforma") y tú ("el Participante") celebran este Acuerdo, con fecha de aceptación electrónica registrada al momento del alta de cuenta. Declaras ser mayor de edad y contar con capacidad legal para aceptarlo.',
  sections: [
    {
      n: '1',
      title: 'Naturaleza de la beta',
      enClaro: 'esto está en construcción y puede cambiar o fallar. Tu acceso es solo tuyo.',
      body: [
        'La Plataforma se encuentra en fase de beta cerrada, accesible únicamente por invitación. Tu acceso es personal e intransferible: no cedas, compartas ni transfieras tu código de acceso o credenciales a terceros.',
        'La beta está en desarrollo activo. Puede cambiar, interrumpirse, reiniciarse o fallar sin previo aviso, y el contenido o los datos podrían perderse. Se ofrece "tal cual" y según disponibilidad, sin garantías durante esta fase.',
      ],
    },
    {
      n: '2',
      title: 'Información confidencial',
      enClaro: 'hay cosas internas que aún no son públicas; te pedimos guardarlas.',
      body: [
        'Durante tu acceso conocerás información propietaria y confidencial de la Plataforma, incluyendo, de manera enunciativa y no limitativa:',
        'a) El diseño, lógica y funcionamiento del sistema HL (Half-Life) — los mecanismos de vida, decaimiento, renovación y cuantificación de contenidos.',
        'b) La arquitectura del sistema de rangos, la calibración analógica y cualquier mecanismo de jerarquización de contenidos y perfiles.',
        'c) El código fuente, la estructura de base de datos, las interfaces no publicadas y cualquier elemento técnico del backend.',
        'd) Estrategias comerciales, roadmap de producto, relaciones con inversores y modelos de monetización en desarrollo.',
        'e) Cualquier información marcada como confidencial o que por su naturaleza deba entenderse como tal.',
      ],
    },
    {
      n: '3',
      title: 'Tus compromisos de confidencialidad',
      enClaro: 'que quede entre nosotros mientras dure la beta y un tiempo después.',
      body: [
        'Te comprometes a:',
        'a) Mantener confidencialidad sobre la Información Confidencial durante la beta y por dos (2) años a partir del lanzamiento público de la Plataforma.',
        'b) No divulgar, publicar ni comentar públicamente —en ningún formato ni medio, incluyendo redes sociales, entrevistas, podcasts o mensajería— el funcionamiento del sistema HL ni los demás elementos de la Cláusula 2.',
        'c) No reproducir, capturar, grabar ni distribuir pantallas, videos o material del interior de la Plataforma sin autorización expresa y por escrito de Gradiente.',
        'd) No usar la Información Confidencial para construir, o ayudar a construir, un producto que la replique.',
      ],
    },
    {
      n: '4',
      title: 'Propiedad y uso de tu contenido',
      enClaro: 'tu contenido es tuyo. Nunca lo vendemos a terceros. Y puedes borrarlo cuando quieras.',
      body: [
        'Todo lo que publicas es y seguirá siendo tuyo. Gradiente no adquiere la propiedad de tu contenido; solo recibe una licencia limitada, no exclusiva e intransferible para mostrarlo y distribuirlo dentro de Gradiente, con el único fin de operar la Plataforma.',
        'Nunca venderemos, cederemos ni licenciaremos tu contenido a terceros. Cuando Gradiente incorpore monetización, será para retribuirte a ti —por ejemplo, vía HL canjeable o convocatorias con compensación—, no para comercializar tu contenido con terceros.',
        'Tú mantienes el control: puedes eliminar tu contenido de la Plataforma en cualquier momento. Si en algún momento no estás de acuerdo con cómo evoluciona la monetización, eliminar tu contenido es siempre una opción disponible para ti.',
      ],
    },
    {
      n: '5',
      title: 'Responsabilidad sobre el contenido',
      enClaro: 'lo que subes es tuyo y bajo tu responsabilidad; Gradiente solo lo aloja.',
      body: [
        'Eres el único responsable del contenido que publicas, y declaras contar con los derechos necesarios para hacerlo, sin infringir derechos de terceros ni la ley aplicable. Gradiente es un espacio anfitrión y no es responsable del contenido publicado por los Participantes: la responsabilidad recae en quien lo sube, que es su titular. Gradiente podrá retirar contenido que sea ilícito, infrinja derechos de terceros o contravenga estos términos.',
      ],
    },
    {
      n: '6',
      title: 'Nuestros compromisos',
      enClaro: 'acceso sin costo durante la beta, trabajamos por retribuirte, y cuidamos tus datos.',
      body: [
        'Gradiente se compromete a:',
        'a) Ofrecer acceso sin costo durante la beta.',
        'b) Trabajar de buena fe para desarrollar mecanismos de retribución a creadores, como el sistema HL canjeable y convocatorias con compensación económica.',
        'c) No compartir tus datos personales con terceros, salvo obligación legal.',
        'd) Atribuir correctamente cada contenido al perfil del Participante que lo generó.',
      ],
    },
    {
      n: '7',
      title: 'Datos y privacidad',
      enClaro:
        'usamos datos de uso de forma agregada y anónima para mejorar; tus datos personales se rigen por el Aviso de Privacidad.',
      body: [
        'Para mejorar el producto durante la beta, Gradiente podrá utilizar datos de navegación, interacción y uso de forma agregada y anónima. El tratamiento de tus datos personales se rige por nuestro Aviso de Privacidad, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares; ahí se describe cómo ejercer tus derechos ARCO.',
      ],
    },
    {
      n: '8',
      title: 'Incumplimiento de confidencialidad',
      enClaro: 'si se rompe la confianza, podemos cerrar tu acceso y reclamar los daños.',
      body: [
        'El incumplimiento de los compromisos de confidencialidad podrá dar lugar a la terminación inmediata del acceso a la Plataforma y a la responsabilidad por los daños y perjuicios que se ocasionen, conforme a la legislación aplicable. En casos graves de divulgación de información que constituya secreto industrial, podrán aplicar las disposiciones de la Ley Federal de Protección a la Propiedad Industrial y demás normas aplicables, y Gradiente podrá solicitar las medidas que correspondan ante la autoridad competente.',
      ],
    },
    {
      n: '9',
      title: 'Vigencia',
      enClaro: 'aplica desde que lo aceptas; la confidencialidad sigue un tiempo después.',
      body: [
        'Este Acuerdo entra en vigor al momento de la aceptación electrónica y permanece vigente durante toda tu relación con la Plataforma. Los compromisos de confidencialidad de la Cláusula 3 sobreviven a la terminación del acceso por el plazo ahí indicado.',
      ],
    },
    {
      n: '10',
      title: 'Jurisdicción',
      enClaro: 'cualquier asunto legal se resuelve en la Ciudad de México.',
      body: [
        'Las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero que pudiera corresponderles por razón de domicilio presente o futuro.',
      ],
    },
  ],
  closing:
    'Al hacer clic en "Acepto", declaras haber leído, entendido y aceptado este Acuerdo. Esta aceptación constituye tu firma electrónica conforme al Código de Comercio de los Estados Unidos Mexicanos.',
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
    // preventScroll: focusing the bottom-pinned ACEPTO button otherwise scrolls
    // the terms body to the end on open (esp. on mobile) — the user should
    // start at the top of the agreement.
    acceptRef.current?.focus({ preventScroll: true })
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
        className="eva-box relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col bg-base"
        style={{ borderColor: '#242424' }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5"
          style={{ borderColor: '#242424' }}
        >
          <span className="font-mono text-[10px] tracking-widest" style={{ color: '#F97316' }}>
            //ACUERDO · BETA CERRADA
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
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            {BETA_TERMS.subtitle}
          </p>
          <p className="mt-3 font-grotesk text-[12.5px] leading-relaxed text-secondary">
            {BETA_TERMS.preamble}
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {BETA_TERMS.sections.map((s) => (
              <section key={s.n} className="flex flex-col gap-1.5">
                <h3 className="font-mono text-[11px] tracking-widest text-sys-orange">
                  {s.n} · {s.title}
                </h3>
                <p className="font-mono text-[10.5px] italic leading-relaxed text-muted">
                  En claro: {s.enClaro}
                </p>
                {s.body.map((para, i) => (
                  <p
                    key={i}
                    className="font-grotesk text-[12.5px] leading-relaxed text-secondary"
                  >
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <p
            className="mt-5 border-t pt-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted"
            style={{ borderColor: '#242424' }}
          >
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
