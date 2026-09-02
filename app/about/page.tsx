import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  BrandPageShell,
  BrandSection,
  BrandSubhead,
  BrandMotto,
  BrandTable,
} from '@/components/brand/BrandPageShell'

// ── /about — QUÉ ES GRADIENTE (fase F rewrite) ──────────────────────────────
//
// This page used to inline the third-party invitation deliverable
// (`Gradiente-ops/deliverables/INVITACION_v2.html`) verbatim: a ~2k-line
// client component carrying its own private `.qe-root` token system, a
// Rajdhani webfont the site never otherwise loads, a scanline overlay, a
// glitch title, a phosphor-tape fader on the retired pre-2026 rainbow vibe
// ramp, a UTC clock, a reading-progress bar, a TOC IntersectionObserver, and
// a client-side password constant gating the manifesto.
//
// Fase F rewrites it as a normal server page on the house BrandPageShell.
// The PROSE is carried across intact; the decoration is gone, and so is the
// password gate — it was a string constant shipped in the JS bundle, so it
// protected nothing and read as an affordance that looks real but does not
// work. The manifesto renders directly.
//
// The invitation deliverable itself is untouched and remains the canonical
// per-recipient artifact; this is only the public surface.

export const metadata: Metadata = { title: 'Qué es Gradiente' }

const CHAIN = ['COMUNIDAD', 'INFRAESTRUCTURA', 'MEMORIA', 'ESCENA'] as const

// Printed bullet list in the paper register.
function Bullets({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-4">
      {items.map((it, i) => (
        <li key={i} className="list-outside list-disc marker:text-ink-faint">
          {it}
        </li>
      ))}
    </ul>
  )
}

// Numbered procedure list — the printed steps.
function Steps({ items }: { items: readonly ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i} className="list-outside list-decimal marker:font-mono marker:text-ink-faint">
          {it}
        </li>
      ))}
    </ol>
  )
}

export default function AboutPage() {
  return (
    <>
      <BrandPageShell
        subsystem="ABOUT"
        title="GRADIENTE MX"
        lead="Infraestructura y memoria para la escena underground de música y arte sonoro en México."
      >
        {/* ── Cabecera ─────────────────────────────────────────────────── */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          {CHAIN.map((word, i) => (
            <span key={word} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-ink-faint">
                  →
                </span>
              )}
              {word}
            </span>
          ))}
        </p>

        <blockquote className="border-l-2 border-ink pl-4 font-grotesk text-d15 italic leading-relaxed text-ink">
          Treinta rayos convergen en el cubo de una rueda; es el agujero en el
          centro lo que la hace útil.
          <cite className="mt-2 block font-mono text-d11 not-italic uppercase tracking-widest text-ink-faint">
            Lao Tzu · Tao Te Ching · XI
          </cite>
        </blockquote>

        <p>
          La cultura no se transmite desde un punto hacia afuera: se construye
          cuando personas distintas convergen hacia un centro compartido por
          todos y definido por nadie.
        </p>

        <p className="font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
          LA PUERTA ESTÁ ABIERTA.
        </p>

        <div className="flex flex-col gap-3 border-y border-ink py-6">
          <p>
            Te invitamos a la beta cerrada de Gradiente: un espacio para la
            música construido para ser democrático, descentralizado y
            propiamente nuestro. Un lugar para estar más cerca de tu comunidad,
            sin depender de redes que consumen tu trabajo sin devolver nada.
          </p>
          <p className="font-mono text-d13 uppercase tracking-widest text-ink">
            El archivo no tiene dueños. Solo custodios temporales.
          </p>
        </div>

        {/* ── 01 ───────────────────────────────────────────────────────── */}
        <BrandSection index={1} title="Qué es Gradiente">
          <BrandMotto>Personas, no plataformas</BrandMotto>
          <p>
            Gradiente es infraestructura y memoria para la escena underground de
            música y arte sonoro en México. Un foro descentralizado, refugio y
            respuesta a la cultura del algoritmo: listado de eventos, periodismo
            musical, reseñas, mixes, foro y marketplace. Debajo hay un sistema
            técnicamente sofisticado que posibilita un ecosistema vivo: los
            contenidos suben, bajan, crecen, se hunden y resucitan según lo que
            generan en la comunidad. Por fuera, todo es intuitivo e inmediato.
          </p>
        </BrandSection>

        {/* ── 02 ───────────────────────────────────────────────────────── */}
        <BrandSection index={2} title="Para qué">
          <BrandMotto>
            Cuando el mundo se desarma, la comunidad es la medicina.
          </BrandMotto>
          <p>
            Las plataformas que moldean cómo descubrimos y compartimos música
            fueron construidas desde otros contextos, con fines{' '}
            <strong className="font-bold text-ink">
              extractivos y parasitarios
            </strong>
            . No devuelven nada a la cultura que consumen.
          </p>
          <p>
            Gradiente surge desde aquí, desde una ciudad y una escena que
            co-habitamos. La intención es hacer esa realidad más sana: mejor
            conectada, mejor informada. Un espacio para el diálogo, la reflexión
            y una forma de promoción más personal y colectiva, sin alimentar a
            las plataformas que nos están demoralizando.
          </p>
        </BrandSection>

        {/* ── 03 ───────────────────────────────────────────────────────── */}
        <BrandSection index={3} title="Quiénes somos">
          <BrandMotto>Cada uno es un centro</BrandMotto>
          <p>
            Gradiente nació desde adentro de la escena: promotores, DJs,
            periodistas y colectivos que decidieron construir el espacio que la
            escena necesitaba en lugar de seguir dependiendo de plataformas que
            consumen el trabajo de la comunidad sin devolver nada. Cada sello,
            colectivo y espacio tiene aquí un lugar para plasmar su filosofía,
            publicar sus mixes, archivar sus reseñas y construir una relación
            directa y completa con su público, más allá de posts y memes en
            Instagram. El contenido que generan no desaparece en el vacío de un
            algoritmo: vive, se cultiva, construye comunidad y nicho con el
            tiempo.
          </p>
          <p>
            Equipo core de 13 personas, más colaboradores de inside editorial.
            Todos con piel en el juego desde el día uno.
          </p>
        </BrandSection>

        {/* ── 04 ───────────────────────────────────────────────────────── */}
        <BrandSection index={4} title="Calibración analógica">
          <BrandMotto>Tecnología escondida. Formato análogo.</BrandMotto>
          <p>
            El género como único organizador es una mentira. Reduce lo que es
            continuo y separa lo que naturalmente conversa entre sí. Hay techno
            que medita y techno que detona. Hay jazz de tres de la mañana y jazz
            que es una pared de ruido. La etiqueta no te dice nada de eso.
          </p>
          <p>
            En la parte superior de la página hay un fader continuo de 0
            (glacial) a 10 (volcán). Un solo gesto. Lo mueves y el sistema
            reorganiza todo en tiempo real según esa intensidad. Cada pieza
            propone un valor inicial desde su autor, contexto y metadata; la
            comunidad lo refina con su lectura, haciendo vibe check. A esto le
            llamamos calibración analógica.
          </p>
          <p>
            Debajo de ese gesto corre un sistema técnicamente denso: cada pieza
            es catalogada, cuantificada y archivada con su propia capa de
            metadata. El sistema lee el contexto, el autor, las reacciones, el
            tiempo, la energía que genera. Todo eso se reduce a dos señales
            visibles: su posición en el grid y el{' '}
            <strong className="font-bold text-ink">Half Life</strong> actualizado.
          </p>
          <p>
            El Half Life es la energía propia de cada pieza. Nace con un valor
            inicial, decae con el tiempo y se renueva cuando la comunidad
            interactúa con ella. Lo que no recibe atención no desaparece: se
            archiva, sigue vivo dentro del ecosistema y puede resucitar cuando
            vuelva a ser relevante, cuando el contexto cambie, o cuando alguien
            lo descubra de nuevo. Lo que haces aquí no se desperdicia: se cultiva
            y se nutre en su respectivo nicho.
          </p>
          <p>
            Es un organismo vivo que mantenemos y cultivamos juntos. Por fuera
            parece una parrilla o un foro.
          </p>
        </BrandSection>

        {/* ── 05 ───────────────────────────────────────────────────────── */}
        <BrandSection index={5} title="Estructura comunitaria">
          <BrandMotto>Guías, no porteros</BrandMotto>
          <p>
            Los roles suben y bajan de manera orgánica según tu enfoque, tu tipo
            de participación y lo que generas en la comunidad.
          </p>
          <p>
            Si recibiste una invitación, ya fuiste colocado automáticamente en
            los rangos superiores. Tendrás acceso a más opciones desde el primer
            momento.
          </p>
          <BrandTable
            headers={['Rol', 'Capacidad']}
            rows={[
              ['USER', 'Comentar, reaccionar, postear en el foro, guardar items'],
              ['CURATOR', '+ Listicles, encuestas, marketplace'],
              ['GUIDE', '+ Opiniones, mixes: voz editorial'],
              ['INSIDER', 'Mismo nivel que GUIDE, firma desde la escena'],
              ['ADMIN', 'Todo. Asigna roles, modera, edita'],
            ]}
          />
        </BrandSection>

        {/* ── 06 ───────────────────────────────────────────────────────── */}
        <BrandSection index={6} title="Convocatorias">
          <BrandMotto>Tu gusto vale oro</BrandMotto>
          <p>
            Cada mes cierra una convocatoria y sus resultados se anuncian y pagan
            en el Evento Gradiente MX del mes. La convocatoria existe para
            fomentar el pensamiento crítico, el hábito de compartir, y sobre todo
            un periodismo musical independiente y accesible.
          </p>
          <Bullets
            items={[
              <>
                <strong className="font-bold text-ink">Prize pool:</strong> 10,000
                MXN por convocatoria, repartidos por categoría según HL acumulado
                al cierre del mes.
              </>,
              'Sin jurado. La comunidad decide por HL.',
            ]}
          />
          <BrandTable
            headers={['Categoría', 'Premio']}
            alignLast
            rows={[
              ['Editorial', '4,500 MXN'],
              ['Artículo', '2,500 MXN'],
              ['Opinión', '500 MXN'],
              ['Review', '500 MXN'],
              ['Listicle', '500 MXN'],
              ['Foro', '500 MXN'],
            ]}
          />
          <p>El premio reconoce lo que la escena produce. La comunidad es el jurado.</p>
        </BrandSection>

        {/* ── 07 ───────────────────────────────────────────────────────── */}
        <BrandSection index={7} title="Guía de usuario">
          <BrandMotto>Todo empieza en el dashboard.</BrandMotto>

          <BrandTable
            caption="Tu dashboard"
            headers={['Sección', 'Para qué']}
            rows={[
              [
                'Nuevo contenido',
                'Elige una plantilla y compón. Mix, evento, review, editorial, opinión, lista, artículo, noticia.',
              ],
              [
                'Drafts',
                'Bandeja de borradores activos. Color por tipo, posiciones libres.',
              ],
              [
                'Publicados',
                'Lo que ya soltaste. Versión local de la sesión, listo para revisar.',
              ],
              ['Perfil', 'Identidad editorial. Bio, firma, pronombres, ciudad.'],
            ]}
          />

          <BrandSubhead>Acceso</BrandSubhead>
          <p>
            Entraste por invitación. Para publicar necesitas estar logueado. Todo
            vive y comienza en tu dashboard: ícono de perfil arriba a la derecha.
          </p>

          <BrandSubhead>Tu perfil</BrandSubhead>
          <p>Tienes dos capas de identidad. Pueden coexistir.</p>
          <BrandTable
            headers={['Tipo', 'Para qué']}
            rows={[
              [
                'USUARIO',
                'Publicas con tu nombre, acumulas reacciones, recibes un rango automático',
              ],
              [
                'FRANJA',
                'Para sellos, promotoras, colectivos, espacios. Perfil propio, marketplace integrado, equipo con permisos para publicar desde el espacio del franja',
              ],
            ]}
          />

          <BrandSubhead>Roles</BrandSubhead>
          <p>
            Los roles son acumulativos. Cada nivel hereda el anterior. Subir de
            rol es automático — requiere participar y crear. Si quieres publicar
            algo que tu rol no permite todavía, contacta a un admin.
          </p>
          <BrandTable
            headers={['Rol', 'Capacidad']}
            rows={[
              ['USUARIO', 'Comentar, reaccionar, foro, guardar, votar'],
              ['CURADOR', '+ Listicles, encuestas, marketplace'],
              ['GUÍA', '+ Opiniones, mixes (voz editorial)'],
              ['INSIDER', 'Igual que GUÍA, firma desde la escena'],
              ['ADMIN', 'Todo. Asigna roles, edita, borra'],
            ]}
          />

          <BrandSubhead>Tipos de contenido</BrandSubhead>
          <BrandTable
            headers={['Tipo', 'Qué es']}
            rows={[
              [
                'Mix',
                'DJ set, radio show o mixtape. Multi-source, tracklist, contexto.',
              ],
              [
                'Lista',
                'Recuento editorial ranked. Top-N tracks con comentario por pista.',
              ],
              [
                'Artículo',
                'Longform reportado. Bloques estructurados, citas, footnotes.',
              ],
              ['Evento', 'Fecha en CDMX. Venue, line-up, boletos, rango horario.'],
              [
                'Review',
                'Crítica de disco o evento. Cuerpo corto, vibe, calificación implícita.',
              ],
              ['Editorial', 'Texto curatorial largo. Posición, escena, firma.'],
              ['Opinión', 'Columna firmada. Postura individual sobre la escena.'],
              ['Noticia', 'Nota corta. Dato rápido. Lo que está pasando ahora.'],
            ]}
          />
          <p>
            Si dudas: escoge el tipo más corto que sirva. ¿Por qué no compartes
            una lista de tus discos favoritos?
          </p>

          <BrandSubhead>Cómo publicar</BrandSubhead>
          <Steps
            items={[
              'Dashboard → NUEVO → escoge el tipo',
              'Llena el form: título concreto sin clickbait, imagen obligatoria, cuerpo en markdown con música embebida (Bandcamp / SoundCloud / Spotify), vibe de 0 a 10, géneros y etiquetas',
              'Guardar draft: privado, solo tú lo ves',
              'Publicar: la pieza pasa a PENDIENTE (chip rojo, solo visible para ti)',
              'Confirmar → modal con preview final → Publicar definitivamente',
            ]}
          />
          <p className="w-fit border border-ink px-2.5 py-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
            DRAFT → PENDIENTE → PUBLICADO
          </p>

          <BrandSubhead>Después de publicar</BrandSubhead>
          <p>
            Tu pieza nace con HL: energía que decae con el tiempo y se renueva si
            la comunidad la toca. No hay likes ni contadores visibles. El tamaño
            y la posición en el feed son la única señal. Puedes editar y borrar
            desde tu Dashboard → PUBLICADOS.
          </p>

          <BrandSubhead>El foro</BrandSubhead>
          <p>
            Imageboard-style. Hilos con imagen obligatoria, respuestas planas,
            &gt;&gt;id para citar.
          </p>
          <Bullets
            items={[
              'Abrir hilo: /foro → + NUEVO HILO → imagen + título + géneros + mensaje',
              'Responder: click en el hilo → caja al final → >>id para citar a alguien',
            ]}
          />
          <p>
            Los hilos hacen bump con cada respuesta. Límite de 30 hilos abiertos:
            los más viejos se cierran cuando se llena.
          </p>

          <BrandSubhead>Tu HL</BrandSubhead>
          <p>
            Sube cuando publicas, posteas o respondes en el foro, comentas bajo
            una pieza, recibes reacciones en tus comentarios, guardas items o tus
            piezas reciben interacción.
          </p>
          <p>
            Por qué importa: las convocatorias mensuales reparten dinero entre los
            posts con más HL. A futuro, HL será canjeable.
          </p>

          <BrandSubhead>Comentarios y reacciones</BrandSubhead>
          <p>
            Para abrir comentarios de cualquier pieza: click en el botón derecho
            de la tarjeta. Dos reacciones, solo dos:
          </p>
          <BrandTable
            headers={['Reacción', 'Significado']}
            rows={[
              ['[!] SEÑAL', 'Algo prende, algo importa, algo detona'],
              ['[?] DUDA', 'Algo abre pregunta, algo te perturba'],
            ]}
          />
          <p>
            Las reacciones que recibes definen tu rango automático: NORMIE,
            DETONADOR, ENIGMA o ESPECTRO. El rango se mueve solo.
          </p>

          <BrandSubhead>Lo que no tienes que hacer</BrandSubhead>
          <Bullets
            items={[
              'No pelees por aparecer arriba. El HL lo hace solo.',
              'No pongas 8 etiquetas. Tres precisas valen más.',
              'No uses IA para escribir. Para ortografía, ok. Para pensar por ti, no.',
              'No tienes que saber escribir bien. Solo tener algo que decir.',
            ]}
          />
        </BrandSection>

        {/* ── 08 — the manifesto. Previously behind a client-side password
            constant; rendered directly since fase F. ─────────────────── */}
        <BrandSection index={8} title="Manifiesto">
          <p className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
            Todo tiene un centro.
          </p>
          <p>
            Gradiente es infraestructura digital para la escena underground de
            música y arte sonoro en México. Un foro descentralizado, inspirado en
            los message boards de los 90 y 2000, que funciona como refugio y
            respuesta a la cultura del algoritmo.
          </p>
          <p>
            Aquí conviven el listado curado de eventos, el periodismo musical, las
            reseñas, las opiniones, los mixes, el foro y el marketplace. Todo bajo
            una misma lógica: el gusto subjetivo de cada miembro es lo que mueve
            el sistema. La visibilidad se gana por aportación, no por performance.
            Curaduría sin porteros.
          </p>

          <BrandSubhead>
            La música está mejor que nunca. La industria está rota.
          </BrandSubhead>
          <p>
            Hay más herramientas, más alcance, más géneros, mejores sistemas de
            sonido y músicos de todas partes del mundo viajando y tocando. Existe
            una especie de aldea global. Pero todo eso solo se premia si alimenta
            al algoritmo.
          </p>
          <p>
            La mayoría de la juventud nunca vio los primeros días del rave, del
            grunge, del metal. No eran virales. Eran contracultura: exactamente lo
            que después alimenta a la cultura mainstream. Pero esa contracultura
            fue absorbida por las plataformas que hoy controlan cómo nos enteramos
            de las cosas. Sin espacios descentralizados y abiertos, no podemos
            coincidir en nada nuevo. Todas las ideas pasan primero por el filtro
            del algoritmo.
          </p>

          <BrandSubhead>El problema es el control</BrandSubhead>
          <p>
            Tenemos las herramientas para ser independientes: distribuir, imprimir
            discos, promover. Aún así, los músicos ganan menos que nunca. Los
            mismos cinco majors son los únicos que ganan dinero. Los músicos no
            pueden vivir de la música. El medio está secuestrado.
          </p>
          <p>
            Los festivales son caros y elitistas. La gente va por FOMO, no por
            descubrimiento. Las plataformas donde vendemos, hablamos y escuchamos
            música son precisamente las más dañinas para quienes la hacen y la
            escuchan. Está al revés.
          </p>

          <BrandSubhead>No hay clubs. Hay discotecas.</BrandSubhead>
          <p>
            Los espacios donde pasaba la conexión son cada vez menores y menos
            auténticos, y no hay reemplazos consistentes. Lo que queda son
            discotecas: espacios donde la música tiene que adherirse a un formato
            alineado con los horarios de venta y consumo de bebidas. El DJ o la
            banda es un servicio, no un artista. Un objeto de diseño, una planta,
            una curiosidad para ambientar el lugar.
          </p>

          <BrandSubhead>El ouroboros del algoritmo</BrandSubhead>
          <p>
            Lo que queda digitalmente son plataformas que no fueron hechas para
            esto. Meta mata cualquier interacción y solo busca controversia y
            perfiles performáticos. Spotify es un demonio de mil cabezas que
            castiga la curiosidad y promueve cada vez más música hecha por IA,
            completando su destino como la antítesis del consumo responsable de
            música.
          </p>
          <p>
            Las recomendaciones se entrenan con recomendaciones, y las mismas
            cosas siguen apareciendo. Lo local es inexistente y el contexto es
            nulo. Los jóvenes no tienen manera de establecer una relación real con
            un álbum: simplemente usan la plataforma como un grifo que a su vez
            les &quot;recomienda&quot; cosas similares.
          </p>
          <p>
            Pero descubrir cosas más personales toma tiempo. Es llegar a tener una
            relación con algo, no solamente usarlo como background. Son cosas que
            exigen algo de ti. Creemos que si vamos a &quot;consumir&quot; música
            responsablemente, también deberíamos entrarle de otra manera, dentro
            de un contexto, entregándole algo de nosotros, no solamente
            utilizándolo como ruido blanco de fondo.
          </p>

          <BrandSubhead>
            Cumplir con la promesa de la edad dorada de foros y blogs
          </BrandSubhead>
          <p>
            Después del boom de los blogs, donde cada quien compartía desde su
            propio mundo y su propia estética, nos volvimos una sociedad de
            medianía. Desaparecieron los extremos, las excentricidades, los gustos
            raros. Desapareció también el periodismo musical hecho desde adentro,
            escrito por gente de la escena para gente de la escena. Hoy lo
            mexicano nos llega traducido: lo descubrimos cuando una plataforma de
            afuera nos lo devuelve filtrado. Todos compartimos los mismos gustos
            porque no hay a dónde ir a indagar en algo profundo, nuevo o
            misterioso.
          </p>
          <p>
            Antes había multiplicidad de voces. Hoy el contenido y el formato se
            homogenizaron, y todo tiene que ser inmediato, tiene que atraparte en
            medio de un scroll diseñado para secuestrar tus sentidos. Que el
            algoritmo te muestre algo no es descubrimiento.
          </p>

          <BrandSubhead>El descubrimiento es un privilegio</BrandSubhead>
          <p>
            Estamos desaprovechando los gustos subjetivos. Hoy el descubrimiento
            real está reservado para quienes ya tienen contexto y acceso. La gente
            no sale de su clan: el algoritmo te encierra en tu género, en tu
            nicho, en tu burbuja, y las generaciones y comunidades ya casi no se
            cruzan.
          </p>
          <p>
            Por eso necesitamos guías, no porteros. Gente que abra contexto en
            lugar de administrar el acceso. Esas son las cosas que terminan
            cambiándote la vida.
          </p>

          <BrandSubhead>Las etiquetas mienten</BrandSubhead>
          <p>
            El género como único organizador es una mentira. Reduce lo que es
            continuo y separa lo que naturalmente conversa entre sí. Hay techno
            que medita y techno que detona. Hay jazz de tres de la mañana y jazz
            que es una pared de ruido. La etiqueta no te dice nada de eso.
          </p>

          <BrandSubhead>Gravedad, no polarización</BrandSubhead>
          <p>
            En el corazón del sistema hay un fader continuo de 0 (glacial) a 10
            (volcán). Es la única decisión que tomas para empezar a navegar.
            Mueves el fader y atraviesas todo a esa intensidad, sin importar el
            género. Cada pieza nace con un valor asignado editorialmente, y con el
            tiempo la comunidad lo refina con su lectura. A esto le llamamos
            calibración analógica.
          </p>
          <p>
            El fader convierte la jerarquización en un sistema análogo,
            promoviendo nichos naturales en vez de polaridad algorítmica.
          </p>
          <p>
            Entre el filtro local y el feedback análogo, se elimina la grasa de las
            plataformas convencionales. Lo que queda es un entorno diseñado para
            leer, escribir y reflexionar.
          </p>

          <BrandSubhead>La oportunidad</BrandSubhead>
          <p>
            El mundo se está reconstruyendo. Las estructuras que dimos por hechas
            se están desarmando, y lo que viene después depende de qué cimientos
            pongamos hoy. Si no construimos algo democrático ahora, alguna
            corporación lo va a construir por nosotros, y lo va a hacer mal.
          </p>

          <BrandSubhead>Desde aquí</BrandSubhead>
          <p>
            Lo que pongamos, lo ponemos desde aquí. Gradiente nace en México,
            empezando por la CDMX, y de ahí a GDL, GTO, Puebla, QRO, Monterrey,
            con la mira puesta en Latinoamérica. Las plataformas que hoy moldean
            cómo descubrimos y cómo escuchamos fueron construidas desde otros
            centros culturales. Son referentes eurocéntricos que pretenden ser
            globales. Nosotros no necesitamos traducción. Por locales, para todo el
            mundo.
          </p>
          <p>
            La infraestructura tiene que construirse desde adentro de la escena, no
            impuesta desde afuera. Comunidad, democratización, decolonización.
          </p>

          <BrandSubhead>La energía de los message boards</BrandSubhead>
          <p>
            Volvemos a algo viejo y bueno: la energía de los message boards de los
            2000s. Lugares sin censura algorítmica, sin necesidad de performar,
            donde la conversación tenía peso porque importaba la idea, no el
            rendimiento. Tomamos esa raíz y la traemos al presente con tecnología
            real: un sistema profundamente técnico por dentro, pero intuitivo e
            inmediato para todos. La tecnología opera por debajo, como una
            corriente subterránea, sin protagonismo. El medio debería ser
            invisible. Es infraestructura para que la escena conviva y comparta.
            Nada más.
          </p>

          <BrandSubhead>Espacio colectivo</BrandSubhead>
          <p>
            Aquí cada sello, tienda, promotora, colectivo y espacio tiene perfil
            propio. Linkeas directo a tu tienda, conectas con un público
            especializado, y tienes el contexto para escribir reseñas o subir mixes
            desde adentro de tu proyecto.
          </p>
          <p>
            Cada franja tiene su equipo de admins y miembros que pueden publicar
            desde el espacio. Y si abres tus foros al público, puedes forjar
            alianzas, sumar gente de tu comunidad, dejar que el círculo cercano
            aporte sin necesariamente formar parte del equipo.
          </p>

          <BrandSubhead>Sin IA. Sin performance.</BrandSubhead>
          <p>
            Sin texto generado por IA, sin música generada por IA. Personas reales,
            conversación real.
          </p>
          <p>
            Queremos que la gente escriba, piense, haga listas, pregunte. No nos
            importa qué tan bien escribas. Importa que pienses, que tengas
            curiosidad, que aportes algo desde tu propio lugar.
          </p>

          <BrandSubhead>Guías, no porteros</BrandSubhead>
          <p>
            Hoy se ha perdido el gatekeeping, y eso es bueno. Pero tampoco podemos
            consumir todo lo que existe; necesitamos encontrar nuestro nicho, y
            para eso siempre ha hecho falta un guía. Las redes sociales los limaron
            hasta hacerlos casi imperceptibles. Al enfocarnos en menos cosas,
            podemos volver a construir nichos y comunidades integradas.
          </p>
          <p>
            Una comunidad no es simplemente un grupo de personas a las que
            venderles cosas. Es un organismo vivo con distintos matices, diferentes
            niveles de participación y diversas fases de involucramiento. Algunos
            están ahí para crear e influir en la experiencia. Otros para observar
            desde la sombra. Ambas posturas son válidas e incluso necesarias.
          </p>
          <p>
            La pertenencia y el nivel de acceso se ganan por aportación. El sistema
            lo lee solo: según las reacciones que provocas en los comentarios,
            señal (!) o duda (?), vas cayendo en un rango. DETONADOR si lo que
            escribes prende. ENIGMA si abre preguntas. ESPECTRO si haces las dos
            cosas. Hasta entonces eres NORMIE, como todos.
          </p>

          <BrandSubhead>Vida orgánica del contenido</BrandSubhead>
          <p>
            Cada cosa que entra a Gradiente tiene vida. No vive para siempre arriba
            ni se entierra al día siguiente. Cada pieza nace con HL: una energía
            que decae con el tiempo y se renueva con la atención de la comunidad.
            Lo que se calibra, se comenta, se comparte: vive más. Lo que nadie
            toca, se hunde por su propio peso.
          </p>
          <p>
            HL se comporta distinto según lo que sostiene. Una reseña no decae a la
            misma velocidad que un evento, un mix no se mide igual que una opinión,
            un post de foro vive en otro tiempo que un editorial. Cada contenido
            ocupa un lugar democratizado, pero ese lugar siempre es contextual.
          </p>
          <p>
            No hay likes, no hay dislikes, no hay contadores de seguidores, no hay
            estrellas. Tamaño y posición son las únicas señales visibles. La
            curaduría es el peso, y el peso se ve directamente.
          </p>

          <BrandSubhead>La economía de la escena</BrandSubhead>
          <p>
            La gente que mantiene esto vivo debería ganar algo: escritores,
            curadores, constructores de comunidad. La página no tiene costos para
            quien la usa, pero HL está diseñado para evolucionar hacia un mecanismo
            de intercambio monetario, junto con un sistema integrado de tipping.
            Los puntos que genera cada creador serán canjeables, y la comunidad
            podrá apoyar directamente a quien le mueve algo.
          </p>
          <p>
            A corto plazo: convocatorias mensuales. Los tres posts con más HL ganan
            dinero. Sin jurado. La comunidad decide.
          </p>

          <p className="mt-2 border-t border-ink pt-4 font-syne text-d18 font-extrabold leading-snug text-ink">
            Esto es infraestructura que la escena posee, antes de que alguien más
            la construya y la posea por nosotros.
          </p>
        </BrandSection>

        {/* ── Colofón ──────────────────────────────────────────────────── */}
        <p className="border-t border-ink pt-6 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          GRADIENTE · BETA 150 · CDMX 2026
        </p>
      </BrandPageShell>
    </>
  )
}
