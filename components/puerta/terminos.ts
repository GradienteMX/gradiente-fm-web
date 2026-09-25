/**
 * Closed-beta terms («el acuerdo»), ported verbatim from espectro-fm-web
 * (`components/welcome/BetaTermsModal.tsx`, version 2026-06-23). Every
 * clause carries an «En claro» line so it reads human, not adversarial.
 * Acceptance is required to mint an identity.
 */

export interface Clausula {
  n: string
  title: string
  enClaro: string
  body: string[]
}

export const BETA_TERMS: {
  version: string
  lastUpdated: string
  subtitle: string
  preamble: string
  sections: Clausula[]
  closing: string
} = {
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
      enClaro: 'usamos datos de uso de forma agregada y anónima para mejorar; tus datos personales se rigen por el Aviso de Privacidad.',
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
    'Al aceptar, declaras haber leído, entendido y aceptado este Acuerdo. Esta aceptación constituye tu firma electrónica conforme al Código de Comercio de los Estados Unidos Mexicanos.',
}
